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
