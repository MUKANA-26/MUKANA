-- =====================================================================================
-- Mukana · 0018 · Faster feed (one round trip) and a personalised, refreshing recommender
--
-- * feed_page(): returns a whole page of posts (media, authors, likes, saves, originals of reposts) in ONE call.
-- * "For you" ranking = freshness + popularity + people you know + your interests (tags you follow/like, your skills,
--   your school) - posts you already saw + a small per-refresh variation + author variety.
--   Every refresh uses a new seed, so the order changes; posts you have already seen sink, new ones rise.
-- * feed_suggestions(): jobs and people to show next to the feed, also in one call.
-- =====================================================================================

create table public.post_impressions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index post_impressions_user_idx on public.post_impressions (user_id, seen_at desc);
alter table public.post_impressions enable row level security;
create policy post_impressions_own on public.post_impressions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Two-step verification applies here too (see 0017).
create policy mfa_gate on public.post_impressions as restrictive for all to authenticated using (public.aal_ok()) with check (public.aal_ok());

create or replace function public.record_impressions(p_posts uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or p_posts is null then return; end if;
  insert into public.post_impressions (user_id, post_id)
  select auth.uid(), p.id from public.posts p where p.id = any (p_posts[1:60])
  on conflict (user_id, post_id) do update set seen_at = now();
  delete from public.post_impressions where user_id = auth.uid() and seen_at < now() - interval '14 days';
end $$;
revoke all on function public.record_impressions(uuid[]) from public, anon;
grant execute on function public.record_impressions(uuid[]) to authenticated;

-- One post as JSON. SECURITY INVOKER: row level security still decides what the caller may see.
create or replace function public.feed_post_json(p public.posts, p_with_original boolean default true)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'author_id', p.author_id, 'body', p.body, 'status', p.status,
    'like_count', p.like_count, 'comment_count', p.comment_count, 'created_at', p.created_at,
    'edited_at', p.edited_at, 'repost_of', p.repost_of, 'hashtags', to_jsonb(p.hashtags),
    'media', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'path', m.path, 'position', m.position) order by m.position), '[]'::jsonb)
                from public.post_media m where m.post_id = p.id),
    'author', (select to_jsonb(fp) from public.feed_people fp where fp.id = p.author_id),
    'likedByMe', exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()),
    'savedByMe', exists (select 1 from public.post_bookmarks b where b.post_id = p.id and b.user_id = auth.uid()),
    'original', case when p_with_original and p.repost_of is not null
                  then (select public.feed_post_json(o, false) from public.posts o where o.id = p.repost_of and o.status = 'published')
                end)
$$;

create or replace function public.feed_page(
  p_mode text default 'for_you', p_offset int default 0, p_limit int default 10, p_tag text default null, p_seed int default 0,
  p_author uuid default null, p_group uuid default null, p_search text default null, p_post uuid default null
) returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 10), 30));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_ids uuid[];
  v_tags text[]; v_words text[]; v_inst text;
  v_q text := replace(replace(trim(coalesce(p_search, '')), '%', ''), '_', '');
