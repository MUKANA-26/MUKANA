-- =====================================================================================
-- Mukana · 0011 · Community feed: posts (text, photos, videos), likes, comments, @tagging,
-- reporting and moderation.
--
-- Privacy model:
--   * The feed is for signed-in members only.
--   * Only people who take part in the feed (post, comment or are tagged) are visible through
--     `feed_people`; nobody's email, phone, CV or profile is exposed.
--   * A member's profile photo becomes visible to other members only once they take part.
--   * Posts and comments are created through the functions below (validation, rate limits).
-- =====================================================================================

-- New enum values are only referenced inside function bodies or via ::text casts, so this file
-- can run in a single transaction.
alter type public.notification_type add value if not exists 'feed';
alter type public.report_target add value if not exists 'post';

-- ------------------------------------------------------------------ tables
create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles (id) on delete cascade,
  body          text not null default '' check (char_length(body) <= 3000),
  status        text not null default 'published' check (status in ('published', 'removed')),
  like_count    int not null default 0,
  comment_count int not null default 0,
  created_at    timestamptz not null default now()
);
create index posts_feed_idx   on public.posts (created_at desc) where status = 'published';
create index posts_author_idx on public.posts (author_id, created_at desc);

create table public.post_media (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  kind       text not null check (kind in ('image', 'video')),
  path       text not null check (char_length(path) <= 300),
  position   int not null default 0,
  created_at timestamptz not null default now(),
  unique (post_id, path)
);
create index post_media_post_idx on public.post_media (post_id, position);

create table public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_idx on public.post_likes (user_id);

create table public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  status     text not null default 'published' check (status in ('published', 'removed')),
  created_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);
create index post_comments_author_idx on public.post_comments (author_id);

create table public.post_mentions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  comment_id uuid references public.post_comments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index post_mentions_post_unique    on public.post_mentions (post_id, user_id) where comment_id is null;
create unique index post_mentions_comment_unique on public.post_mentions (comment_id, user_id) where comment_id is not null;
create index post_mentions_user_idx on public.post_mentions (user_id);

-- ------------------------------------------------------------------ who is visible in the feed
create view public.feed_people as
select pr.id, pr.full_name, pr.role, pr.avatar_path,
       case when pr.role = 'candidate'
            then nullif(concat_ws(' · ', coalesce(cp.programme, cp.qualification), cp.institution), '') end as headline,
       c.id as company_id, c.name as company_name
  from public.profiles pr
  left join public.candidate_profiles cp on cp.user_id = pr.id
  left join public.companies c on c.owner_id = pr.id and not c.suspended
 where pr.status = 'active'
   and (exists (select 1 from public.posts p where p.author_id = pr.id)
     or exists (select 1 from public.post_comments pc where pc.author_id = pr.id)
     or exists (select 1 from public.post_mentions pm where pm.user_id = pr.id));
revoke all on public.feed_people from anon, public;
grant select on public.feed_people to authenticated;

-- A participant's profile photo can be shown to other members.
create or replace function public.avatar_in_feed(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.feed_people fp where fp.avatar_path = p_name)
$$;
create policy "feed avatars read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.avatar_in_feed(name));

-- Member search for @tagging. Returns only what is needed to pick the right person.
create or replace function public.search_people(p_q text)
returns table (id uuid, full_name text, role public.user_role, headline text, company_name text)
language plpgsql stable security definer set search_path = public as $$
declare q text := trim(coalesce(p_q, ''));
begin
  if auth.uid() is null or not public.is_active_user() or char_length(q) < 2 then return; end if;
  q := replace(replace(q, '%', ''), '_', '');
  return query
    select pr.id, pr.full_name, pr.role,
           case when pr.role = 'candidate' then nullif(concat_ws(' · ', coalesce(cp.programme, cp.qualification), cp.institution), '') end,
           c.name
      from public.profiles pr
      left join public.candidate_profiles cp on cp.user_id = pr.id
      left join public.companies c on c.owner_id = pr.id and not c.suspended
     where pr.status = 'active' and pr.role <> 'admin' and pr.id <> auth.uid()
       and pr.full_name ilike '%' || q || '%'
     order by (pr.full_name ilike q || '%') desc, pr.full_name
     limit 8;
end $$;
revoke all on function public.search_people(text) from public, anon;
grant execute on function public.search_people(text) to authenticated;

-- ------------------------------------------------------------------ row level security
alter table public.posts enable row level security;
create policy posts_select on public.posts for select to authenticated
  using (public.is_active_user() and (status = 'published' or author_id = auth.uid() or public.is_admin()));
create policy posts_delete_own on public.posts for delete to authenticated using (author_id = auth.uid());

alter table public.post_media enable row level security;
create policy post_media_select on public.post_media for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));

alter table public.post_likes enable row level security;
create policy post_likes_select on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy post_likes_insert on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user()
              and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'));
