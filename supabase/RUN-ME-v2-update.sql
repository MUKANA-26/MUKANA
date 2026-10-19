-- =====================================================================================
-- Mukana · Version 2 update (network, messaging, feed upgrades, jobs and employers, reach and learning, two-step verification)
--
-- HOW TO USE: Supabase Dashboard -> SQL Editor -> New query -> paste ALL of this file -> Run.
-- Run it ONCE on a project that already has migrations 0001-0012 (the earlier set-up and the feed update).
-- It is the same as running migrations 0013 to 0017 in order. Existing data is kept.
-- After it succeeds, deploy the new app version. (Deploy the app AFTER this SQL, not before.)
-- =====================================================================================

-- ############################################################################
-- 0013_network.sql
-- ############################################################################

-- =====================================================================================
-- Mukana · 0013 · Professional network: richer profiles, connections, follows, blocks,
-- private + group messaging, endorsements, recommendations, profile views, people search,
-- privacy settings, user reports.
-- Everything is written through checked functions; tables are read-only for clients except where noted.
-- =====================================================================================

alter type public.notification_type add value if not exists 'network';
alter type public.notification_type add value if not exists 'message';
alter type public.report_target add value if not exists 'user';

-- ------------------------------------------------------------------ profile extras and privacy settings
alter table public.profiles
  add column headline          text check (headline is null or char_length(headline) <= 120),
  add column cover_path        text,
  add column open_to_work      boolean not null default false,
  add column verified_badge    boolean not null default false,
  add column searchable        boolean not null default true,
  add column profile_visibility text not null default 'members' check (profile_visibility in ('members', 'connections')),
  add column messages_from     text not null default 'connections' check (messages_from in ('connections', 'anyone')),
  add column language          text not null default 'en' check (language in ('en', 'sn', 'nd')),
  add column low_data          boolean not null default false,
  add column mentor            boolean not null default false,
  add column mentor_topics     text[] not null default '{}' check (cardinality(mentor_topics) <= 10),
  add column onboarded         boolean not null default true;

-- verified_badge is granted by admins only; cover/avatar must live in the user's own folder.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql set search_path = public as $$
declare v_priv boolean := public.is_admin() or auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin');
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status or new.verified_badge is distinct from old.verified_badge)
     and not v_priv then
    raise exception 'Role, status and verification can only be changed by an administrator';
  end if;
  if new.email is distinct from old.email and not (auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin')) then
    new.email := old.email;
  end if;
  if new.cover_path is not null and split_part(new.cover_path, '/', 1) <> new.id::text then
    raise exception 'Invalid cover photo path';
  end if;
  if new.avatar_path is not null and split_part(new.avatar_path, '/', 1) <> new.id::text then
    raise exception 'Invalid profile photo path';
  end if;
  return new;
end $$;

-- ------------------------------------------------------------------ helpers

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
create policy blocks_select_own on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert_own on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid() and public.is_active_user());
create policy blocks_delete_own on public.blocks for delete to authenticated using (blocker_id = auth.uid());

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create table public.connections (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index connections_pair_unique on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index connections_addressee_idx on public.connections (addressee_id, status);
create index connections_requester_idx on public.connections (requester_id, status);
alter table public.connections enable row level security;
create policy connections_select_own on public.connections for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create or replace function public.member_is_active(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p_id and status = 'active')
$$;

create or replace function public.are_connected(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.connections c where c.status = 'accepted'
                  and ((c.requester_id = a and c.addressee_id = b) or (c.requester_id = b and c.addressee_id = a)))
$$;

-- Blocking removes any connection and follows between the two people.
create or replace function public.blocks_cleanup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.connections
   where (requester_id = new.blocker_id and addressee_id = new.blocked_id) or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  delete from public.follows
   where (follower_id = new.blocker_id and followee_id = new.blocked_id) or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end $$;

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);
alter table public.follows enable row level security;
create policy follows_select_own on public.follows for select to authenticated using (follower_id = auth.uid() or followee_id = auth.uid());
create policy follows_insert_own on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and public.is_active_user() and not public.is_blocked(follower_id, followee_id)
              and public.member_is_active(followee_id));
create policy follows_delete_own on public.follows for delete to authenticated using (follower_id = auth.uid());

create trigger blocks_cleanup_trg after insert on public.blocks for each row execute function public.blocks_cleanup();

create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select full_name into v_name from public.profiles where id = new.follower_id;
  perform public.notify(new.followee_id, 'network', coalesce(nullif(v_name, ''), 'Someone') || ' started following you', '',
    '/people/' || new.follower_id, jsonb_build_object('user_id', new.follower_id), 'follow:' || new.follower_id || ':' || new.followee_id);
  return new;
end $$;
create trigger follows_notify after insert on public.follows for each row execute function public.notify_on_follow();

-- ------------------------------------------------------------------ connection requests
create or replace function public.connect_request(p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_existing public.connections;
  v_id uuid;
  v_name text;
begin
  if me is null or not public.is_active_user() then raise exception 'Sign in first'; end if;
  if not public.email_is_verified() then raise exception 'Verify your email address first'; end if;
  if p_user = me then raise exception 'You cannot connect with yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_user and status = 'active') then raise exception 'Member not found'; end if;
  if public.is_blocked(me, p_user) then raise exception 'You cannot connect with this member'; end if;

  select * into v_existing from public.connections
   where (requester_id = me and addressee_id = p_user) or (requester_id = p_user and addressee_id = me);
  if v_existing.id is not null then
    if v_existing.status = 'accepted' then raise exception 'You are already connected'; end if;
    if v_existing.requester_id = me then raise exception 'Your request is already pending'; end if;
    -- They already asked you: accepting is the natural reply.
    update public.connections set status = 'accepted', responded_at = now() where id = v_existing.id;
    return v_existing.id;
  end if;
  if (select count(*) from public.connections where requester_id = me and created_at > now() - interval '1 day') >= 50 then
    raise exception 'You have sent many requests today. Please try again tomorrow.';
  end if;
  insert into public.connections (requester_id, addressee_id) values (me, p_user) returning id into v_id;
  select full_name into v_name from public.profiles where id = me;
  perform public.notify(p_user, 'network', coalesce(nullif(v_name, ''), 'Someone') || ' wants to connect with you', '',
    '/network?tab=invitations', jsonb_build_object('connection_id', v_id), 'connect:' || v_id);
  return v_id;
end $$;
revoke all on function public.connect_request(uuid) from public, anon;
grant execute on function public.connect_request(uuid) to authenticated;

create or replace function public.connection_respond(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare c public.connections; v_name text;
begin
  select * into c from public.connections where id = p_id and addressee_id = auth.uid() and status = 'pending';
  if c.id is null then raise exception 'Invitation not found'; end if;
  if p_accept then
    update public.connections set status = 'accepted', responded_at = now() where id = p_id;
    select full_name into v_name from public.profiles where id = auth.uid();
    perform public.notify(c.requester_id, 'network', coalesce(nullif(v_name, ''), 'Someone') || ' accepted your connection request', '',
      '/people/' || auth.uid(), jsonb_build_object('user_id', auth.uid()), 'accepted:' || p_id);
  else
    delete from public.connections where id = p_id;
  end if;
end $$;
revoke all on function public.connection_respond(uuid, boolean) from public, anon;
grant execute on function public.connection_respond(uuid, boolean) to authenticated;

-- Disconnect, or cancel a pending request you sent.
create or replace function public.connection_remove(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.connections
   where (requester_id = auth.uid() and addressee_id = p_user) or (requester_id = p_user and addressee_id = auth.uid() and status = 'accepted');
end $$;
revoke all on function public.connection_remove(uuid) from public, anon;
grant execute on function public.connection_remove(uuid) to authenticated;

-- ------------------------------------------------------------------ messaging
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  is_group        boolean not null default false,
  title           text check (title is null or char_length(title) between 1 and 80),
  direct_key      text unique,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid references public.profiles (id) on delete set null,
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at desc);

create or replace function public.is_conversation_member(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = p_conv and user_id = auth.uid())
$$;

alter table public.conversations enable row level security;
create policy conversations_select on public.conversations for select to authenticated using (public.is_conversation_member(id));
alter table public.conversation_members enable row level security;
create policy conversation_members_select on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));
alter table public.messages enable row level security;
create policy messages_select on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));

-- May `me` start a direct chat with `other`? Connections, people who allow messages from anyone,
-- and employer <-> applicant pairs (either side).
create or replace function public.can_message(me uuid, other uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if me = other or public.is_blocked(me, other) then return false; end if;
  if public.are_connected(me, other) then return true; end if;
  if exists (select 1 from public.profiles where id = other and status = 'active' and messages_from = 'anyone') then return true; end if;
  if exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id join public.companies c on c.id = o.company_id
     where (a.candidate_id = other and c.owner_id = me) or (a.candidate_id = me and c.owner_id = other)
  ) then return true; end if;
  return false;
end $$;

create or replace function public.start_direct_conversation(p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_key text; v_id uuid;
begin
  if me is null or not public.is_active_user() then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.profiles where id = p_user and status = 'active') then raise exception 'Member not found'; end if;
  if not public.can_message(me, p_user) then
    raise exception 'You can message this member after you connect with them';
  end if;
  v_key := least(me::text, p_user::text) || ':' || greatest(me::text, p_user::text);
  select id into v_id from public.conversations where direct_key = v_key;
  if v_id is null then
    insert into public.conversations (is_group, direct_key, created_by) values (false, v_key, me) returning id into v_id;
    insert into public.conversation_members (conversation_id, user_id) values (v_id, me), (v_id, p_user);
  end if;
  return v_id;
