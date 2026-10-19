-- =====================================================================================
-- Mukana · 0016 · Reach and learning
--   events / webinars / career fairs, interest groups, learning resources, skill quizzes and badges,
--   mentorship, project portfolios on profiles, platform analytics.
-- =====================================================================================

-- ------------------------------------------------------------------ events, webinars, career fairs
create type public.event_kind as enum ('event', 'webinar', 'career_fair');

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  kind        public.event_kind not null default 'event',
  title       text not null check (char_length(title) between 3 and 160),
  description text check (description is null or char_length(description) <= 4000),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  location    text check (location is null or char_length(location) <= 160),
  online_url  text check (online_url is null or online_url ~* '^https?://'),
  host_id     uuid references public.profiles (id) on delete set null,
  company_id  uuid references public.companies (id) on delete set null,
  capacity    int check (capacity is null or capacity between 1 and 100000),
  status      text not null default 'published' check (status in ('published', 'cancelled')),
  created_at  timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index events_starts_idx on public.events (starts_at) where status = 'published';
create table public.event_rsvps (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create table public.event_exhibitors (
  event_id   uuid not null references public.events (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, company_id)
);
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_exhibitors enable row level security;
create policy events_public_select on public.events for select to anon, authenticated
  using (status = 'published' or host_id = auth.uid() or public.is_admin());
create policy event_rsvps_own on public.event_rsvps for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy event_exhibitors_select on public.event_exhibitors for select to anon, authenticated using (true);
-- Writes happen through the functions below.

create or replace function public.create_event(
  p_kind public.event_kind, p_title text, p_description text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_location text, p_online_url text, p_capacity int default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_company uuid;
begin
  if not public.is_active_user() or not public.email_is_verified() then raise exception 'Verify your email address first'; end if;
  if public.is_admin() then
    v_company := null;
  elsif public.my_role() = 'employer' then
    v_company := public.acting_company_id();
    if v_company is null or not exists (select 1 from public.companies where id = v_company and verification_status = 'approved' and not suspended) then
      raise exception 'Only verified companies can host events';
    end if;
  else
    raise exception 'Only verified employers and Mukana administrators can host events';
  end if;
  if p_starts_at < now() - interval '1 hour' then raise exception 'The start time is in the past'; end if;
  if (select count(*) from public.events where host_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You have created many events today. Please try again tomorrow.';
  end if;
  if coalesce(trim(p_location), '') = '' and coalesce(trim(p_online_url), '') = '' then raise exception 'Add a venue or an online link'; end if;
  insert into public.events (kind, title, description, starts_at, ends_at, location, online_url, host_id, company_id, capacity)
  values (p_kind, trim(p_title), nullif(trim(coalesce(p_description, '')), ''), p_starts_at, p_ends_at,
          nullif(trim(coalesce(p_location, '')), ''), nullif(trim(coalesce(p_online_url, '')), ''), auth.uid(), v_company, p_capacity)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_event(public.event_kind, text, text, timestamptz, timestamptz, text, text, int) from public, anon;
grant execute on function public.create_event(public.event_kind, text, text, timestamptz, timestamptz, text, text, int) to authenticated;

create or replace function public.cancel_event(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  update public.events set status = 'cancelled' where id = p_id and status = 'published' and (host_id = auth.uid() or public.is_admin());
  if not found then raise exception 'Event not found'; end if;
  for v_user in select user_id from public.event_rsvps where event_id = p_id loop
    perform public.notify(v_user, 'system', 'An event you joined was cancelled', (select title from public.events where id = p_id), '/events/' || p_id, '{}'::jsonb, 'event-cancel:' || p_id || ':' || v_user);
  end loop;
end $$;
revoke all on function public.cancel_event(uuid) from public, anon;
grant execute on function public.cancel_event(uuid) to authenticated;

create or replace function public.rsvp_event(p_event uuid, p_going boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_ev public.events;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Sign in to join events'; end if;
  select * into v_ev from public.events where id = p_event for update;
  if v_ev.id is null or v_ev.status <> 'published' then raise exception 'This event is not available'; end if;
  if p_going then
    if coalesce(v_ev.ends_at, v_ev.starts_at + interval '3 hours') < now() then raise exception 'This event has ended'; end if;
    if v_ev.capacity is not null and (select count(*) from public.event_rsvps where event_id = p_event) >= v_ev.capacity
       and not exists (select 1 from public.event_rsvps where event_id = p_event and user_id = auth.uid()) then
      raise exception 'This event is full';
    end if;
    insert into public.event_rsvps (event_id, user_id) values (p_event, auth.uid()) on conflict do nothing;
  else
    delete from public.event_rsvps where event_id = p_event and user_id = auth.uid();
  end if;
end $$;
revoke all on function public.rsvp_event(uuid, boolean) from public, anon;
grant execute on function public.rsvp_event(uuid, boolean) to authenticated;

create or replace function public.exhibit_at_event(p_event uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid := public.acting_company_id();
begin
  if public.my_role() <> 'employer' or v_company is null
     or not exists (select 1 from public.companies where id = v_company and verification_status = 'approved' and not suspended) then
    raise exception 'Only verified companies can exhibit';
  end if;
  if not exists (select 1 from public.events where id = p_event and kind = 'career_fair' and status = 'published') then raise exception 'Career fair not found'; end if;
  if p_on then
    insert into public.event_exhibitors (event_id, company_id) values (p_event, v_company) on conflict do nothing;
  else
    delete from public.event_exhibitors where event_id = p_event and company_id = v_company;
  end if;
end $$;
revoke all on function public.exhibit_at_event(uuid, boolean) from public, anon;
grant execute on function public.exhibit_at_event(uuid, boolean) to authenticated;

-- Events with counts and the caller's own RSVP. Public (visitors can browse and share events).
create or replace function public.list_events(p_kind text default null, p_past boolean default false)
returns table (
  id uuid, kind public.event_kind, title text, description text, starts_at timestamptz, ends_at timestamptz,
  location text, online_url text, capacity int, status text, host_name text, company_name text,
  rsvp_count bigint, going boolean, exhibitors bigint, mine boolean
) language sql stable security definer set search_path = public as $$
  select e.id, e.kind, e.title, e.description, e.starts_at, e.ends_at, e.location, e.online_url, e.capacity, e.status,
         p.full_name, c.name,
         (select count(*) from public.event_rsvps r where r.event_id = e.id),
         exists (select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = auth.uid()),
         (select count(*) from public.event_exhibitors x where x.event_id = e.id),
         e.host_id = auth.uid()
    from public.events e
    left join public.profiles p on p.id = e.host_id
    left join public.companies c on c.id = e.company_id
   where (e.status = 'published' or e.host_id = auth.uid() or public.is_admin())
     and (p_kind is null or p_kind = '' or e.kind::text = p_kind)
     and (case when p_past then coalesce(e.ends_at, e.starts_at + interval '3 hours') < now()
               else coalesce(e.ends_at, e.starts_at + interval '3 hours') >= now() end)
   order by case when p_past then null else e.starts_at end asc, case when p_past then e.starts_at end desc
   limit 100
$$;
grant execute on function public.list_events(text, boolean) to anon, authenticated;

create or replace function public.event_exhibitor_list(p_event uuid)
returns table (company_id uuid, name text, logo_path text, open_roles bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.logo_path,
         (select count(*) from public.opportunities o where o.company_id = c.id and o.status = 'published' and not o.suspended and o.deadline >= public.harare_today())
    from public.event_exhibitors x join public.companies c on c.id = x.company_id
   where x.event_id = p_event and not c.suspended
   order by c.name
$$;
grant execute on function public.event_exhibitor_list(uuid) to anon, authenticated;

-- ------------------------------------------------------------------ interest groups
create table public.groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 3 and 80),
  description  text check (description is null or char_length(description) <= 500),
  created_by   uuid references public.profiles (id) on delete set null,
  status       text not null default 'active' check (status in ('active', 'removed')),
  created_at   timestamptz not null default now()
);
create unique index groups_name_unique on public.groups (lower(name)) where status = 'active';
create table public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);
alter table public.posts add constraint posts_group_fk foreign key (group_id) references public.groups (id) on delete cascade;
create index posts_group_idx on public.posts (group_id, created_at desc) where group_id is not null;

create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid())
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
create policy groups_select on public.groups for select to authenticated using (public.is_active_user() and (status = 'active' or public.is_admin()));
create policy group_members_select on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id) or public.is_admin());

-- Posts inside a group are for its members (and moderators).
drop policy posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated
  using (public.is_active_user() and not public.is_blocked(auth.uid(), author_id)
         and (status = 'published' or author_id = auth.uid() or public.is_admin())
         and (group_id is null or public.is_group_member(group_id) or public.is_admin()));

create or replace function public.create_group(p_name text, p_description text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_active_user() or not public.email_is_verified() then raise exception 'Verify your email address to create a group'; end if;
  if (select count(*) from public.groups where created_by = auth.uid() and status = 'active') >= 5 then raise exception 'You can create up to 5 groups'; end if;
  begin
    insert into public.groups (name, description, created_by) values (trim(p_name), nullif(trim(coalesce(p_description, '')), ''), auth.uid()) returning id into v_id;
  exception when unique_violation then
    raise exception 'A group with that name already exists';
  end;
  insert into public.group_members (group_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;
revoke all on function public.create_group(text, text) from public, anon;
grant execute on function public.create_group(text, text) to authenticated;

create or replace function public.join_group(p_group uuid, p_join boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Sign in first'; end if;
  if p_join then
    if not exists (select 1 from public.groups where id = p_group and status = 'active') then raise exception 'Group not found'; end if;
    insert into public.group_members (group_id, user_id) values (p_group, auth.uid()) on conflict do nothing;
  else
    if exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid() and role = 'owner') then
      raise exception 'Owners cannot leave. Delete the group instead.';
    end if;
    delete from public.group_members where group_id = p_group and user_id = auth.uid();
  end if;
end $$;
revoke all on function public.join_group(uuid, boolean) from public, anon;
grant execute on function public.join_group(uuid, boolean) to authenticated;

create or replace function public.delete_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid() and role = 'owner')) then
    raise exception 'Only the owner can delete this group';
  end if;
  delete from public.groups where id = p_group;
end $$;
revoke all on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated;

create or replace function public.list_groups(p_q text default null, p_mine boolean default false)
returns table (id uuid, name text, description text, member_count bigint, is_member boolean, is_owner boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.description,
         (select count(*) from public.group_members m where m.group_id = g.id),
         public.is_group_member(g.id),
         exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid() and m.role = 'owner')
    from public.groups g
   where auth.uid() is not null and public.is_active_user() and g.status = 'active'
     and (p_q is null or trim(p_q) = '' or g.name ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%' or g.description ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%')
     and (not p_mine or public.is_group_member(g.id))
   order by 4 desc, g.name
   limit 60
$$;
revoke all on function public.list_groups(text, boolean) from public, anon;
grant execute on function public.list_groups(text, boolean) to authenticated;

drop function public.create_post(text, jsonb, uuid);
create or replace function public.create_post(p_body text, p_media jsonb default '[]'::jsonb, p_repost_of uuid default null, p_group_id uuid default null)
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

  if p_group_id is not null then
    if p_repost_of is not null then raise exception 'Reposts are not available inside groups'; end if;
    if not public.is_group_member(p_group_id) then raise exception 'Join the group to post in it'; end if;
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

  insert into public.posts (author_id, body, repost_of, group_id) values (v_user, v_body, v_root, p_group_id) returning id into v_id;
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
revoke all on function public.create_post(text, jsonb, uuid, uuid) from public, anon;
grant execute on function public.create_post(text, jsonb, uuid, uuid) to authenticated;

-- ------------------------------------------------------------------ learning resources
create table public.resources (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('career_guidance', 'interview_prep', 'cv_and_applications', 'workplace_skills', 'digital_skills')),
  title      text not null check (char_length(title) between 3 and 160),
  summary    text check (summary is null or char_length(summary) <= 300),
  body       text not null check (char_length(body) between 10 and 20000),
  audience   text not null default 'all' check (audience in ('all', 'attachee', 'graduate_trainee')),
  language   text not null default 'en' check (language in ('en', 'sn', 'nd')),
  published  boolean not null default true,
  position   int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger resources_updated before update on public.resources for each row execute function public.set_updated_at();
alter table public.resources enable row level security;
create policy resources_public_select on public.resources for select to anon, authenticated using (published or public.is_admin());
create policy resources_admin_write on public.resources for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.resources (kind, title, summary, body, audience, position) values ('cv_and_applications', 'Write a CV that gets read', 'A one-page structure that works for attachment and graduate applications.', '## Keep it to one or two pages
Employers in Zimbabwe often read hundreds of CVs. Put the most useful information on the first page.

## What to include
- Your name, phone number and a professional email address
- A two-line summary of who you are and what you are looking for
- Education: institution, programme, year or level, and any results you are proud of
- Skills that match the advert (for example Excel, AutoCAD, Python, customer service)
- Projects, volunteering and short courses
- Two referees, with their permission

## Common mistakes
- A casual email address or no phone number
- Long paragraphs instead of short bullet points
- Sending the same CV for every role without checking the requirements

Use the CV builder in Mukana to create a clean PDF in a few minutes.', 'all', 1);
insert into public.resources (kind, title, summary, body, audience, position) values ('interview_prep', 'Prepare for your first interview', 'What to expect, how to answer and what to ask.', '## Before the day
- Read the advert again and note three skills they asked for
- Learn what the company does and who its customers are
- Plan how you will get there and arrive 15 minutes early, or test your internet for a virtual interview

## Common questions
- Tell us about yourself (60 seconds: studies, skills, why this role)
- Why do you want to work here?
- Tell us about a time you worked in a team
- What is one thing you would like to learn from us?

## A simple way to answer: SAR
- Situation: what was happening
- Action: what you did
- Result: what changed because of it

## Ask questions
Good questions: What would a successful first month look like? Who would I work with? What training do you provide?

## After the interview
Send a short thank-you message the same day. It is polite and it is remembered.', 'all', 2);
insert into public.resources (kind, title, summary, body, audience, position) values ('career_guidance', 'Choosing your next step after campus', 'Attachment, graduate training, further study or self-employment.', '## Industrial attachment
Attachment gives you practical experience while you are still studying. Start looking early, apply to several organisations and keep your placement letter ready.

## Graduate trainee programmes
Many companies run structured programmes for new graduates. Look for rotations, mentorship and a clear route to a permanent role.

## Further study
Consider a postgraduate programme if your field values it. Speak to lecturers and alumni about funding options.

## Working for yourself
If you have a skill people pay for, start small while you apply for roles. Build a portfolio of projects you can show.

## Questions to ask yourself
- What did I enjoy most in my studies and on placement?
- Which skills do I want to be known for in three years?
- Who can advise me? Use Mukana''s mentors and your network.', 'all', 3);
insert into public.resources (kind, title, summary, body, audience, position) values ('workplace_skills', 'Your first weeks on placement', 'Habits that make supervisors want to keep you.', '## Show up and be reliable
Be on time, tell your supervisor early if something changes, and finish what you start.

## Learn how the team works
Ask who to report to, what tools are used and how work is shared. Take notes.

## Ask for feedback
At the end of the first week and again each month ask: What is one thing I can do better?

## Keep a logbook
Write down what you did each day. It makes your attachment report easy and shows your growth.

## Build your reputation
Be helpful, respectful and curious. Many graduate offers come from people who were good interns.', 'attachee', 4);
insert into public.resources (kind, title, summary, body, audience, position) values ('digital_skills', 'Stay safe online while job hunting', 'Spot scams and protect your accounts.', '## Never pay to get a job
Genuine employers do not charge for interviews, uniforms or training before you start. Report any advert that asks for money.

## Protect your accounts
- Use a different strong password for each important account
- Turn on two-factor authentication in your Mukana settings
- Never share one-time PINs with anyone

## Check before you click
Look at the sender''s address and the website address. If something feels rushed or too good to be true, stop and ask someone you trust.

## Report problems
Use the Report option on any opportunity, company or member that looks suspicious. Moderators review reports.', 'all', 5);

-- ------------------------------------------------------------------ skill quizzes and digital badges
create table public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  skill       text not null check (char_length(skill) between 2 and 60),
  title       text not null check (char_length(title) between 3 and 120),
  description text check (description is null or char_length(description) <= 300),
  pass_mark   int not null default 70 check (pass_mark between 1 and 100),
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);
create table public.quiz_questions (
  id       uuid primary key default gen_random_uuid(),
  quiz_id  uuid not null references public.quizzes (id) on delete cascade,
  position int not null,
  question text not null,
  options  text[] not null check (cardinality(options) between 2 and 5),
  correct  int not null check (correct >= 0),
  unique (quiz_id, position)
);
create table public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.quizzes (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  score      int not null,
  passed     boolean not null,
  created_at timestamptz not null default now()
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, quiz_id, created_at desc);
create table public.user_badges (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  quiz_id   uuid not null references public.quizzes (id) on delete cascade,
  skill     text not null,
  title     text not null,
  score     int not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, quiz_id)
);
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;  -- no policies: answers never leave the database
alter table public.quiz_attempts enable row level security;
alter table public.user_badges enable row level security;
create policy quizzes_select on public.quizzes for select to authenticated using (published or public.is_admin());
create policy quiz_attempts_own on public.quiz_attempts for select to authenticated using (user_id = auth.uid());
create policy user_badges_own on public.user_badges for select to authenticated using (user_id = auth.uid());

insert into public.quizzes (id, skill, title, description) values ('00000000-0000-4000-8000-000000000010', 'Microsoft Excel', 'Excel basics', 'Formulas, cell references and charts every workplace expects.');
insert into public.quiz_questions (quiz_id, position, question, options, correct) values
  ('00000000-0000-4000-8000-000000000010', 1, 'Which symbol must a formula start with in Excel?', array['#', '=', '@', '$'], 1),
  ('00000000-0000-4000-8000-000000000010', 2, 'Which formula adds the values in cells A1 to A5?', array['=ADD(A1:A5)', '=SUM(A1:A5)', '=TOTAL(A1,A5)', '=PLUS(A1:A5)'], 1),
  ('00000000-0000-4000-8000-000000000010', 3, 'What does the reference $A$1 mean?', array['The cell moves when you copy the formula', 'Both the column and the row stay fixed when you copy the formula', 'Only the column stays fixed', 'A currency amount'], 1),
  ('00000000-0000-4000-8000-000000000010', 4, 'Which function returns the average of a range?', array['MEAN()', 'AVERAGE()', 'MID()', 'MEDIAN() only'], 1),
  ('00000000-0000-4000-8000-000000000010', 5, 'What does =IF(B2>=50,"Pass","Fail") show when B2 is 49?', array['Pass', 'Fail', '49', 'An error'], 1),
  ('00000000-0000-4000-8000-000000000010', 6, 'Which tool quickly summarises a large table by categories?', array['Spell check', 'PivotTable', 'Freeze Panes', 'Find and Replace'], 1),
  ('00000000-0000-4000-8000-000000000010', 7, 'Which chart type is best for showing a share of a whole?', array['Pie chart', 'Scatter plot', 'Radar chart', 'Stock chart'], 0),
  ('00000000-0000-4000-8000-000000000010', 8, 'What does VLOOKUP do?', array['Looks up a value in the first column of a table and returns a value from another column', 'Sorts a column alphabetically', 'Counts blank cells', 'Joins two workbooks'], 0);

insert into public.quizzes (id, skill, title, description) values ('00000000-0000-4000-8000-000000000011', 'Workplace professionalism', 'Professionalism at work', 'Punctuality, communication and teamwork on placement.');
insert into public.quiz_questions (quiz_id, position, question, options, correct) values
  ('00000000-0000-4000-8000-000000000011', 1, 'You will be late because of transport problems. What is best?', array['Say nothing and hope nobody notices', 'Message your supervisor as early as possible and give an estimated arrival time', 'Stay home without telling anyone', 'Ask a friend to clock you in'], 1),
  ('00000000-0000-4000-8000-000000000011', 2, 'A supervisor gives instructions you do not fully understand. You should:', array['Guess so you do not look unsure', 'Politely ask questions or repeat the task back to confirm', 'Wait for someone else to do it', 'Do something similar that you know'], 1),
  ('00000000-0000-4000-8000-000000000011', 3, 'Which is the best way to write a work email?', array['All capital letters so it is clear', 'A clear subject, a polite greeting, short paragraphs and a closing', 'Text-message slang with emojis', 'No greeting to save time'], 1),
  ('00000000-0000-4000-8000-000000000011', 4, 'Company information you see while on attachment should be:', array['Shared on social media if it is interesting', 'Treated as confidential unless you are allowed to share it', 'Sent to friends for advice', 'Copied to your phone'], 1),
  ('00000000-0000-4000-8000-000000000011', 5, 'You make a mistake that affects a colleague''s work. You should:', array['Hide it', 'Tell them and your supervisor quickly and help fix it', 'Blame the system', 'Wait until someone finds it'], 1),
  ('00000000-0000-4000-8000-000000000011', 6, 'Which dress code is usually right on your first day if you were not told?', array['Smart, neat and modest', 'Beachwear', 'Whatever is most comfortable', 'A party outfit'], 0),
  ('00000000-0000-4000-8000-000000000011', 7, 'How should you handle personal phone use at work?', array['Scroll whenever you are bored', 'Keep it for breaks unless it is needed for work', 'Take calls at your desk all day', 'Film your colleagues'], 1),
  ('00000000-0000-4000-8000-000000000011', 8, 'What shows initiative on a placement?', array['Waiting to be told every step', 'Asking for extra tasks once your work is done and learning from them', 'Leaving early when it is quiet', 'Only doing what is in your job title'], 1);

insert into public.quizzes (id, skill, title, description) values ('00000000-0000-4000-8000-000000000012', 'Digital safety', 'Digital safety and literacy', 'Passwords, scams and safe online habits.');
insert into public.quiz_questions (quiz_id, position, question, options, correct) values
  ('00000000-0000-4000-8000-000000000012', 1, 'Which is the strongest password?', array['password123', 'Your birthday', 'A long passphrase of unrelated words with numbers and symbols', 'Your name and surname'], 2),
  ('00000000-0000-4000-8000-000000000012', 2, 'You get a message saying you won a prize and must pay a fee to collect it. This is most likely:', array['A real prize', 'A scam', 'A bank notice', 'A job offer'], 1),
  ('00000000-0000-4000-8000-000000000012', 3, 'What is two-factor authentication (2FA)?', array['Using two passwords that are the same', 'A second proof of identity, such as a code from an app, in addition to your password', 'Logging in on two devices', 'A type of antivirus'], 1),
  ('00000000-0000-4000-8000-000000000012', 4, 'Before entering your password on a website you should check that:', array['It has a nice design', 'The address is exactly right and starts with https', 'It loads quickly', 'It has many adverts'], 1),
  ('00000000-0000-4000-8000-000000000012', 5, 'Someone you do not know asks you to share a one-time PIN sent to your phone. You should:', array['Share it, they are trying to help', 'Never share it with anyone', 'Share it only if they say they are from a bank', 'Post it online'], 1),
  ('00000000-0000-4000-8000-000000000012', 6, 'Public Wi-Fi is best used for:', array['Online banking', 'General browsing, avoiding sensitive logins where possible', 'Entering your ID number', 'Sharing passwords'], 1),
  ('00000000-0000-4000-8000-000000000012', 7, 'What should you do with software updates?', array['Ignore them forever', 'Install them, they often fix security problems', 'Delete the app', 'Only update once a year'], 1),
  ('00000000-0000-4000-8000-000000000012', 8, 'A job advert asks for money before an interview. You should:', array['Pay, it is normal', 'Treat it as a likely scam and report it', 'Ask a friend to pay', 'Send your ID as well'], 1);

create or replace function public.list_quizzes()
returns table (id uuid, skill text, title text, description text, question_count bigint, pass_mark int, best_score int, earned boolean)
language sql stable security definer set search_path = public as $$
  select z.id, z.skill, z.title, z.description, (select count(*) from public.quiz_questions q where q.quiz_id = z.id), z.pass_mark,
         (select max(a.score) from public.quiz_attempts a where a.quiz_id = z.id and a.user_id = auth.uid()),
         exists (select 1 from public.user_badges b where b.quiz_id = z.id and b.user_id = auth.uid())
    from public.quizzes z where auth.uid() is not null and z.published order by z.title
$$;
revoke all on function public.list_quizzes() from public, anon;
grant execute on function public.list_quizzes() to authenticated;

create or replace function public.get_quiz(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_quiz public.quizzes;
begin
  select * into v_quiz from public.quizzes where id = p_id and published;
  if v_quiz.id is null or auth.uid() is null then return null; end if;
  return jsonb_build_object('id', v_quiz.id, 'title', v_quiz.title, 'skill', v_quiz.skill, 'pass_mark', v_quiz.pass_mark,
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('position', q.position, 'question', q.question, 'options', to_jsonb(q.options)) order by q.position), '[]'::jsonb)
                    from public.quiz_questions q where q.quiz_id = p_id));
end $$;
revoke all on function public.get_quiz(uuid) from public, anon;
grant execute on function public.get_quiz(uuid) to authenticated;

-- Scores a quiz. Only the score and which questions were wrong are returned, never the right answers.
create or replace function public.submit_quiz(p_id uuid, p_answers int[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_quiz public.quizzes; v_total int; v_right int := 0; v_score int; v_passed boolean; v_wrong int[] := '{}'; r record;
begin
  if auth.uid() is null or public.my_role() <> 'candidate' or not public.is_active_user() then raise exception 'Only candidates can take skill quizzes'; end if;
  select * into v_quiz from public.quizzes where id = p_id and published;
  if v_quiz.id is null then raise exception 'Quiz not found'; end if;
  if (select count(*) from public.quiz_attempts where user_id = auth.uid() and quiz_id = p_id and created_at > now() - interval '1 day') >= 3 then
    raise exception 'You can take this quiz 3 times a day. Try again tomorrow.';
  end if;
  select count(*) into v_total from public.quiz_questions where quiz_id = p_id;
  if cardinality(coalesce(p_answers, '{}')) <> v_total then raise exception 'Answer every question'; end if;
  for r in select position, correct from public.quiz_questions where quiz_id = p_id order by position loop
    if p_answers[r.position] = r.correct then v_right := v_right + 1; else v_wrong := v_wrong || r.position; end if;
  end loop;
  v_score := round(100.0 * v_right / greatest(v_total, 1));
  v_passed := v_score >= v_quiz.pass_mark;
  insert into public.quiz_attempts (quiz_id, user_id, score, passed) values (p_id, auth.uid(), v_score, v_passed);
  if v_passed then
    insert into public.user_badges (user_id, quiz_id, skill, title, score) values (auth.uid(), p_id, v_quiz.skill, v_quiz.title, v_score)
    on conflict (user_id, quiz_id) do update set score = greatest(public.user_badges.score, excluded.score);
  end if;
  return jsonb_build_object('score', v_score, 'passed', v_passed, 'pass_mark', v_quiz.pass_mark, 'wrong', to_jsonb(v_wrong));
end $$;
revoke all on function public.submit_quiz(uuid, int[]) from public, anon;
grant execute on function public.submit_quiz(uuid, int[]) to authenticated;

create or replace function public.person_badges(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', b.skill, 'title', b.title, 'score', b.score, 'earned_at', b.earned_at) order by b.earned_at desc), '[]'::jsonb)
    from public.user_badges b where b.user_id = p_user
$$;

-- ------------------------------------------------------------------ mentorship
create table public.mentorship_requests (
  id           uuid primary key default gen_random_uuid(),
  mentee_id    uuid not null references public.profiles (id) on delete cascade,
  mentor_id    uuid not null references public.profiles (id) on delete cascade,
  message      text check (message is null or char_length(message) <= 500),
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  unique (mentee_id, mentor_id),
  check (mentee_id <> mentor_id)
);
alter table public.mentorship_requests enable row level security;
create policy mentorship_select on public.mentorship_requests for select to authenticated using (mentee_id = auth.uid() or mentor_id = auth.uid());

create or replace function public.request_mentorship(p_mentor uuid, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if auth.uid() is null or not public.is_active_user() then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.profiles where id = p_mentor and mentor and status = 'active') or public.is_blocked(auth.uid(), p_mentor) then
    raise exception 'This member is not offering mentorship';
  end if;
  if (select count(*) from public.mentorship_requests where mentee_id = auth.uid() and status = 'pending') >= 5 then
    raise exception 'You have 5 requests waiting for a reply. Please wait for a response first.';
  end if;
  insert into public.mentorship_requests (mentee_id, mentor_id, message) values (auth.uid(), p_mentor, nullif(left(trim(coalesce(p_message, '')), 500), ''))
  on conflict (mentee_id, mentor_id) do update set status = 'pending', message = excluded.message, created_at = now(), responded_at = null
    where public.mentorship_requests.status = 'declined'
  returning id into v_id;
  if v_id is null then raise exception 'You already have a mentorship request with this person'; end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  perform public.notify(p_mentor, 'network', coalesce(nullif(v_name, ''), 'Someone') || ' asked you to be their mentor', coalesce(p_message, ''), '/mentors', jsonb_build_object('request_id', v_id), 'mentor:' || v_id || ':' || extract(epoch from now())::bigint);
  return v_id;
end $$;
revoke all on function public.request_mentorship(uuid, text) from public, anon;
grant execute on function public.request_mentorship(uuid, text) to authenticated;

create or replace function public.respond_mentorship(p_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.mentorship_requests; v_key text; v_conv uuid; v_name text;
begin
  select * into r from public.mentorship_requests where id = p_id and mentor_id = auth.uid() and status = 'pending';
  if r.id is null then raise exception 'Request not found'; end if;
  update public.mentorship_requests set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = p_id;
  select full_name into v_name from public.profiles where id = auth.uid();
  if p_accept then
    v_key := least(r.mentee_id::text, r.mentor_id::text) || ':' || greatest(r.mentee_id::text, r.mentor_id::text);
    select id into v_conv from public.conversations where direct_key = v_key;
    if v_conv is null then
      insert into public.conversations (is_group, direct_key, created_by) values (false, v_key, auth.uid()) returning id into v_conv;
      insert into public.conversation_members (conversation_id, user_id) values (v_conv, r.mentee_id), (v_conv, r.mentor_id);
    end if;
    perform public.notify(r.mentee_id, 'network', coalesce(nullif(v_name, ''), 'Your mentor') || ' accepted your mentorship request', 'You can now chat with them.', '/messages/' || v_conv, '{}'::jsonb, null);
  else
    perform public.notify(r.mentee_id, 'network', 'Mentorship request update', coalesce(nullif(v_name, ''), 'The mentor') || ' is not able to mentor you right now. You can ask another mentor.', '/mentors', '{}'::jsonb, null);
  end if;
  return v_conv;
end $$;
revoke all on function public.respond_mentorship(uuid, boolean) from public, anon;
grant execute on function public.respond_mentorship(uuid, boolean) to authenticated;

create or replace function public.list_mentors(p_topic text default null)
returns table (id uuid, full_name text, headline text, mentor_topics text[], avatar_path text, verified_badge boolean, request_status text)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.full_name,
         coalesce(pr.headline, nullif(concat_ws(' · ', coalesce(cp.programme, cp.qualification), cp.institution), ''), c.name),
         pr.mentor_topics, pr.avatar_path, pr.verified_badge,
         (select r.status from public.mentorship_requests r where r.mentee_id = auth.uid() and r.mentor_id = pr.id)
    from public.profiles pr
    left join public.candidate_profiles cp on cp.user_id = pr.id
    left join public.companies c on c.owner_id = pr.id and not c.suspended
   where auth.uid() is not null and public.is_active_user() and pr.mentor and pr.status = 'active' and pr.id <> auth.uid()
     and not public.is_blocked(auth.uid(), pr.id)
     and (p_topic is null or trim(p_topic) = '' or exists (select 1 from unnest(coalesce(pr.mentor_topics, '{}')) t where t ilike '%' || replace(replace(trim(p_topic), '%', ''), '_', '') || '%')
          or pr.full_name ilike '%' || replace(replace(trim(p_topic), '%', ''), '_', '') || '%')
   order by pr.verified_badge desc, pr.full_name
   limit 60
$$;
revoke all on function public.list_mentors(text) from public, anon;
grant execute on function public.list_mentors(text) to authenticated;

create or replace function public.my_mentorship_requests()
returns table (id uuid, other_id uuid, other_name text, direction text, message text, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, o.id, o.full_name, case when r.mentor_id = auth.uid() then 'received' else 'sent' end, r.message, r.status, r.created_at
    from public.mentorship_requests r join public.profiles o on o.id = case when r.mentor_id = auth.uid() then r.mentee_id else r.mentor_id end
   where (r.mentor_id = auth.uid() or r.mentee_id = auth.uid()) and o.status = 'active'
   order by r.created_at desc limit 50
$$;
revoke all on function public.my_mentorship_requests() from public, anon;
grant execute on function public.my_mentorship_requests() to authenticated;

-- ------------------------------------------------------------------ profile page: projects (portfolio) and badges
create or replace function public.get_person(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  pr public.profiles; cp public.candidate_profiles; co public.companies;
  v_connected boolean; v_full boolean; v_conn public.connections;
begin
  if me is null or not public.is_active_user() then return null; end if;
  select * into pr from public.profiles where id = p_id and status = 'active';
  if pr.id is null or public.is_blocked(me, p_id) then return null; end if;
  v_connected := public.are_connected(me, p_id);
  v_full := me = p_id or public.is_admin() or pr.profile_visibility = 'members' or v_connected;
  select * into cp from public.candidate_profiles where user_id = p_id;
  select * into co from public.companies where owner_id = p_id and not suspended;
  select * into v_conn from public.connections where (requester_id = me and addressee_id = p_id) or (requester_id = p_id and addressee_id = me);

  return jsonb_build_object(
    'id', pr.id, 'full_name', pr.full_name, 'role', pr.role, 'avatar_path', pr.avatar_path, 'cover_path', pr.cover_path,
    'headline', coalesce(pr.headline, case when pr.role = 'candidate' then nullif(concat_ws(' · ', coalesce(cp.programme, cp.qualification), cp.institution), '') end),
    'verified_badge', pr.verified_badge, 'open_to_work', pr.open_to_work and v_full, 'mentor', pr.mentor, 'mentor_topics', pr.mentor_topics,
    'limited', not v_full,
    'company', case when co.id is not null then jsonb_build_object('id', co.id, 'name', co.name, 'verified', co.verification_status = 'approved') end,
    'bio', case when v_full then cp.bio end,
    'projects', case when v_full then coalesce(cp.projects, '[]'::jsonb) else '[]'::jsonb end,
    'institution', case when v_full then cp.institution end,
    'province', case when v_full then cp.province end,
    'candidate_type', case when v_full then cp.candidate_type end,
    'skills', case when v_full and cp.user_id is not null then
        (select coalesce(jsonb_agg(jsonb_build_object('name', s,
            'endorsements', (select count(*) from public.skill_endorsements e where e.profile_id = p_id and lower(e.skill) = lower(s)),
            'endorsed_by_me', exists (select 1 from public.skill_endorsements e where e.profile_id = p_id and lower(e.skill) = lower(s) and e.endorser_id = me))), '[]'::jsonb)
           from unnest(cp.skills) s) else '[]'::jsonb end,
    'recommendations', case when v_full then
        (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'author_id', r.author_id, 'author_name', a.full_name, 'author_headline', a.headline, 'body', r.body, 'created_at', r.created_at) order by r.created_at desc), '[]'::jsonb)
           from public.recommendations r join public.profiles a on a.id = r.author_id
          where r.recipient_id = p_id and (r.status = 'visible' or (me = p_id and r.status = 'pending'))) else '[]'::jsonb end,
    'badges', case when v_full then public.person_badges(p_id) else '[]'::jsonb end,
    'connections', (select count(*) from public.connections c where c.status = 'accepted' and (c.requester_id = p_id or c.addressee_id = p_id)),
    'followers', (select count(*) from public.follows f where f.followee_id = p_id),
    'relation', jsonb_build_object(
      'self', me = p_id,
      'connected', v_connected,
      'pending_sent', v_conn.id is not null and v_conn.status = 'pending' and v_conn.requester_id = me,
      'pending_received', v_conn.id is not null and v_conn.status = 'pending' and v_conn.addressee_id = me,
      'connection_id', v_conn.id,
      'following', exists (select 1 from public.follows where follower_id = me and followee_id = p_id),
      'can_message', public.can_message(me, p_id)));
end $$;

-- ------------------------------------------------------------------ platform analytics (administrators)
create or replace function public.platform_analytics(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_days int := greatest(7, least(coalesce(p_days, 30), 180));
begin
  perform public.require_admin();
  return jsonb_build_object(
    'totals', jsonb_build_object(
      'members', (select count(*) from public.profiles where status = 'active'),
      'candidates', (select count(*) from public.profiles where role = 'candidate' and status = 'active'),
      'employers', (select count(*) from public.profiles where role = 'employer' and status = 'active'),
      'opportunities_open', (select count(*) from public.opportunities where status = 'published' and not suspended and deadline >= public.harare_today()),
      'applications', (select count(*) from public.applications),
      'connections', (select count(*) from public.connections where status = 'accepted'),
      'posts', (select count(*) from public.posts where status = 'published'),
      'messages', (select count(*) from public.messages),
      'badges', (select count(*) from public.user_badges)),
    'series', jsonb_build_object(
      'signups', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', n) order by d), '[]'::jsonb) from (select created_at::date d, count(*) n from public.profiles where created_at > now() - make_interval(days => v_days) group by 1) x),
      'applications', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', n) order by d), '[]'::jsonb) from (select submitted_at::date d, count(*) n from public.applications where submitted_at > now() - make_interval(days => v_days) group by 1) x),
      'posts', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', n) order by d), '[]'::jsonb) from (select created_at::date d, count(*) n from public.posts where created_at > now() - make_interval(days => v_days) group by 1) x)),
    'top_skills', (select coalesce(jsonb_agg(jsonb_build_object('name', s, 'count', n)), '[]'::jsonb) from (select lower(s) s, count(*) n from public.candidate_profiles cp, unnest(cp.skills) s group by 1 order by 2 desc, 1 limit 10) x),
    'top_institutions', (select coalesce(jsonb_agg(jsonb_build_object('name', i, 'count', n)), '[]'::jsonb) from (select institution i, count(*) n from public.candidate_profiles where institution is not null group by 1 order by 2 desc, 1 limit 8) x),
    'opportunity_types', (select coalesce(jsonb_agg(jsonb_build_object('name', t, 'count', n)), '[]'::jsonb) from (select type::text t, count(*) n from public.opportunities where status = 'published' group by 1 order by 2 desc) x),
    'application_funnel', (select coalesce(jsonb_agg(jsonb_build_object('name', s, 'count', n)), '[]'::jsonb) from (select status::text s, count(*) n from public.applications group by 1 order by 2 desc) x));
end $$;
revoke all on function public.platform_analytics(int) from public, anon;
grant execute on function public.platform_analytics(int) to authenticated;

create or replace function public.get_group(p_id uuid)
returns table (id uuid, name text, description text, member_count bigint, is_member boolean, is_owner boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.description,
         (select count(*) from public.group_members m where m.group_id = g.id),
         public.is_group_member(g.id),
         exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid() and m.role = 'owner')
    from public.groups g
   where g.id = p_id and auth.uid() is not null and public.is_active_user() and (g.status = 'active' or public.is_admin())
$$;
revoke all on function public.get_group(uuid) from public, anon;
grant execute on function public.get_group(uuid) to authenticated;
