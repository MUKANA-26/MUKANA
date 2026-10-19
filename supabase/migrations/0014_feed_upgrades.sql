-- =====================================================================================
-- Mukana · 0014 · Feed upgrades: editing, hashtags, saved posts, reposts, search,
-- trending and a personalised "For you" ordering.
-- =====================================================================================

alter table public.posts
  add column edited_at timestamptz,
  add column repost_of uuid references public.posts (id) on delete set null,
  add column hashtags  text[] not null default '{}',
  add column group_id  uuid;          -- foreign key added in 0016 (groups)
create index posts_hashtags_gin on public.posts using gin (hashtags);
create index posts_body_trgm on public.posts using gin (body gin_trgm_ops);
create index posts_repost_idx on public.posts (repost_of);

create or replace function public.feed_extract_hashtags(p_body text)
returns text[] language sql immutable as $$
  select coalesce((select array_agg(t) from (select distinct lower(m[1]) t from regexp_matches(coalesce(p_body, ''), '(?:^|\s)#([A-Za-z0-9_]{2,40})', 'g') as m limit 10) x), '{}')
$$;

create or replace function public.posts_set_hashtags()
returns trigger language plpgsql as $$
begin
  new.hashtags := public.feed_extract_hashtags(new.body);
  return new;
end $$;
create trigger posts_hashtags_trg before insert or update of body on public.posts
  for each row execute function public.posts_set_hashtags();
update public.posts set body = body;  -- backfill hashtags for existing posts