create policy post_likes_delete on public.post_likes for delete to authenticated using (user_id = auth.uid());

alter table public.post_comments enable row level security;
create policy post_comments_select on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id)
         and (status = 'published' or author_id = auth.uid() or public.is_admin()));
create policy post_comments_delete on public.post_comments for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

alter table public.post_mentions enable row level security;
create policy post_mentions_select_own on public.post_mentions for select to authenticated using (user_id = auth.uid());
-- No insert/update policies: posts, media and comments are created by create_post() / add_comment().

-- ------------------------------------------------------------------ counters
create or replace function public.feed_count_likes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger post_likes_count after insert or delete on public.post_likes for each row execute function public.feed_count_likes();

create or replace function public.feed_count_comments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger post_comments_count after insert or delete on public.post_comments for each row execute function public.feed_count_comments();

-- ------------------------------------------------------------------ creating posts and comments
-- Tags are written in the text as  @[Full Name](user-uuid). This pulls them out.
create or replace function public.feed_extract_mentions(p_body text)
returns uuid[] language sql immutable as $$
  select coalesce(array_agg(distinct m[1]::uuid), '{}')
    from regexp_matches(coalesce(p_body, ''), '@\[[^\]]{1,80}\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)', 'g') as m
$$;

-- p_media: [{"kind":"image"|"video","path":"<uid>/<file>"}]  (max 4 images, or exactly 1 video)
create or replace function public.create_post(p_body text, p_media jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_body text := left(trim(coalesce(p_body, '')), 3000);
  v_id uuid;
  v_item jsonb;
  v_pos int := 0;
  v_images int := 0;
  v_videos int := 0;
  v_target uuid;
begin
  if v_user is null or not public.is_active_user() then raise exception 'Sign in to post'; end if;
  if not public.email_is_verified() then raise exception 'Verify your email address before posting'; end if;
  if jsonb_typeof(coalesce(p_media, '[]'::jsonb)) <> 'array' then raise exception 'Invalid media'; end if;
  if v_body = '' and jsonb_array_length(coalesce(p_media, '[]'::jsonb)) = 0 then raise exception 'Write something or add a photo or video'; end if;
  if (select count(*) from public.posts where author_id = v_user and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'You are posting too fast. Please try again later.';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    if v_item ->> 'kind' = 'image' then v_images := v_images + 1;
    elsif v_item ->> 'kind' = 'video' then v_videos := v_videos + 1;
    else raise exception 'Invalid media type'; end if;
    if split_part(coalesce(v_item ->> 'path', ''), '/', 1) <> v_user::text or (v_item ->> 'path') like '%..%' then
      raise exception 'Invalid media file';
    end if;
  end loop;
  if v_images > 4 then raise exception 'You can add up to 4 photos'; end if;
  if v_videos > 1 or (v_videos = 1 and v_images > 0) then raise exception 'Add either up to 4 photos or one video'; end if;

  insert into public.posts (author_id, body) values (v_user, v_body) returning id into v_id;
  for v_item in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    insert into public.post_media (post_id, kind, path, position) values (v_id, v_item ->> 'kind', v_item ->> 'path', v_pos);
    v_pos := v_pos + 1;
  end loop;

  foreach v_target in array public.feed_extract_mentions(v_body) loop
    if v_target <> v_user and exists (select 1 from public.profiles where id = v_target and status = 'active') then
      insert into public.post_mentions (post_id, user_id) values (v_id, v_target) on conflict do nothing;
    end if;
  end loop;
  return v_id;
end $$;
revoke all on function public.create_post(text, jsonb) from public, anon;
grant execute on function public.create_post(text, jsonb) to authenticated;

create or replace function public.add_comment(p_post uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_body text := left(trim(coalesce(p_body, '')), 1000);
  v_id uuid;
  v_target uuid;
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
    if v_target <> v_user and exists (select 1 from public.profiles where id = v_target and status = 'active') then
      insert into public.post_mentions (post_id, comment_id, user_id) values (p_post, v_id, v_target) on conflict do nothing;
    end if;
  end loop;
  return v_id;
end $$;
revoke all on function public.add_comment(uuid, text) from public, anon;
grant execute on function public.add_comment(uuid, text) to authenticated;

-- ------------------------------------------------------------------ notifications
create or replace function public.notify_on_mention()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_name text;
begin
  select coalesce(pc.author_id, p.author_id) into v_author
    from public.posts p left join public.post_comments pc on pc.id = new.comment_id where p.id = new.post_id;
  select full_name into v_name from public.profiles where id = v_author;
  perform public.notify(new.user_id, 'feed',
    coalesce(nullif(v_name, ''), 'Someone') || case when new.comment_id is null then ' tagged you in a post' else ' mentioned you in a comment' end,
    '', '/feed/' || new.post_id, jsonb_build_object('post_id', new.post_id), 'mention:' || new.id);
  return new;
end $$;
create trigger post_mentions_notify after insert on public.post_mentions for each row execute function public.notify_on_mention();

create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_name text;
begin
  select author_id into v_owner from public.posts where id = new.post_id;
  if v_owner is not null and v_owner <> new.author_id then
    select full_name into v_name from public.profiles where id = new.author_id;
    perform public.notify(v_owner, 'feed', coalesce(nullif(v_name, ''), 'Someone') || ' commented on your post',
      left(new.body, 140), '/feed/' || new.post_id, jsonb_build_object('post_id', new.post_id), 'comment:' || new.id);
  end if;
  return new;
end $$;
create trigger post_comments_notify after insert on public.post_comments for each row execute function public.notify_on_comment();

create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_name text;
begin
  select author_id into v_owner from public.posts where id = new.post_id;
  if v_owner is not null and v_owner <> new.user_id then
    select full_name into v_name from public.profiles where id = new.user_id;
    perform public.notify(v_owner, 'feed', coalesce(nullif(v_name, ''), 'Someone') || ' liked your post', '',
      '/feed/' || new.post_id, jsonb_build_object('post_id', new.post_id), 'like:' || new.post_id || ':' || new.user_id);
  end if;
  return new;
end $$;
create trigger post_likes_notify after insert on public.post_likes for each row execute function public.notify_on_like();

-- ------------------------------------------------------------------ reporting and moderation
alter table public.reports add column post_id uuid references public.posts (id) on delete cascade;
alter table public.reports drop constraint report_has_one_target;
alter table public.reports add constraint report_has_one_target check (
  (target_type::text = 'opportunity' and opportunity_id is not null and company_id is null and post_id is null) or
  (target_type::text = 'company'     and company_id is not null and opportunity_id is null and post_id is null) or
  (target_type::text = 'post'        and post_id is not null and opportunity_id is null and company_id is null));
drop index public.reports_one_open_per_target;
create unique index reports_one_open_per_target on public.reports (reporter_id, coalesce(opportunity_id, company_id, post_id)) where status = 'open';

create or replace function public.admin_moderate_post(p_post uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  perform public.require_admin();
  if p_action not in ('remove', 'restore') then raise exception 'Unknown action'; end if;
  update public.posts set status = case when p_action = 'remove' then 'removed' else 'published' end
   where id = p_post returning author_id into v_author;
  if v_author is null then raise exception 'Post not found'; end if;
  perform public.audit('post.' || p_action, 'post', p_post, jsonb_build_object('reason', p_reason));
  if p_action = 'remove' then
    perform public.notify(v_author, 'system', 'A post of yours was removed',
      coalesce(nullif(p_reason, ''), 'It did not follow the community rules.'), '/feed');
  end if;
end $$;
revoke all on function public.admin_moderate_post(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_post(uuid, text, text) to authenticated;

-- ------------------------------------------------------------------ storage for photos and videos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 31457280,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Public read happens through the public URL (unguessable file names). Members upload only into their own folder.
create policy "post media owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_user());
create policy "post media owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------------ data export now includes the feed
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
begin
  if v_user is null then raise exception 'Not signed in'; end if;
  select id into v_company from public.companies where owner_id = v_user;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_user),
    'candidate_profile', (select to_jsonb(c) from public.candidate_profiles c where c.user_id = v_user),
    'company', (select to_jsonb(c) from public.companies c where c.id = v_company),
    'company_private', (select to_jsonb(c) from public.company_private c where c.company_id = v_company),
    'verification_requests', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.verification_requests r where r.company_id = v_company),
    'opportunities', (select coalesce(jsonb_agg(to_jsonb(o) - 'search_text'), '[]'::jsonb) from public.opportunities o where o.company_id = v_company),
    'message_templates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.message_templates t where t.company_id = v_company),
    'saved_opportunities', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.saved_opportunities s where s.user_id = v_user),
    'applications', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.applications a where a.candidate_id = v_user),
    'application_events', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from public.application_events e
                            join public.applications a on a.id = e.application_id where a.candidate_id = v_user),
    'interviews', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.interviews i
                    join public.applications a on a.id = i.application_id where a.candidate_id = v_user),
    'notifications', (select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) from public.notifications n where n.user_id = v_user),
    'notification_preferences', (select to_jsonb(np) from public.notification_preferences np where np.user_id = v_user),
    'reports_filed', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.reports r where r.reporter_id = v_user),
    'posts', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.posts p where p.author_id = v_user),
    'post_media', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.post_media m join public.posts p on p.id = m.post_id where p.author_id = v_user),
    'comments', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.post_comments c where c.author_id = v_user),
    'likes', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from public.post_likes l where l.user_id = v_user),
    'consent', (select jsonb_build_object('consent_at', consent_at, 'consent_version', consent_version) from public.profiles where id = v_user)
  );
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