end $$;
revoke all on function public.start_direct_conversation(uuid) from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

create or replace function public.create_group_chat(p_title text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_id uuid; v_user uuid; v_title text := left(trim(coalesce(p_title, '')), 80);
begin
  if me is null or not public.is_active_user() then raise exception 'Sign in first'; end if;
  if v_title = '' then raise exception 'Give the group chat a name'; end if;
  if cardinality(coalesce(p_members, '{}')) < 1 or cardinality(p_members) > 19 then raise exception 'Choose 1 to 19 people'; end if;
  foreach v_user in array p_members loop
    if v_user = me or not public.are_connected(me, v_user) then raise exception 'You can only add people you are connected with'; end if;
  end loop;
  insert into public.conversations (is_group, title, created_by) values (true, v_title, me) returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id) select v_id, x from unnest(p_members || me) as x;
  return v_id;
end $$;
revoke all on function public.create_group_chat(text, uuid[]) from public, anon;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;

create or replace function public.add_group_member(p_conv uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.conversations where id = p_conv and is_group and created_by = auth.uid()) then
    raise exception 'Only the person who created the group can add people';
  end if;
  if not public.are_connected(auth.uid(), p_user) then raise exception 'You can only add people you are connected with'; end if;
  if (select count(*) from public.conversation_members where conversation_id = p_conv) >= 20 then raise exception 'A group chat can have up to 20 people'; end if;
  insert into public.conversation_members (conversation_id, user_id) values (p_conv, p_user) on conflict do nothing;
end $$;
revoke all on function public.add_group_member(uuid, uuid) from public, anon;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;