create table public.post_bookmarks (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.post_bookmarks enable row level security;
create policy post_bookmarks_select on public.post_bookmarks for select to authenticated using (user_id = auth.uid());
create policy post_bookmarks_insert on public.post_bookmarks for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy post_bookmarks_delete on public.post_bookmarks for delete to authenticated using (user_id = auth.uid());

create table public.hashtag_follows (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  tag        text not null check (tag ~ '^[a-z0-9_]{2,40}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, tag)
);
alter table public.hashtag_follows enable row level security;
create policy hashtag_follows_own on public.hashtag_follows for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());

-- ------------------------------------------------------------------ posting (now with reposts, skipping blocked people)
drop function if exists public.create_post(text, jsonb);
create or replace function public.create_post(p_body text, p_media jsonb default '[]'::jsonb, p_repost_of uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_body text := left(trim(coalesce(p_body, '')), 3000);
  v_id uuid; v_item jsonb; v_pos int := 0; v_images int := 0; v_videos int := 0; v_target uuid;
  v_root uuid; v_orig_author uuid; v_name text;
begin
  if v_user is null or not public.is_active_user() then raise exception 'Sign in to post'; end if;
  if not public.email_is_verified() then raise exception 'Verify your email address before posting'; end if;
  if jsonb_typeof(coalesce(p_media, '[]'::jsonb)) <> 'array' then raise exception 'Invalid media'; end if;
  if p_repost_of is null and v_body = '' and jsonb_array_length(coalesce(p_media, '[]'::jsonb)) = 0 then
    raise exception 'Write something or add a photo or video';
  end if;
  if (select count(*) from public.posts where author_id = v_user and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'You are posting too fast. Please try again later.';
  end if;

  if p_repost_of is not null then
    -- Always repost the original, never a chain of reposts.
    select coalesce(repost_of, id), author_id into v_root, v_orig_author from public.posts where id = p_repost_of and status = 'published';
    if v_root is null or public.is_blocked(v_user, v_orig_author) then raise exception 'This post is not available to repost'; end if;
    if jsonb_array_length(coalesce(p_media, '[]'::jsonb)) > 0 then raise exception 'A repost cannot include new media'; end if;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    if v_item ->> 'kind' = 'image' then v_images := v_images + 1;
    elsif v_item ->> 'kind' = 'video' then v_videos := v_videos + 1;
    else raise exception 'Invalid media type'; end if;
    if split_part(coalesce(v_item ->> 'path', ''), '/', 1) <> v_user::text or (v_item ->> 'path') like '%..%' then raise exception 'Invalid media file'; end if;
  end loop;
  if v_images > 4 then raise exception 'You can add up to 4 photos'; end if;
  if v_videos > 1 or (v_videos = 1 and v_images > 0) then raise exception 'Add either up to 4 photos or one video'; end if;

  insert into public.posts (author_id, body, repost_of) values (v_user, v_body, v_root) returning id into v_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    insert into public.post_media (post_id, kind, path, position) values (v_id, v_item ->> 'kind', v_item ->> 'path', v_pos);
    v_pos := v_pos + 1;
  end loop;

  foreach v_target in array public.feed_extract_mentions(v_body) loop
    if v_target <> v_user and exists (select 1 from public.profiles where id = v_target and status = 'active') and not public.is_blocked(v_user, v_target) then
      insert into public.post_mentions (post_id, user_id) values (v_id, v_target) on conflict do nothing;
    end if;
  end loop;

  if v_root is not null and v_orig_author <> v_user then
    select full_name into v_name from public.profiles where id = v_user;
    perform public.notify(v_orig_author, 'feed', coalesce(nullif(v_name, ''), 'Someone') || ' reposted your post', left(v_body, 140),
      '/feed/' || v_id, jsonb_build_object('post_id', v_id), 'repost:' || v_id);
  end if;
  return v_id;
end $$;
revoke all on function public.create_post(text, jsonb, uuid) from public, anon;
grant execute on function public.create_post(text, jsonb, uuid) to authenticated;

create or replace function public.edit_post(p_post uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_body text := left(trim(coalesce(p_body, '')), 3000);
  v_post public.posts; v_target uuid;
begin
  select * into v_post from public.posts where id = p_post and author_id = auth.uid() and status = 'published';
  if v_post.id is null then raise exception 'You can only edit your own posts'; end if;
  if v_body = '' and v_post.repost_of is null and not exists (select 1 from public.post_media where post_id = p_post) then
    raise exception 'A post needs some text, a photo or a video';
  end if;
  update public.posts set body = v_body, edited_at = now() where id = p_post;
  foreach v_target in array public.feed_extract_mentions(v_body) loop
    if v_target <> auth.uid() and exists (select 1 from public.profiles where id = v_target and status = 'active') and not public.is_blocked(auth.uid(), v_target) then
      insert into public.post_mentions (post_id, user_id) values (p_post, v_target) on conflict do nothing;
    end if;
  end loop;
end $$;
revoke all on function public.edit_post(uuid, text) from public, anon;
grant execute on function public.edit_post(uuid, text) to authenticated;

-- Comments also skip blocked people when tagging.
create or replace function public.add_comment(p_post uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_body text := left(trim(coalesce(p_body, '')), 1000); v_id uuid; v_target uuid;
begin
  if v_user is null or not public.is_active_user() then raise exception 'Sign in to comment'; end if;
  if not public.email_is_verified() then raise exception 'Verify your email address before commenting'; end if;
  if v_body = '' then raise exception 'Write a comment first'; end if;
  if not exists (select 1 from public.posts where id = p_post and status = 'published') then raise exception 'This post is no longer available'; end if;
  if (select count(*) from public.post_comments where author_id = v_user and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'You are commenting too fast. Please try again later.';
  end if;
  insert into public.post_comments (post_id, author_id, body) values (p_post, v_user, v_body) returning id into v_id;
  foreach v_target in array public.feed_extract_mentions(v_body) loop
    if v_target <> v_user and exists (select 1 from public.profiles where id = v_target and status = 'active') and not public.is_blocked(v_user, v_target) then
      insert into public.post_mentions (post_id, comment_id, user_id) values (p_post, v_id, v_target) on conflict do nothing;
    end if;
  end loop;
  return v_id;
end $$;

-- ------------------------------------------------------------------ personalised ordering
-- Modes: for_you (relevance), latest, following (people you follow or are connected to), saved (bookmarks), tag (needs p_tag).
create or replace function public.home_feed(p_mode text default 'for_you', p_offset int default 0, p_limit int default 10, p_tag text default null)
returns table (id uuid)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); v_tags text[];
begin
  if me is null or not public.is_active_user() then return; end if;
  select coalesce(array_agg(tag), '{}') into v_tags from public.hashtag_follows where user_id = me;
  if p_mode = 'saved' then
    return query
      select p.id from public.post_bookmarks b join public.posts p on p.id = b.post_id
       where b.user_id = me and p.status = 'published' and not public.is_blocked(me, p.author_id)
       order by b.created_at desc offset greatest(p_offset, 0) limit greatest(1, least(p_limit, 30));
  elsif p_mode = 'tag' then
    return query
      select p.id from public.posts p
       where p.status = 'published' and p.hashtags @> array[lower(coalesce(p_tag, ''))] and not public.is_blocked(me, p.author_id)
       order by p.created_at desc offset greatest(p_offset, 0) limit greatest(1, least(p_limit, 30));
  elsif p_mode = 'following' then
    return query
      select p.id from public.posts p
       where p.status = 'published' and p.group_id is null and not public.is_blocked(me, p.author_id)
         and (p.author_id = me or exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = p.author_id) or public.are_connected(me, p.author_id))
       order by p.created_at desc offset greatest(p_offset, 0) limit greatest(1, least(p_limit, 30));
  elsif p_mode = 'latest' then
    return query
      select p.id from public.posts p
       where p.status = 'published' and p.group_id is null and not public.is_blocked(me, p.author_id)
       order by p.created_at desc offset greatest(p_offset, 0) limit greatest(1, least(p_limit, 30));
  else
    -- Relevance in "hours of freshness": people you follow/know and topics you follow count as extra hours, popular posts too.
    return query
      select p.id from public.posts p
       where p.status = 'published' and p.group_id is null and not public.is_blocked(me, p.author_id) and p.created_at > now() - interval '60 days'
       order by (extract(epoch from p.created_at) / 3600.0)
              + case when p.author_id = me then 6 else 0 end
              + case when exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = p.author_id) then 36 else 0 end
              + case when public.are_connected(me, p.author_id) then 36 else 0 end
              + case when p.hashtags && v_tags then 24 else 0 end
              + least(p.like_count + 2 * p.comment_count, 20) * 1.5 desc,
                p.created_at desc
       offset greatest(p_offset, 0) limit greatest(1, least(p_limit, 30));
  end if;
end $$;
revoke all on function public.home_feed(text, int, int, text) from public, anon;
grant execute on function public.home_feed(text, int, int, text) to authenticated;

create or replace function public.trending_hashtags(p_limit int default 8)
returns table (tag text, uses bigint)
language sql stable security definer set search_path = public as $$
  select t, count(*) from public.posts p, unnest(p.hashtags) t
   where auth.uid() is not null and p.status = 'published' and p.created_at > now() - interval '7 days'
   group by t order by count(*) desc, t limit greatest(1, least(p_limit, 20))
$$;
revoke all on function public.trending_hashtags(int) from public, anon;
grant execute on function public.trending_hashtags(int) to authenticated;