begin
  if me is null or not public.is_active_user() then return '[]'::jsonb; end if;

  if p_post is not null then
    v_ids := array(select id from public.posts where id = p_post);
  elsif p_group is not null then
    v_ids := array(select id from public.posts where group_id = p_group and status = 'published' order by created_at desc offset v_offset limit v_limit);
  elsif p_author is not null then
    v_ids := array(select id from public.posts where author_id = p_author and group_id is null and status = 'published' order by created_at desc offset v_offset limit v_limit);
  elsif char_length(v_q) >= 2 then
    v_ids := array(select id from public.posts where group_id is null and status = 'published' and body ilike '%' || v_q || '%' order by created_at desc offset v_offset limit v_limit);
  elsif p_tag is not null then
    v_ids := array(select id from public.posts where group_id is null and status = 'published' and hashtags @> array[lower(p_tag)] order by created_at desc offset v_offset limit v_limit);
  elsif p_mode = 'saved' then
    v_ids := array(select p.id from public.post_bookmarks b join public.posts p on p.id = b.post_id
                    where b.user_id = me and p.status = 'published' order by b.created_at desc offset v_offset limit v_limit);
  elsif p_mode = 'following' then
    v_ids := array(select p.id from public.posts p
                    where p.status = 'published' and p.group_id is null
                      and (p.author_id = me or exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = p.author_id) or public.are_connected(me, p.author_id))
                    order by p.created_at desc offset v_offset limit v_limit);
  elsif p_mode = 'latest' then
    v_ids := array(select id from public.posts where status = 'published' and group_id is null order by created_at desc offset v_offset limit v_limit);
  else
    -- Interests: tags you follow or engaged with, plus your skills (candidates) and school.
    select coalesce(array_agg(distinct t), '{}') into v_tags from (
      select tag as t from public.hashtag_follows where user_id = me
      union select unnest(p.hashtags) from public.posts p join public.post_likes l on l.post_id = p.id where l.user_id = me and l.created_at > now() - interval '60 days'
      union select unnest(p.hashtags) from public.posts p join public.post_bookmarks b on b.post_id = p.id where b.user_id = me
      union select unnest(p.hashtags) from public.posts p where p.author_id = me and p.created_at > now() - interval '60 days'
    ) x;
    select coalesce(array_agg(lower(w)), '{}'), max(cp.institution) into v_words, v_inst
      from public.candidate_profiles cp, unnest(cp.skills || array[coalesce(cp.programme, '')]) w
     where cp.user_id = me and length(w) > 2;
    if v_words is null then v_words := '{}'; end if;

    v_ids := array(
      select id from (
        select s.id, s.created_at,
               s.score - 7 * (row_number() over (partition by s.author_id order by s.score desc) - 1) as final
          from (
            select p.id, p.author_id, p.created_at,
                   40 * exp(-extract(epoch from (now() - p.created_at)) / 3600.0 / 36.0)
                 + 6 * ln(1 + p.like_count + 2 * p.comment_count)
                 + case when exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = p.author_id) then 12 else 0 end
                 + case when public.are_connected(me, p.author_id) then 10 else 0 end
                 + least(15, 5 * coalesce(cardinality(array(select unnest(p.hashtags) intersect select unnest(v_tags))), 0))
                 + least(12, 4 * (select count(*) from unnest(v_words) w where position(w in lower(p.body)) > 0))
                 + case when v_inst is not null and exists (select 1 from public.candidate_profiles c2 where c2.user_id = p.author_id and c2.institution = v_inst) then 6 else 0 end
                 - case when exists (select 1 from public.post_impressions i where i.user_id = me and i.post_id = p.id and i.seen_at > now() - interval '24 hours') then 28 else 0 end
                 + 10 * ((abs(hashtextextended(p.id::text || coalesce(p_seed, 0)::text, 0)) % 1000) / 1000.0) as score
              from public.posts p
             where p.status = 'published' and p.group_id is null and p.created_at > now() - interval '45 days'
             order by p.created_at desc
             limit 400
          ) s
      ) r
      order by final desc, created_at desc
      offset v_offset limit v_limit);
  end if;

  return coalesce((
    select jsonb_agg(public.feed_post_json(p) order by array_position(v_ids, p.id))
      from public.posts p where p.id = any (v_ids)
  ), '[]'::jsonb);
end $$;
revoke all on function public.feed_page(text, int, int, text, int, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.feed_page(text, int, int, text, int, uuid, uuid, text, uuid) to authenticated;

-- Jobs and people worth a look, next to the feed. One call.
create or replace function public.feed_suggestions()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); v_jobs jsonb := '[]'::jsonb; v_people jsonb;
begin
  if me is null or not public.is_active_user() then return jsonb_build_object('jobs', '[]'::jsonb, 'people', '[]'::jsonb); end if;
  if public.my_role() = 'candidate' then
    select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'location', o.location, 'type', o.type, 'company', c.name, 'logo_path', c.logo_path, 'score', r.score, 'reason', r.reason) order by r.score desc), '[]'::jsonb)
      into v_jobs
      from public.recommended_opportunities(4) r
      join public.opportunities o on o.id = r.opportunity_id
      join public.companies c on c.id = o.company_id;
  end if;
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_people
    from (select id, full_name, role, headline, company_name, verified_badge, open_to_work, avatar_path, reason from public.people_you_may_know(4)) x;
  return jsonb_build_object('jobs', v_jobs, 'people', v_people);
end $$;
revoke all on function public.feed_suggestions() from public, anon;
grant execute on function public.feed_suggestions() to authenticated;