create or replace function public.leave_conversation(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.conversation_members where conversation_id = p_conv and user_id = auth.uid()
    and exists (select 1 from public.conversations c where c.id = p_conv and c.is_group);
end $$;
revoke all on function public.leave_conversation(uuid) from public, anon;
grant execute on function public.leave_conversation(uuid) to authenticated;

create or replace function public.send_message(p_conv uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); v_body text := left(trim(coalesce(p_body, '')), 2000);
  v_id uuid; v_conv public.conversations; v_other record; v_name text;
begin
  if me is null or not public.is_active_user() then raise exception 'Sign in first'; end if;
  if v_body = '' then raise exception 'Write a message first'; end if;
  select * into v_conv from public.conversations where id = p_conv;
  if v_conv.id is null or not public.is_conversation_member(p_conv) then raise exception 'Conversation not found'; end if;
  if (select count(*) from public.messages where sender_id = me and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'You are sending messages too fast';
  end if;
  -- In a direct chat, a block ends the conversation.
  if not v_conv.is_group then
    select cm.user_id into v_other from public.conversation_members cm where cm.conversation_id = p_conv and cm.user_id <> me limit 1;
    if v_other.user_id is not null and public.is_blocked(me, v_other.user_id) then raise exception 'You can no longer message this member'; end if;
  end if;
  insert into public.messages (conversation_id, sender_id, body) values (p_conv, me, v_body) returning id into v_id;
  update public.conversations set last_message_at = now() where id = p_conv;
  update public.conversation_members set last_read_at = now() where conversation_id = p_conv and user_id = me;
  select full_name into v_name from public.profiles where id = me;
  -- One notification per conversation until it is read (the dedupe key is cleared by mark_conversation_read).
  for v_other in select user_id from public.conversation_members where conversation_id = p_conv and user_id <> me loop
    perform public.notify(v_other.user_id, 'message',
      case when v_conv.is_group then coalesce(v_conv.title, 'Group chat') else coalesce(nullif(v_name, ''), 'New message') end,
      case when v_conv.is_group then coalesce(nullif(v_name, ''), 'Someone') || ': ' else '' end || left(v_body, 120),
      '/messages/' || p_conv, jsonb_build_object('conversation_id', p_conv), 'msg:' || p_conv || ':' || v_other.user_id);
  end loop;
  return v_id;
end $$;
revoke all on function public.send_message(uuid, text) from public, anon;
grant execute on function public.send_message(uuid, text) to authenticated;

create or replace function public.mark_conversation_read(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.conversation_members set last_read_at = now() where conversation_id = p_conv and user_id = auth.uid();
  delete from public.notifications where dedupe_key = 'msg:' || p_conv || ':' || auth.uid();
end $$;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function public.unread_message_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.conversation_members cm
   where cm.user_id = auth.uid()
     and exists (select 1 from public.messages m where m.conversation_id = cm.conversation_id and m.created_at > cm.last_read_at and m.sender_id is distinct from auth.uid())
$$;
revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated;

create or replace function public.list_conversations()
returns table (id uuid, is_group boolean, title text, other_id uuid, other_name text, other_avatar text, other_headline text,
               member_count int, last_body text, last_at timestamptz, unread boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.is_group, c.title,
         o.user_id, p.full_name, p.avatar_path, p.headline,
         (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
         (select m.body from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
         c.last_message_at,
         exists (select 1 from public.messages m where m.conversation_id = c.id and m.created_at > me.last_read_at and m.sender_id is distinct from auth.uid())
    from public.conversation_members me
    join public.conversations c on c.id = me.conversation_id
    left join lateral (select cm.user_id from public.conversation_members cm where cm.conversation_id = c.id and cm.user_id <> auth.uid() order by cm.joined_at limit 1) o on not c.is_group
    left join public.profiles p on p.id = o.user_id
   where me.user_id = auth.uid()
   order by c.last_message_at desc
   limit 100
$$;
revoke all on function public.list_conversations() from public, anon;
grant execute on function public.list_conversations() to authenticated;

-- ------------------------------------------------------------------ endorsements, recommendations, profile views
create table public.skill_endorsements (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  skill       text not null check (char_length(skill) between 1 and 60),
  endorser_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  check (profile_id <> endorser_id)
);
create unique index skill_endorsements_unique on public.skill_endorsements (profile_id, lower(skill), endorser_id);
create index skill_endorsements_profile_idx on public.skill_endorsements (profile_id);
alter table public.skill_endorsements enable row level security;
create policy skill_endorsements_select on public.skill_endorsements for select to authenticated
  using (public.is_active_user() and not public.is_blocked(auth.uid(), profile_id));

create or replace function public.endorse_skill(p_profile uuid, p_skill text, p_on boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_skill text;
begin
  if me is null or not public.is_active_user() then raise exception 'Sign in first'; end if;
  if not public.are_connected(me, p_profile) then raise exception 'You can endorse skills of people you are connected with'; end if;
  select s into v_skill from public.candidate_profiles cp, unnest(cp.skills) s where cp.user_id = p_profile and lower(s) = lower(p_skill) limit 1;
  if v_skill is null then raise exception 'That skill is not on their profile'; end if;
  if p_on then
    insert into public.skill_endorsements (profile_id, skill, endorser_id) values (p_profile, v_skill, me) on conflict do nothing;
  else
    delete from public.skill_endorsements where profile_id = p_profile and lower(skill) = lower(v_skill) and endorser_id = me;
  end if;
end $$;
revoke all on function public.endorse_skill(uuid, text, boolean) from public, anon;
grant execute on function public.endorse_skill(uuid, text, boolean) to authenticated;

create table public.recommendations (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 20 and 1000),
  status       text not null default 'pending' check (status in ('pending', 'visible', 'hidden')),
  created_at   timestamptz not null default now(),
  unique (author_id, recipient_id),
  check (author_id <> recipient_id)
);
create index recommendations_recipient_idx on public.recommendations (recipient_id, status);
alter table public.recommendations enable row level security;
create policy recommendations_select on public.recommendations for select to authenticated
  using (author_id = auth.uid() or recipient_id = auth.uid() or (status = 'visible' and not public.is_blocked(auth.uid(), recipient_id)));
create policy recommendations_delete_own on public.recommendations for delete to authenticated using (author_id = auth.uid());

create or replace function public.write_recommendation(p_recipient uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_id uuid; v_name text;
begin
  if me is null or not public.is_active_user() then raise exception 'Sign in first'; end if;
  if not public.are_connected(me, p_recipient) then raise exception 'You can recommend people you are connected with'; end if;
  insert into public.recommendations (author_id, recipient_id, body) values (me, p_recipient, left(trim(coalesce(p_body, '')), 1000))
  on conflict (author_id, recipient_id) do update set body = excluded.body, status = 'pending', created_at = now()
  returning id into v_id;
  select full_name into v_name from public.profiles where id = me;
  perform public.notify(p_recipient, 'network', coalesce(nullif(v_name, ''), 'Someone') || ' wrote you a recommendation', 'Review it and choose whether to show it on your profile.',
    '/people/' || p_recipient, jsonb_build_object('recommendation_id', v_id), 'rec:' || v_id || ':' || extract(epoch from now())::bigint);
  return v_id;
end $$;
revoke all on function public.write_recommendation(uuid, text) from public, anon;
grant execute on function public.write_recommendation(uuid, text) to authenticated;

create or replace function public.respond_recommendation(p_id uuid, p_show boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.recommendations set status = case when p_show then 'visible' else 'hidden' end
   where id = p_id and recipient_id = auth.uid();
  if not found then raise exception 'Recommendation not found'; end if;
end $$;
revoke all on function public.respond_recommendation(uuid, boolean) from public, anon;
grant execute on function public.respond_recommendation(uuid, boolean) to authenticated;

create table public.profile_views (
  id        uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_id uuid not null references public.profiles (id) on delete cascade,
  day       date not null default current_date,
  created_at timestamptz not null default now(),
  unique (viewer_id, viewed_id, day)
);
create index profile_views_viewed_idx on public.profile_views (viewed_id, created_at desc);
alter table public.profile_views enable row level security;
-- No policies: read through my_profile_views(), written through record_profile_view().

create or replace function public.record_profile_view(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_id = auth.uid() or public.is_blocked(auth.uid(), p_id) then return; end if;
  insert into public.profile_views (viewer_id, viewed_id) values (auth.uid(), p_id) on conflict do nothing;
end $$;
revoke all on function public.record_profile_view(uuid) from public, anon;
grant execute on function public.record_profile_view(uuid) to authenticated;

create or replace function public.my_profile_views(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'total', (select count(*) from public.profile_views where viewed_id = auth.uid() and created_at > now() - make_interval(days => p_days)),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('id', v.viewer_id, 'name', p.full_name, 'headline', p.headline, 'at', v.created_at) order by v.created_at desc), '[]'::jsonb)
                 from (select * from public.profile_views where viewed_id = auth.uid() order by created_at desc limit 10) v
                 join public.profiles p on p.id = v.viewer_id),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'count', n) order by d), '[]'::jsonb)
                 from (select day as d, count(*) n from public.profile_views where viewed_id = auth.uid() and created_at > now() - make_interval(days => p_days) group by day) x));
end $$;
revoke all on function public.my_profile_views(int) from public, anon;
grant execute on function public.my_profile_views(int) to authenticated;

-- Badges placeholder: redefined in 0016 once skill quizzes exist.
create or replace function public.person_badges(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$ select '[]'::jsonb $$;

-- ------------------------------------------------------------------ who is visible in lists (feed + search)
drop view if exists public.feed_people;
create view public.feed_people as
select pr.id, pr.full_name, pr.role, pr.avatar_path,
       coalesce(pr.headline, case when pr.role = 'candidate'
            then nullif(concat_ws(' · ', coalesce(cp.programme, cp.qualification), cp.institution), '') end) as headline,
       c.id as company_id, c.name as company_name, pr.verified_badge, pr.open_to_work
  from public.profiles pr
  left join public.candidate_profiles cp on cp.user_id = pr.id
  left join public.companies c on c.owner_id = pr.id and not c.suspended
 where pr.status = 'active'
   and (exists (select 1 from public.posts p where p.author_id = pr.id)
     or exists (select 1 from public.post_comments pc where pc.author_id = pr.id)
     or exists (select 1 from public.post_mentions pm where pm.user_id = pr.id)
     or pr.searchable);
revoke all on public.feed_people from anon, public;
grant select on public.feed_people to authenticated;

-- Photos of people who are discoverable (feed participants or searchable) can be shown to members.
create or replace function public.avatar_in_feed(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.feed_people fp where fp.avatar_path = p_name)
      or exists (select 1 from public.profiles pr where pr.cover_path = p_name and pr.status = 'active' and pr.searchable)
$$;

-- ------------------------------------------------------------------ people search and profile cards
drop function if exists public.search_people(text);
create or replace function public.search_people(p_q text, p_limit int default 12)
returns table (id uuid, full_name text, role public.user_role, headline text, company_name text, verified_badge boolean, open_to_work boolean, avatar_path text)
language plpgsql stable security definer set search_path = public as $$
declare q text := trim(coalesce(p_q, ''));
begin
  if auth.uid() is null or not public.is_active_user() or char_length(q) < 2 then return; end if;
  q := replace(replace(q, '%', ''), '_', '');
  return query
    select pr.id, pr.full_name, pr.role,
           coalesce(pr.headline, case when pr.role = 'candidate' then nullif(concat_ws(' · ', coalesce(cp.programme, cp.qualification), cp.institution), '') end),
           c.name, pr.verified_badge, pr.open_to_work, pr.avatar_path
      from public.profiles pr
      left join public.candidate_profiles cp on cp.user_id = pr.id
      left join public.companies c on c.owner_id = pr.id and not c.suspended
     where pr.status = 'active' and pr.role <> 'admin' and pr.id <> auth.uid()
       and not public.is_blocked(auth.uid(), pr.id)
       and (pr.searchable or public.are_connected(auth.uid(), pr.id))
       and (pr.full_name ilike '%' || q || '%' or pr.headline ilike '%' || q || '%' or cp.institution ilike '%' || q || '%'
            or cp.programme ilike '%' || q || '%' or c.name ilike '%' || q || '%'
            or exists (select 1 from unnest(cp.skills) s where s ilike '%' || q || '%'))
     order by (pr.full_name ilike q || '%') desc, pr.full_name
     limit greatest(1, least(p_limit, 30));
end $$;
revoke all on function public.search_people(text, int) from public, anon;
grant execute on function public.search_people(text, int) to authenticated;

create or replace function public.people_you_may_know(p_limit int default 10)
returns table (id uuid, full_name text, role public.user_role, headline text, company_name text, verified_badge boolean, open_to_work boolean, avatar_path text, reason text)
language sql stable security definer set search_path = public as $$
  with me as (select cp.institution from public.candidate_profiles cp where cp.user_id = auth.uid())
  select pr.id, pr.full_name, pr.role,
         coalesce(pr.headline, case when pr.role = 'candidate' then nullif(concat_ws(' · ', coalesce(cp.programme, cp.qualification), cp.institution), '') end),
         c.name, pr.verified_badge, pr.open_to_work, pr.avatar_path,
         case when cp.institution is not null and cp.institution = (select institution from me) then 'Same institution' else 'Active on Mukana' end
    from public.profiles pr
    left join public.candidate_profiles cp on cp.user_id = pr.id
    left join public.companies c on c.owner_id = pr.id and not c.suspended
   where pr.status = 'active' and pr.role <> 'admin' and pr.id <> auth.uid() and pr.searchable
     and not public.is_blocked(auth.uid(), pr.id)
     and not exists (select 1 from public.connections x where (x.requester_id = auth.uid() and x.addressee_id = pr.id) or (x.requester_id = pr.id and x.addressee_id = auth.uid()))
   order by (cp.institution is not null and cp.institution = (select institution from me)) desc, pr.created_at desc
   limit greatest(1, least(p_limit, 30))
$$;
revoke all on function public.people_you_may_know(int) from public, anon;
grant execute on function public.people_you_may_know(int) to authenticated;

create or replace function public.list_connections(p_kind text default 'accepted')
returns table (connection_id uuid, user_id uuid, full_name text, role public.user_role, headline text, company_name text, avatar_path text, verified_badge boolean, direction text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, pr.id, pr.full_name, pr.role,
         coalesce(pr.headline, case when pr.role = 'candidate' then nullif(concat_ws(' · ', coalesce(cp.programme, cp.qualification), cp.institution), '') end),
         co.name, pr.avatar_path, pr.verified_badge,
         case when c.status = 'accepted' then 'connected' when c.requester_id = auth.uid() then 'sent' else 'received' end,
         c.created_at
    from public.connections c
    join public.profiles pr on pr.id = case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end
    left join public.candidate_profiles cp on cp.user_id = pr.id
    left join public.companies co on co.owner_id = pr.id and not co.suspended
   where (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
     and pr.status = 'active'
     and ((p_kind = 'accepted' and c.status = 'accepted')
       or (p_kind = 'received' and c.status = 'pending' and c.addressee_id = auth.uid())
       or (p_kind = 'sent' and c.status = 'pending' and c.requester_id = auth.uid()))
   order by c.created_at desc
   limit 200
$$;
revoke all on function public.list_connections(text) from public, anon;
grant execute on function public.list_connections(text) to authenticated;

-- A member's profile page, shaped by their privacy settings.
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
revoke all on function public.get_person(uuid) from public, anon;
grant execute on function public.get_person(uuid) to authenticated;

-- ------------------------------------------------------------------ feed respects blocks
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated
  using (public.is_active_user() and not public.is_blocked(auth.uid(), author_id)
         and (status = 'published' or author_id = auth.uid() or public.is_admin()));
drop policy if exists post_comments_select on public.post_comments;
create policy post_comments_select on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id)
         and not public.is_blocked(auth.uid(), author_id)
         and (status = 'published' or author_id = auth.uid() or public.is_admin()));

-- ------------------------------------------------------------------ reporting people, admin verification badge
alter table public.reports add column user_id uuid references public.profiles (id) on delete cascade;
alter table public.reports drop constraint report_has_one_target;
alter table public.reports add constraint report_has_one_target check (
  (target_type::text = 'opportunity' and opportunity_id is not null and company_id is null and post_id is null and user_id is null) or
  (target_type::text = 'company'     and company_id is not null and opportunity_id is null and post_id is null and user_id is null) or
  (target_type::text = 'post'        and post_id is not null and opportunity_id is null and company_id is null and user_id is null) or
  (target_type::text = 'user'        and user_id is not null and opportunity_id is null and company_id is null and post_id is null));
drop index public.reports_one_open_per_target;
create unique index reports_one_open_per_target on public.reports (reporter_id, coalesce(opportunity_id, company_id, post_id, user_id)) where status = 'open';

create or replace function public.admin_set_verified(p_user uuid, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.profiles set verified_badge = p_value where id = p_user;
  if not found then raise exception 'User not found'; end if;
  perform public.audit(case when p_value then 'user.verify' else 'user.unverify' end, 'user', p_user, '{}'::jsonb);
end $$;
revoke all on function public.admin_set_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

-- ------------------------------------------------------------------ realtime for chat
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------------ OAuth sign-ups (e.g. Google) need no metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_role public.user_role;
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_oauth boolean := coalesce(new.raw_app_meta_data ->> 'provider', 'email') <> 'email';
begin
  -- Email sign-ups must carry explicit consent. OAuth sign-ups (the sign-in screen states that continuing means
  -- agreeing to the Terms and Privacy Policy) are treated as consent and finish role selection at /welcome.
  if not v_oauth and coalesce(v_meta ->> 'consent', 'false') <> 'true' then
    raise exception 'Consent to the Privacy Policy and Terms is required to create an account';
  end if;

  v_role := case when v_meta ->> 'role' = 'employer' then 'employer'::public.user_role else 'candidate'::public.user_role end;

  insert into public.profiles (id, role, full_name, email, phone, onboarded)
  values (new.id, v_role,
          left(coalesce(nullif(trim(v_meta ->> 'full_name'), ''), nullif(trim(v_meta ->> 'name'), ''), split_part(new.email, '@', 1)), 120),
          new.email, nullif(trim(v_meta ->> 'phone'), ''), not v_oauth);

  if v_role = 'candidate' then
    insert into public.candidate_profiles (user_id, candidate_type)
    values (new.id, case when v_meta ->> 'candidate_type' = 'graduate_trainee' then 'graduate_trainee'::public.candidate_type else 'attachee'::public.candidate_type end);
  end if;
  if v_role = 'employer' then
    insert into public.companies (owner_id, name) values (new.id, left(coalesce(nullif(trim(v_meta ->> 'company_name'), ''), 'My company'), 160));
  end if;

  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_role::text) where id = new.id;
  return new;
end $$;

-- First-time OAuth users choose what they are (once).
create or replace function public.complete_onboarding(p_role text, p_candidate_type text default 'attachee', p_company_name text default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid(); v_role public.user_role;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from public.profiles where id = me and onboarded) then raise exception 'Your account is already set up'; end if;
  if p_role not in ('candidate', 'employer') then raise exception 'Choose candidate or employer'; end if;
  v_role := p_role::public.user_role;
  update public.profiles set role = v_role, onboarded = true where id = me;
  if v_role = 'candidate' then
    insert into public.candidate_profiles (user_id, candidate_type) values (me, case when p_candidate_type = 'graduate_trainee' then 'graduate_trainee'::public.candidate_type else 'attachee'::public.candidate_type end)
    on conflict (user_id) do update set candidate_type = excluded.candidate_type;
    delete from public.companies where owner_id = me;
  else
    delete from public.candidate_profiles where user_id = me;
    insert into public.companies (owner_id, name) values (me, left(coalesce(nullif(trim(p_company_name), ''), 'My company'), 160))
    on conflict (owner_id) do update set name = excluded.name;
  end if;
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_role::text) where id = me;
end $$;
revoke all on function public.complete_onboarding(text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text) to authenticated;


-- ############################################################################
-- 0014_feed_upgrades.sql
-- ############################################################################

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


-- ############################################################################
-- 0015_jobs_employers.sql
-- ############################################################################

-- =====================================================================================
-- Mukana · 0015 · Jobs and employers
--   internship + entry-level opportunity types, job alerts, weekly digest, notification categories,
--   hiring teams (several recruiters per company), candidate search, talent shortlist,
--   invitations to apply and recommended candidates.
-- =====================================================================================

alter type public.opportunity_type add value if not exists 'internship';
alter type public.opportunity_type add value if not exists 'entry_level';
alter type public.notification_type add value if not exists 'job_alert';
alter type public.notification_type add value if not exists 'digest';
alter type public.notification_type add value if not exists 'invitation';

-- ------------------------------------------------------------------ opportunity type helpers (text based: enum values added above cannot be used in this transaction)
-- attachment/internship-style = placement for students (level + attachment dates)
create or replace function public.opp_is_placement(t public.opportunity_type)
returns boolean language sql immutable as $$ select t::text in ('industrial_attachment', 'internship') $$;

-- Attachees fit attachments and internships; graduate trainees fit graduate programmes, entry-level jobs and internships.
create or replace function public.opp_fits_candidate(t public.opportunity_type, c public.candidate_type)
returns boolean language sql immutable as $$
  select case c
    when 'attachee' then t::text in ('industrial_attachment', 'internship')
    else t::text in ('graduate_trainee', 'entry_level', 'internship') end
$$;

create or replace function public.opportunities_before_write()
returns trigger language plpgsql set search_path = public as $$
declare
  v_company public.companies;
  v_privileged boolean := public.is_admin() or auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin');
begin
  -- Normalise type-specific fields.
  if new.type::text = 'industrial_attachment' then
    new.min_qualification := null;
  elsif new.type::text <> 'internship' then
    new.min_level := null;
  end if;
  if new.stipend_type = 'unpaid' then
    new.stipend_amount := null;
    new.stipend_currency := null;
  elsif new.stipend_amount is not null and new.stipend_currency is null then
    new.stipend_currency := 'USD';
  end if;

  new.search_text := lower(concat_ws(' ', new.title, new.department, new.location, new.province,
    array_to_string(new.skills, ' '), array_to_string(new.eligible_fields, ' ')));

  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then raise exception 'An opportunity cannot move to another company'; end if;
    if new.suspended is distinct from old.suspended and not v_privileged then
      raise exception 'Only an administrator can suspend or restore an opportunity';
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not v_privileged then
      select * into v_company from public.companies where id = new.company_id;
      if v_company.verification_status <> 'approved' then
        raise exception 'Your company must be verified before you can publish opportunities';
      end if;
      if v_company.suspended then raise exception 'This company is suspended'; end if;
      if not public.email_is_verified() then
        raise exception 'Verify your email address before publishing';
      end if;
    end if;
    if new.deadline < public.harare_today() then
      raise exception 'The application deadline is in the past';
    end if;
    if new.suspended then raise exception 'This opportunity has been suspended'; end if;
    new.published_at := coalesce(new.published_at, now());
    new.closed_at := null;
  end if;

  if new.status = 'closed' and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    new.closed_at := now();
  end if;
  if new.status = 'draft' and tg_op = 'UPDATE' and old.status <> 'draft' then
    raise exception 'A published opportunity cannot go back to draft; close it instead';
  end if;
  return new;
end $$;

create or replace function public.match_internal(p_candidate uuid, p_opportunity uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.candidate_profiles;
  o public.opportunities;
  -- field
  f_score int := 0; f_reason text;
  cand_field text;
  -- skills
  s_score int := 0; s_reason text;
  req text[]; have text[]; s_total int; s_hit int;
  -- level
  l_score int := 0; l_reason text;
  -- availability
  a_score int := 0; a_reason text;
  o_start date; o_end date; ov_days int; o_days int; frac numeric;
  -- location
  loc_score int := 0; loc_reason text;
  total int;
begin
  select * into c from public.candidate_profiles where user_id = p_candidate;
  select * into o from public.opportunities where id = p_opportunity;
  if c.user_id is null or o.id is null then
    return jsonb_build_object('score', 0, 'reason', 'Not available', 'breakdown', '{}'::jsonb);
  end if;

  -- Candidate type must fit the opportunity type.
  if not public.opp_fits_candidate(o.type, c.candidate_type) then
    return jsonb_build_object(
      'score', 0,
      'reason', case when public.opp_is_placement(o.type) then 'This is an attachment opportunity; your profile is set up as a graduate trainee'
                     else 'This is a graduate trainee programme; your profile is set up as an attachee' end,
      'breakdown', jsonb_build_object(
        'field', jsonb_build_object('score', 0, 'max', 35, 'reason', 'Different opportunity type'),
        'skills', jsonb_build_object('score', 0, 'max', 30, 'reason', 'Different opportunity type'),
        'level', jsonb_build_object('score', 0, 'max', 15, 'reason', 'Different opportunity type'),
        'availability', jsonb_build_object('score', 0, 'max', 15, 'reason', 'Different opportunity type'),
        'location', jsonb_build_object('score', 0, 'max', 5, 'reason', 'Different opportunity type')));
  end if;

  -- ---------------------------------------------------------------- field / programme (35)
  cand_field := lower(trim(coalesce(case when c.candidate_type = 'attachee' then c.programme else c.qualification end, '')));
  if cardinality(o.eligible_fields) = 0 then
    f_score := 35; f_reason := 'Open to all fields of study';
  elsif cand_field = '' then
    f_score := 0; f_reason := 'Add your programme or qualification to see a field match';
  elsif exists (
    select 1 from unnest(o.eligible_fields) f
     where lower(trim(f)) = cand_field
        or (length(trim(f)) >= 4 and cand_field like '%' || lower(trim(f)) || '%')
        or (length(cand_field) >= 4 and lower(trim(f)) like '%' || cand_field || '%')
  ) then
    f_score := 35; f_reason := 'Your field of study matches the eligible programmes';
  elsif exists (
    select 1 from regexp_split_to_table(cand_field, '[^a-z0-9]+') t, unnest(o.eligible_fields) f
     where length(t) > 3 and lower(f) ~ ('\m' || t || '\M')
  ) then
    f_score := 17; f_reason := 'Your field of study is related to the eligible programmes';
  else
    f_score := 0; f_reason := 'Your field of study is not among the eligible programmes';
  end if;

  -- ---------------------------------------------------------------- skills (30)
  select coalesce(array_agg(distinct lower(trim(x))) filter (where trim(x) <> ''), '{}') into req from unnest(o.skills) x;
  select coalesce(array_agg(distinct lower(trim(x))) filter (where trim(x) <> ''), '{}') into have from unnest(c.skills) x;
  s_total := cardinality(req);
  if s_total = 0 then
    s_score := 30; s_reason := 'No specific skills required';
  else
    select count(*) into s_hit from unnest(req) r
     where exists (select 1 from unnest(have) h
                    where h = r
                       or (length(h) >= 3 and length(r) >= 3 and (h like '%' || r || '%' or r like '%' || h || '%')));
    s_score := round(30.0 * s_hit / s_total);
    s_reason := format('Matches %s of %s required skill%s', s_hit, s_total, case when s_total = 1 then '' else 's' end);
  end if;

  -- ---------------------------------------------------------------- level / qualification (15)
  if c.candidate_type = 'attachee' then
    if o.min_level is null then
      l_score := 15; l_reason := 'No minimum level required';
    elsif c.current_level is null then
      l_score := 0; l_reason := 'Add your current level to check eligibility';
    elsif c.current_level >= o.min_level then
      l_score := 15; l_reason := format('Your level (%s) meets the minimum (%s)', c.current_level, o.min_level);
    else
      l_score := 0; l_reason := format('Minimum level is %s; you are at %s', o.min_level, c.current_level);
    end if;
  else
    if o.min_qualification is null then
      l_score := 15; l_reason := 'No minimum qualification required';
    elsif c.qualification_level is null then
      l_score := 0; l_reason := 'Add your qualification level to check eligibility';
    elsif c.qualification_level >= o.min_qualification then
      l_score := 15; l_reason := 'Your qualification meets the minimum';
    else
      l_score := 0; l_reason := format('Minimum qualification is %s', replace(o.min_qualification::text, '_', ' '));
    end if;
  end if;

  -- ---------------------------------------------------------------- availability (15)
  if o.start_date is null then
    a_score := 15; a_reason := 'Flexible start date';
  elsif c.candidate_type = 'attachee' then
    if c.attachment_start is null or c.attachment_end is null then
      a_score := 0; a_reason := 'Add your attachment dates to check availability';
    else
      o_start := o.start_date;
      o_end := (o.start_date + make_interval(months => coalesce(o.duration_months, 3)))::date;
      o_days := greatest(1, o_end - o_start + 1);
      ov_days := greatest(0, least(c.attachment_end, o_end) - greatest(c.attachment_start, o_start) + 1);
      frac := least(1.0, ov_days::numeric / o_days);
      a_score := round(15 * frac);
      a_reason := format('Your attachment dates cover %s%% of this placement', round(frac * 100));
    end if;
  else
    if c.availability_date is null then
      a_score := 0; a_reason := 'Add your availability date';
    elsif c.availability_date <= o.start_date then
      a_score := 15; a_reason := 'You are available by the start date';
    elsif c.availability_date <= o.start_date + 30 then
      a_score := 8; a_reason := 'You are available within 30 days after the start date';
    else
      a_score := 0; a_reason := 'You are available after the start date';
    end if;
  end if;

  -- ---------------------------------------------------------------- location (5)
  if coalesce(trim(c.city), '') <> ''
     and (lower(o.location) like '%' || lower(trim(c.city)) || '%' or lower(trim(c.city)) like '%' || lower(o.location) || '%') then
    loc_score := 5; loc_reason := 'Same city or town';
  elsif coalesce(trim(c.province), '') <> '' and o.province is not null and lower(c.province) = lower(o.province) then
    loc_score := 3; loc_reason := 'Same province';
  else
    loc_score := 0; loc_reason := 'Different location';
  end if;

  total := f_score + s_score + l_score + a_score + loc_score;
  return jsonb_build_object(
    'score', total,
    'reason', concat_ws('. ', s_reason, f_reason),
    'breakdown', jsonb_build_object(
      'field',        jsonb_build_object('score', f_score,   'max', 35, 'reason', f_reason),
      'skills',       jsonb_build_object('score', s_score,   'max', 30, 'reason', s_reason),
      'level',        jsonb_build_object('score', l_score,   'max', 15, 'reason', l_reason),
      'availability', jsonb_build_object('score', a_score,   'max', 15, 'reason', a_reason),
      'location',     jsonb_build_object('score', loc_score, 'max', 5,  'reason', loc_reason)));
end $$;

create or replace function public.compute_match(p_candidate uuid, p_opportunity uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_candidate = auth.uid() then
    if not exists (
      select 1 from public.opportunities o
       where o.id = p_opportunity and (o.status in ('published', 'closed') or public.manages_company(o.company_id))
    ) then
      return null;
    end if;
  elsif public.is_admin() then
    null;
  elsif not exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
     where a.candidate_id = p_candidate and a.opportunity_id = p_opportunity and public.manages_company(o.company_id)
  ) then
    raise exception 'Not allowed';
  end if;
  return public.match_internal(p_candidate, p_opportunity);
end $$;

create or replace function public.recommended_opportunities(p_limit int default 20)
returns table (opportunity_id uuid, score int, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_type public.candidate_type;
begin
  if public.my_role() <> 'candidate' then return; end if;
  select candidate_type into v_type from public.candidate_profiles where user_id = auth.uid();
  if v_type is null then return; end if;

  return query
    select o.id, (m.j ->> 'score')::int, m.j ->> 'reason'
      from (
        select o2.* from public.opportunities o2
         where o2.status = 'published' and not o2.suspended and o2.deadline >= public.harare_today()
           and public.opp_fits_candidate(o2.type, v_type)
           and not exists (select 1 from public.applications a where a.opportunity_id = o2.id and a.candidate_id = auth.uid())
           and exists (select 1 from public.companies c where c.id = o2.company_id and not c.suspended)
         order by o2.published_at desc nulls last
         limit 300
      ) o
      cross join lateral (select public.match_internal(auth.uid(), o.id) as j) m
     order by (m.j ->> 'score')::int desc, o.deadline asc
     limit greatest(1, least(p_limit, 100));
end $$;

create or replace function public.apply_to_opportunity(p_opportunity uuid, p_cover_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_opp public.opportunities;
  v_type public.candidate_type;
  v_complete jsonb;
  v_match jsonb;
  v_id uuid;
begin
  if v_user is null or public.my_role() <> 'candidate' then raise exception 'Only candidates can apply'; end if;
  if not public.is_active_user() then raise exception 'Your account is suspended'; end if;
  if not public.email_is_verified() then raise exception 'Verify your email address before applying'; end if;

  select * into v_opp from public.opportunities where id = p_opportunity;
  if v_opp.id is null or v_opp.status <> 'published' or v_opp.suspended then raise exception 'This opportunity is not open for applications'; end if;
  if v_opp.deadline < public.harare_today() then raise exception 'The application deadline has passed'; end if;
  if exists (select 1 from public.companies where id = v_opp.company_id and suspended) then
    raise exception 'This opportunity is not open for applications';
  end if;

  select candidate_type into v_type from public.candidate_profiles where user_id = v_user;
  if not public.opp_fits_candidate(v_opp.type, v_type) then
    raise exception 'This opportunity is not for your candidate type';
  end if;

  v_complete := public.profile_completeness(v_user);
  if not coalesce((v_complete ->> 'complete')::boolean, false) then
    raise exception 'Complete your profile before applying (missing: %)', (select string_agg(x, ', ') from jsonb_array_elements_text(v_complete -> 'missing') x);
  end if;

  if exists (select 1 from public.applications where opportunity_id = p_opportunity and candidate_id = v_user) then
    raise exception 'You have already applied to this opportunity';
  end if;

  v_match := public.match_internal(v_user, p_opportunity);
  insert into public.applications (opportunity_id, candidate_id, cover_note, match_score, match_breakdown)
  values (p_opportunity, v_user, nullif(left(trim(coalesce(p_cover_note, '')), 2000), ''), (v_match ->> 'score')::int, v_match)
  returning id into v_id;

  insert into public.application_events (application_id, from_status, to_status, actor_id)
  values (v_id, null, 'submitted', v_user);
  return v_id;
end $$;

-- ------------------------------------------------------------------ hiring teams (several recruiters per company)
create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id),
  unique (user_id)
);
alter table public.company_members enable row level security;

-- Owner or recruiter of the company (managing opportunities, applicants, interviews). Company profile and
-- private registration details stay with the owner (owns_company).
create or replace function public.manages_company(p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies c where c.id = p_company and c.owner_id = auth.uid())
      or exists (select 1 from public.company_members m where m.company_id = p_company and m.user_id = auth.uid())
$$;

create or replace function public.acting_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select m.company_id from public.company_members m where m.user_id = auth.uid()),
                  (select c.id from public.companies c where c.owner_id = auth.uid()))
$$;

create policy company_members_select on public.company_members for select to authenticated
  using (user_id = auth.uid() or public.owns_company(company_id) or public.is_admin());

create or replace function public.owns_opportunity(p_opportunity uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.opportunities o where o.id = p_opportunity and public.manages_company(o.company_id))
$$;

create or replace function public.employer_can_see_candidate(p_candidate uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
     where a.candidate_id = p_candidate and public.manages_company(o.company_id)
  )
$$;

create or replace function public.employer_can_read_object(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      join public.candidate_profiles cp on cp.user_id = a.candidate_id
      join public.profiles pr on pr.id = a.candidate_id
     where public.manages_company(o.company_id)
       and ((p_bucket = 'cvs' and cp.cv_path = p_name)
         or (p_bucket = 'placement-letters' and cp.placement_letter_path = p_name)
         or (p_bucket = 'avatars' and pr.avatar_path = p_name))
  )
$$;

drop policy opportunities_owner_select on public.opportunities;
create policy opportunities_owner_select on public.opportunities for select to authenticated using (public.manages_company(company_id));
drop policy opportunities_owner_insert on public.opportunities;
create policy opportunities_owner_insert on public.opportunities for insert to authenticated
  with check (public.manages_company(company_id) and public.my_role() = 'employer' and public.is_active_user());
drop policy opportunities_owner_update on public.opportunities;
create policy opportunities_owner_update on public.opportunities for update to authenticated
  using (public.manages_company(company_id) and public.is_active_user()) with check (public.manages_company(company_id));
drop policy opportunities_owner_delete on public.opportunities;
create policy opportunities_owner_delete on public.opportunities for delete to authenticated
  using (public.manages_company(company_id) and status = 'draft');
drop policy templates_owner_all on public.message_templates;
create policy templates_owner_all on public.message_templates for all to authenticated
  using (public.manages_company(company_id)) with check (public.manages_company(company_id));

create or replace function public.notify_company(
  p_company uuid, p_type public.notification_type, p_title text, p_body text,
  p_url text default null, p_data jsonb default '{}'::jsonb, p_dedupe text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  for v_user in
    select owner_id from public.companies where id = p_company
    union select user_id from public.company_members where company_id = p_company
  loop
    perform public.notify(v_user, p_type, p_title, p_body, p_url, p_data, case when p_dedupe is null then null else p_dedupe || ':' || v_user end);
  end loop;
end $$;
revoke all on function public.notify_company(uuid, public.notification_type, text, text, text, jsonb, text) from public, anon, authenticated;

create or replace function public.notify_on_application_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_opp public.opportunities;
  v_owner uuid;
  v_cand text;
  v_title text;
  v_body text;
  v_type public.notification_type;
begin
  select * into v_app from public.applications where id = new.application_id;
  select * into v_opp from public.opportunities where id = v_app.opportunity_id;
  select c.owner_id into v_owner from public.companies c where c.id = v_opp.company_id;
  select full_name into v_cand from public.profiles where id = v_app.candidate_id;

  if new.from_status is null then
    perform public.notify_company(v_opp.company_id, 'application_received', 'New application',
      coalesce(nullif(v_cand, ''), 'A candidate') || ' applied for ' || v_opp.title,
      '/employer/applicants/' || v_app.id, jsonb_build_object('application_id', v_app.id, 'opportunity_id', v_opp.id));
    return new;
  end if;

  if new.actor_id is not distinct from v_app.candidate_id then
    -- The candidate acted: tell the employer.
    v_type := case when new.to_status = 'accepted' or (new.from_status = 'offer_made' and new.to_status = 'withdrawn') then 'offer_response' else 'application_status' end;
    v_title := case
      when new.to_status = 'accepted' then 'Offer accepted'
      when new.from_status = 'offer_made' and new.to_status = 'withdrawn' then 'Offer declined'
      else 'Application withdrawn' end;
    perform public.notify_company(v_opp.company_id, v_type, v_title,
      coalesce(nullif(v_cand, ''), 'A candidate') || ' · ' || v_opp.title,
      '/employer/applicants/' || v_app.id, jsonb_build_object('application_id', v_app.id));
    return new;
  end if;

  -- The employer acted: tell the candidate. Interview invitations are announced by the interview trigger.
  if new.to_status = 'interview_invited' then return new; end if;
  v_type := case when new.to_status = 'offer_made' then 'offer' else 'application_status' end;
  v_title := case new.to_status
    when 'under_review' then 'Your application is under review'
    when 'shortlisted' then 'You''ve been shortlisted'
    when 'offer_made' then 'You have an offer'
    when 'unsuccessful' then 'Update on your application'
    else 'Application update' end;
  v_body := coalesce(new.note, case new.to_status
    when 'under_review' then v_opp.title || ' is now under review.'
    when 'shortlisted' then 'Great news: you''re shortlisted for ' || v_opp.title || '.'
    when 'offer_made' then 'You''ve received an offer for ' || v_opp.title || '. Open the app to accept or decline.'
    when 'unsuccessful' then 'Thank you for applying for ' || v_opp.title || '. Unfortunately you were not selected this time.'
    else 'The status of your application changed.' end);
  perform public.notify(v_app.candidate_id, v_type, v_title, v_body,
    '/candidate/applications/' || v_app.id, jsonb_build_object('application_id', v_app.id, 'status', new.to_status));
  return new;
end $$;

create or replace function public.notify_on_interview()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_opp public.opportunities;
  v_owner uuid;
  v_when text;
begin
  select * into v_app from public.applications where id = new.application_id;
  select * into v_opp from public.opportunities where id = v_app.opportunity_id;
  select c.owner_id into v_owner from public.companies c where c.id = v_opp.company_id;
  v_when := to_char(new.scheduled_at at time zone 'Africa/Harare', 'FMDay DD FMMonth YYYY "at" HH24:MI');

  if tg_op = 'INSERT' then
    perform public.notify(v_app.candidate_id, 'interview_invite', 'Interview invitation',
      v_opp.title || ' · ' || v_when || ' (' || new.mode::text || '). Open the app to confirm or decline.',
      '/candidate/applications/' || v_app.id, jsonb_build_object('application_id', v_app.id, 'interview_id', new.id));
  elsif new.status is distinct from old.status then
    if new.status in ('confirmed', 'declined') then
      perform public.notify_company(v_opp.company_id, 'interview_update',
        case when new.status = 'confirmed' then 'Interview confirmed' else 'Interview declined' end,
        (select full_name from public.profiles where id = v_app.candidate_id) || ' · ' || v_opp.title || ' · ' || v_when,
        '/employer/interviews', jsonb_build_object('application_id', v_app.id, 'interview_id', new.id));
    elsif new.status = 'cancelled' then
      perform public.notify(v_app.candidate_id, 'interview_update', 'Interview cancelled',
        v_opp.title || ' · ' || v_when, '/candidate/applications/' || v_app.id,
        jsonb_build_object('application_id', v_app.id, 'interview_id', new.id));
    end if;
  end if;
  return new;
end $$;

create or replace function public.generate_interview_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int := 0; v_row record; v_when text;
begin
  for v_row in
    select i.id, i.scheduled_at, i.mode, a.id as app_id, a.candidate_id, o.title, o.company_id
      from public.interviews i
      join public.applications a on a.id = i.application_id
      join public.opportunities o on o.id = a.opportunity_id
      join public.companies c on c.id = o.company_id
     where i.status in ('scheduled', 'confirmed') and i.reminder_sent_at is null
       and i.scheduled_at > now() and i.scheduled_at <= now() + interval '24 hours'
       and i.created_at < i.scheduled_at - interval '24 hours'
  loop
    v_when := to_char(v_row.scheduled_at at time zone 'Africa/Harare', 'FMDay DD FMMonth "at" HH24:MI');
    perform public.notify(v_row.candidate_id, 'interview_reminder', 'Interview tomorrow',
      v_row.title || ' · ' || v_when, '/candidate/applications/' || v_row.app_id,
      jsonb_build_object('interview_id', v_row.id), 'interview-reminder:' || v_row.id || ':candidate');
    perform public.notify_company(v_row.company_id, 'interview_reminder', 'Interview tomorrow',
      v_row.title || ' · ' || v_when, '/employer/interviews',
      jsonb_build_object('interview_id', v_row.id), 'interview-reminder:' || v_row.id || ':employer');
    update public.interviews set reminder_sent_at = now() where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function public.opportunity_analytics(p_company uuid default null)
returns table (
  opportunity_id uuid, title text, status public.opportunity_status, applications bigint,
  by_status jsonb, avg_match numeric, time_to_fill_days numeric
) language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := coalesce(p_company, public.acting_company_id());
begin
  if v_company is null or not (public.manages_company(v_company) or public.is_admin()) then raise exception 'Not allowed'; end if;
  return query
    select o.id, o.title, o.status,
           (select count(*) from public.applications a where a.opportunity_id = o.id),
           (select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
              from (select a.status, count(*) n from public.applications a where a.opportunity_id = o.id group by a.status) s),
           (select round(avg(a.match_score), 0) from public.applications a where a.opportunity_id = o.id),
           -- Time to fill: publish date -> first accepted application.
           (select round(extract(epoch from (min(a.status_changed_at) - o.published_at)) / 86400.0, 1)
              from public.applications a where a.opportunity_id = o.id and a.status = 'accepted')
      from public.opportunities o
     where o.company_id = v_company
     order by o.created_at desc;
end $$;

create or replace function public.add_recruiter(p_email text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_company public.companies; v_target uuid; v_role public.user_role; v_status public.account_status;
begin
  select * into v_company from public.companies where owner_id = auth.uid();
  if v_company.id is null or public.my_role() <> 'employer' or exists (select 1 from public.company_members where user_id = auth.uid()) then raise exception 'Only the company owner can manage the hiring team'; end if;
  select u.id into v_target from auth.users u where lower(u.email) = lower(trim(coalesce(p_email, '')));
  if v_target is null then raise exception 'No Mukana employer account uses that email address. Ask them to sign up as an employer first.'; end if;
  select role, status into v_role, v_status from public.profiles where id = v_target;
  if v_target = auth.uid() then raise exception 'You already own this company'; end if;
  if v_role is distinct from 'employer' or v_status is distinct from 'active' then raise exception 'That account is not an active employer account'; end if;
  if exists (select 1 from public.company_members where user_id = v_target) then raise exception 'That person already belongs to a hiring team'; end if;
  if exists (select 1 from public.opportunities o join public.companies c on c.id = o.company_id where c.owner_id = v_target) then
    raise exception 'That account already manages its own opportunities';
  end if;
  if (select count(*) from public.company_members where company_id = v_company.id) >= 10 then raise exception 'A hiring team can have up to 10 recruiters'; end if;
  insert into public.company_members (company_id, user_id, added_by) values (v_company.id, v_target, auth.uid());
  perform public.notify(v_target, 'system', 'You joined a hiring team',
    'You can now manage opportunities and applicants for ' || coalesce(nullif(v_company.name, ''), 'a company') || '.', '/employer', '{}'::jsonb, null);
end $$;
revoke all on function public.add_recruiter(text) from public, anon;
grant execute on function public.add_recruiter(text) to authenticated;

create or replace function public.remove_recruiter(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.company_members m using public.companies c
   where m.company_id = c.id and m.user_id = p_user and (c.owner_id = auth.uid() or p_user = auth.uid());
  if not found then raise exception 'Team member not found'; end if;
end $$;
revoke all on function public.remove_recruiter(uuid) from public, anon;
grant execute on function public.remove_recruiter(uuid) to authenticated;

create or replace function public.list_company_team()
returns table (user_id uuid, full_name text, email text, is_owner boolean, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  with mine as (select public.acting_company_id() as id)
  select c.owner_id, p.full_name, case when c.owner_id = auth.uid() then p.email end, true, c.created_at
    from public.companies c join public.profiles p on p.id = c.owner_id where c.id = (select id from mine) and public.manages_company(c.id)
  union all
  select m.user_id, p.full_name, case when exists (select 1 from public.companies o where o.id = m.company_id and o.owner_id = auth.uid()) then p.email end, false, m.created_at
    from public.company_members m join public.profiles p on p.id = m.user_id where m.company_id = (select id from mine) and public.manages_company(m.company_id)
$$;
revoke all on function public.list_company_team() from public, anon;
grant execute on function public.list_company_team() to authenticated;

-- ------------------------------------------------------------------ notification categories
alter table public.notification_preferences
  add column cat_network  boolean not null default true,
  add column cat_messages boolean not null default true,
  add column cat_feed     boolean not null default true,
  add column cat_jobs     boolean not null default true,
  add column weekly_digest boolean not null default true;

create or replace function public.notify(
  p_user uuid, p_type public.notification_type, p_title text, p_body text,
  p_url text default null, p_data jsonb default '{}'::jsonb, p_dedupe text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_pref public.notification_preferences;
begin
  if p_user is null then return null; end if;
  select * into v_pref from public.notification_preferences where user_id = p_user;
  if v_pref.user_id is not null and (
       (p_type::text = 'network'  and not v_pref.cat_network)
    or (p_type::text = 'message'  and not v_pref.cat_messages)
    or (p_type::text = 'feed'     and not v_pref.cat_feed)
    or (p_type::text in ('job_alert', 'digest', 'deadline_reminder', 'invitation') and not v_pref.cat_jobs)) then
    return null;
  end if;
  insert into public.notifications (user_id, type, title, body, url, data, dedupe_key)
  values (p_user, p_type, left(p_title, 200), left(coalesce(p_body, ''), 2000), p_url, coalesce(p_data, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- ------------------------------------------------------------------ job alerts
create table public.job_alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 60),
  keyword    text check (keyword is null or char_length(keyword) between 2 and 80),
  types      text[] not null default '{}' check (cardinality(types) <= 4),
  province   text check (province is null or char_length(province) <= 80),
  paid_only  boolean not null default false,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);
create index job_alerts_user_idx on public.job_alerts (user_id);
alter table public.job_alerts enable row level security;
create policy job_alerts_own on public.job_alerts for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.my_role() = 'candidate' and public.is_active_user());

create or replace function public.job_alerts_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.job_alerts where user_id = new.user_id) >= 10 then raise exception 'You can have up to 10 job alerts'; end if;
  return new;
end $$;
create trigger job_alerts_limit_trg before insert on public.job_alerts for each row execute function public.job_alerts_limit();

-- When an opportunity is published, tell candidates whose alerts match (one notification per person and opportunity).
create or replace function public.notify_job_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_row record; v_company text;
begin
  if new.status <> 'published' or new.suspended then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'published' then return new; end if;
  select name into v_company from public.companies where id = new.company_id;
  for v_row in
    select distinct a.user_id
      from public.job_alerts a
      join public.candidate_profiles cp on cp.user_id = a.user_id
      join public.profiles p on p.id = a.user_id and p.status = 'active'
     where a.enabled and public.opp_fits_candidate(new.type, cp.candidate_type)
       and (cardinality(a.types) = 0 or new.type::text = any (a.types))
       and (a.province is null or lower(coalesce(new.province, '')) = lower(a.province))
       and (not a.paid_only or new.stipend_type = 'paid')
       and (a.keyword is null or new.search_text like '%' || lower(a.keyword) || '%')
     limit 500
  loop
    perform public.notify(v_row.user_id, 'job_alert', 'New match for your alert: ' || new.title,
      coalesce(nullif(v_company, ''), 'A company') || ' · ' || new.location, '/candidate/opportunities/' || new.id,
      jsonb_build_object('opportunity_id', new.id), 'alert:' || new.id || ':' || v_row.user_id);
  end loop;
  return new;
end $$;
create trigger opportunities_job_alerts after insert or update of status on public.opportunities
  for each row execute function public.notify_job_alerts();

-- ------------------------------------------------------------------ weekly digest (called by the weekly-digest Edge Function)
create or replace function public.generate_weekly_digest()
returns int language plpgsql security definer set search_path = public as $$
declare v_user record; v_lines text; v_count int := 0; v_week text := to_char(now() at time zone 'Africa/Harare', 'IYYY-IW');
begin
  for v_user in
    select p.id, cp.candidate_type
      from public.profiles p join public.candidate_profiles cp on cp.user_id = p.id
      left join public.notification_preferences np on np.user_id = p.id
     where p.role = 'candidate' and p.status = 'active' and coalesce(np.weekly_digest, true) and coalesce(np.cat_jobs, true)
  loop
    select string_agg('• ' || t.title || ' (' || t.score || '% match)', E'\n' order by t.score desc) into v_lines
      from (
        select o.title, (m.j ->> 'score')::int as score
          from public.opportunities o
          cross join lateral (select public.match_internal(v_user.id, o.id) as j) m
         where o.status = 'published' and not o.suspended and o.deadline >= public.harare_today()
           and o.published_at > now() - interval '7 days'
           and public.opp_fits_candidate(o.type, v_user.candidate_type)
           and not exists (select 1 from public.applications a where a.opportunity_id = o.id and a.candidate_id = v_user.id)
           and (m.j ->> 'score')::int >= 40
         order by (m.j ->> 'score')::int desc
         limit 5
      ) t;
    if v_lines is not null then
      if public.notify(v_user.id, 'digest', 'Your weekly opportunity picks', v_lines, '/candidate/recommended',
           '{}'::jsonb, 'digest:' || v_user.id || ':' || v_week) is not null then
        v_count := v_count + 1;
      end if;
    end if;
  end loop;
  return v_count;
end $$;
revoke all on function public.generate_weekly_digest() from public, anon, authenticated;
grant execute on function public.generate_weekly_digest() to service_role;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') and exists (select 1 from pg_proc where proname = 'call_edge_function') then
    perform cron.schedule('mukana-weekly-digest', '0 7 * * 1', $cron$select public.call_edge_function('weekly-digest')$cron$);
  end if;
end $$;

-- ------------------------------------------------------------------ employers: talent search, shortlist, invitations
create table public.saved_candidates (
  company_id   uuid not null references public.companies (id) on delete cascade,
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  note         text check (note is null or char_length(note) <= 500),
  saved_by     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (company_id, candidate_id)
);
alter table public.saved_candidates enable row level security;
create or replace function public.can_shortlist(p_candidate uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = p_candidate and p.role = 'candidate' and p.status = 'active')
     and not public.is_blocked(auth.uid(), p_candidate)
$$;
create policy saved_candidates_team on public.saved_candidates for all to authenticated
  using (public.manages_company(company_id))
  with check (public.manages_company(company_id) and public.my_role() = 'employer' and public.is_active_user() and public.can_shortlist(candidate_id));

create or replace function public.saved_candidates_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.saved_candidates where company_id = new.company_id) >= 500 then raise exception 'Your shortlist is full (500 candidates)'; end if;
  new.saved_by := auth.uid();
  return new;
end $$;
create trigger saved_candidates_limit_trg before insert on public.saved_candidates for each row execute function public.saved_candidates_limit();

-- Employers can find candidates who chose to be discoverable (search on) and share their profile with all members.
create or replace function public.search_candidates(
  p_q text default null, p_type text default null, p_province text default null, p_skill text default null,
  p_limit int default 20, p_offset int default 0
) returns table (
  id uuid, full_name text, headline text, candidate_type public.candidate_type, institution text, province text,
  skills text[], open_to_work boolean, verified_badge boolean, avatar_path text, saved boolean
) language plpgsql stable security definer set search_path = public as $$
declare q text := lower(trim(coalesce(p_q, ''))); v_company uuid := public.acting_company_id();
begin
  if public.my_role() <> 'employer' or not public.is_active_user() or v_company is null then return; end if;
  q := replace(replace(q, '%', ''), '_', '');
  return query
    select pr.id, pr.full_name,
           coalesce(pr.headline, nullif(concat_ws(' · ', coalesce(cp.programme, cp.qualification), cp.institution), '')),
           cp.candidate_type, cp.institution, cp.province, cp.skills, pr.open_to_work, pr.verified_badge, pr.avatar_path,
           exists (select 1 from public.saved_candidates s where s.company_id = v_company and s.candidate_id = pr.id)
      from public.profiles pr join public.candidate_profiles cp on cp.user_id = pr.id
     where pr.role = 'candidate' and pr.status = 'active' and pr.searchable and pr.profile_visibility = 'members'
       and not public.is_blocked(auth.uid(), pr.id)
       and (p_type is null or p_type = '' or cp.candidate_type::text = p_type)
       and (p_province is null or p_province = '' or lower(coalesce(cp.province, '')) = lower(p_province))
       and (p_skill is null or p_skill = '' or exists (select 1 from unnest(cp.skills) s where s ilike '%' || replace(replace(p_skill, '%', ''), '_', '') || '%'))
       and (q = '' or lower(pr.full_name) like '%' || q || '%' or lower(coalesce(pr.headline, '')) like '%' || q || '%'
            or lower(coalesce(cp.programme, '')) like '%' || q || '%' or lower(coalesce(cp.qualification, '')) like '%' || q || '%'
            or lower(coalesce(cp.institution, '')) like '%' || q || '%'
            or exists (select 1 from unnest(cp.skills) s where lower(s) like '%' || q || '%'))
     order by pr.open_to_work desc, cp.updated_at desc
     offset greatest(p_offset, 0) limit greatest(1, least(p_limit, 50));
end $$;
revoke all on function public.search_candidates(text, text, text, text, int, int) from public, anon;
grant execute on function public.search_candidates(text, text, text, text, int, int) to authenticated;

-- Best-fitting discoverable candidates for one of the company's opportunities (not yet applied), best match first.
create or replace function public.recommended_candidates(p_opportunity uuid, p_limit int default 12)
returns table (user_id uuid, score int, reason text, full_name text, headline text, avatar_path text, open_to_work boolean, saved boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_opp public.opportunities;
begin
  select * into v_opp from public.opportunities where id = p_opportunity;
  if v_opp.id is null or not public.manages_company(v_opp.company_id) or public.my_role() <> 'employer' then raise exception 'Not allowed'; end if;
  return query
    select c.user_id, (m.j ->> 'score')::int, m.j ->> 'reason', c.full_name, c.headline, c.avatar_path, c.open_to_work,
           exists (select 1 from public.saved_candidates s where s.company_id = v_opp.company_id and s.candidate_id = c.user_id)
      from (
        select cp.user_id, pr.full_name, pr.avatar_path, pr.open_to_work,
               coalesce(pr.headline, nullif(concat_ws(' · ', coalesce(cp.programme, cp.qualification), cp.institution), '')) as headline
          from public.candidate_profiles cp join public.profiles pr on pr.id = cp.user_id
         where pr.status = 'active' and pr.searchable and pr.profile_visibility = 'members'
           and public.opp_fits_candidate(v_opp.type, cp.candidate_type)
           and not public.is_blocked(auth.uid(), pr.id)
           and not exists (select 1 from public.applications a where a.opportunity_id = p_opportunity and a.candidate_id = cp.user_id)
         order by cp.updated_at desc
         limit 300
      ) c
      cross join lateral (select public.match_internal(c.user_id, p_opportunity) as j) m
     where (m.j ->> 'score')::int >= 30
     order by (m.j ->> 'score')::int desc, c.open_to_work desc
     limit greatest(1, least(p_limit, 50));
end $$;
revoke all on function public.recommended_candidates(uuid, int) from public, anon;
grant execute on function public.recommended_candidates(uuid, int) to authenticated;

-- Invite a discoverable candidate to apply to one of your published opportunities.
create or replace function public.invite_to_apply(p_candidate uuid, p_opportunity uuid, p_message text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_opp public.opportunities; v_cand public.candidate_profiles; v_company text; v_msg text := left(trim(coalesce(p_message, '')), 500);
begin
  select * into v_opp from public.opportunities where id = p_opportunity;
  if v_opp.id is null or public.my_role() <> 'employer' or not public.manages_company(v_opp.company_id) or not public.is_active_user() then raise exception 'Not allowed'; end if;
  if v_opp.status <> 'published' or v_opp.suspended or v_opp.deadline < public.harare_today() then raise exception 'You can invite people to opportunities that are open'; end if;
  select * into v_cand from public.candidate_profiles where user_id = p_candidate;
  if v_cand.user_id is null or not exists (select 1 from public.profiles where id = p_candidate and status = 'active' and searchable and profile_visibility = 'members')
     or public.is_blocked(auth.uid(), p_candidate) then
    raise exception 'This candidate cannot be invited';
  end if;
  if not public.opp_fits_candidate(v_opp.type, v_cand.candidate_type) then raise exception 'This opportunity is not for that candidate''s type'; end if;
  if exists (select 1 from public.applications where opportunity_id = p_opportunity and candidate_id = p_candidate) then raise exception 'They have already applied'; end if;
  if (select count(*) from public.notifications n where n.type::text = 'invitation' and n.data ->> 'company_id' = v_opp.company_id::text and n.created_at > now() - interval '1 day') >= 30 then
    raise exception 'You have sent many invitations today. Please try again tomorrow.';
  end if;
  select name into v_company from public.companies where id = v_opp.company_id;
  if public.notify(p_candidate, 'invitation', coalesce(nullif(v_company, ''), 'An employer') || ' invited you to apply',
       v_opp.title || case when v_msg <> '' then E'\n' || v_msg else '' end, '/candidate/opportunities/' || p_opportunity,
       jsonb_build_object('opportunity_id', p_opportunity, 'company_id', v_opp.company_id), 'invite:' || p_opportunity || ':' || p_candidate) is null then
    raise exception 'You already invited this candidate';
  end if;
end $$;
revoke all on function public.invite_to_apply(uuid, uuid, text) from public, anon;
grant execute on function public.invite_to_apply(uuid, uuid, text) to authenticated;


-- ############################################################################
-- 0016_reach_learning.sql
-- ############################################################################

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


-- ############################################################################
-- 0017_security.sql
-- ############################################################################

-- =====================================================================================
-- Mukana · 0017 · Two-step verification (TOTP) enforcement in the database
--
-- A member who turned on two-step verification must prove the second step before the database serves
-- their data: a session that only completed the password step (JWT "aal1") is treated like a locked account.
-- Members without a verified factor are unaffected.
-- =====================================================================================

create or replace function public.aal_ok()
returns boolean language plpgsql stable security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then return true; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then return true; end if;
  if to_regclass('auth.mfa_factors') is null then return true; end if;
  return not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified');
end $$;

-- Almost every function and policy asks is_active_user() first, so this one change covers them.
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce((select p.status = 'active' from public.profiles p where p.id = auth.uid()), false) and public.aal_ok()
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'candidate_profiles', 'company_private', 'verification_requests', 'applications', 'application_events',
    'interviews', 'notifications', 'device_tokens', 'notification_preferences', 'messages', 'conversation_members',
    'connections', 'follows', 'blocks', 'recommendations', 'skill_endorsements', 'saved_opportunities', 'saved_candidates',
    'job_alerts', 'posts', 'post_comments', 'post_likes', 'post_bookmarks', 'quiz_attempts', 'user_badges',
    'mentorship_requests', 'event_rsvps', 'group_members', 'company_members', 'message_templates'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists mfa_gate on public.%I', t);
      execute format('create policy mfa_gate on public.%I as restrictive for all to authenticated using (public.aal_ok()) with check (public.aal_ok())', t);
    end if;
  end loop;
end $$;

-- Private files (CVs, placement letters, photos, verification documents) follow the same rule.
drop policy if exists mfa_gate on storage.objects;
create policy mfa_gate on storage.objects as restrictive for all to authenticated
  using (bucket_id in ('post-media', 'company-logos') or public.aal_ok())
  with check (bucket_id in ('post-media', 'company-logos') or public.aal_ok());

