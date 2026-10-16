-- =====================================================================================
-- Mukana Â· 0007 Â· Notifications (in-app + push + email), device tokens, reminders
-- Delivery to FCM / email happens in the `send-notifications` Edge Function; this file creates
-- the rows (via triggers) and the functions the Edge Functions call.
-- =====================================================================================

-- Private key/value config read by trigger functions (edge function URL, shared secret).
-- No RLS policies: only the database owner and service role can read it.
create table public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  type          public.notification_type not null,
  title         text not null check (char_length(title) <= 200),
  body          text not null default '' check (char_length(body) <= 2000),
  url           text check (url is null or url ~ '^/'),
  data          jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  push_sent_at  timestamptz,
  email_sent_at timestamptz,
  dedupe_key    text unique
);
create index notifications_user_idx    on public.notifications (user_id, created_at desc);
create index notifications_unread_idx  on public.notifications (user_id) where read_at is null;
create index notifications_pending_idx on public.notifications (created_at) where push_sent_at is null;

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Users may only mark notifications read; nothing else about a row is theirs to change.
create or replace function public.notifications_guard_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin') then return new; end if;
  if new.user_id is distinct from old.user_id or new.type is distinct from old.type or new.title is distinct from old.title
     or new.body is distinct from old.body or new.url is distinct from old.url or new.data is distinct from old.data
     or new.created_at is distinct from old.created_at or new.push_sent_at is distinct from old.push_sent_at
     or new.email_sent_at is distinct from old.email_sent_at or new.dedupe_key is distinct from old.dedupe_key then
    raise exception 'Only the read state of a notification can be changed';
  end if;
  return new;
end $$;
create trigger notifications_guard before update on public.notifications
  for each row execute function public.notifications_guard_update();

-- ------------------------------------------------------------------ device tokens (FCM web push)
create table public.device_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  token        text not null unique check (char_length(token) between 20 and 4096),
  platform     text not null default 'web',
  user_agent   text check (char_length(user_agent) <= 400),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index device_tokens_user_idx on public.device_tokens (user_id);
alter table public.device_tokens enable row level security;
create policy device_tokens_own on public.device_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Registers (or re-assigns) a token to the caller. A token belongs to exactly one user at a time.
create or replace function public.register_device_token(p_token text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.device_tokens (user_id, token, user_agent)
  values (auth.uid(), p_token, left(p_user_agent, 400))
  on conflict (token) do update set user_id = auth.uid(), user_agent = excluded.user_agent, last_seen_at = now();
end $$;
revoke all on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;

-- ------------------------------------------------------------------ preferences (incl. WhatsApp opt-in)
create table public.notification_preferences (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  push_enabled    boolean not null default true,
  email_enabled   boolean not null default true,
  -- WhatsApp is never used without explicit opt-in. Channel is not active yet (see README).
  whatsapp_opt_in boolean not null default false,
  whatsapp_number text check (whatsapp_number is null or whatsapp_number ~ '^\+[0-9]{8,15}$'),
  updated_at      timestamptz not null default now()
);
create trigger notification_preferences_updated before update on public.notification_preferences
  for each row execute function public.set_updated_at();
alter table public.notification_preferences enable row level security;
create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------ notify()
create or replace function public.notify(
  p_user uuid, p_type public.notification_type, p_title text, p_body text,
  p_url text default null, p_data jsonb default '{}'::jsonb, p_dedupe text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_user is null then return null; end if;
  insert into public.notifications (user_id, type, title, body, url, data, dedupe_key)
  values (p_user, p_type, left(p_title, 200), left(coalesce(p_body, ''), 2000), p_url, coalesce(p_data, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.notify(uuid, public.notification_type, text, text, text, jsonb, text) from public, anon, authenticated;

-- Pokes the send-notifications Edge Function right after a row is created (best effort).
-- The 5-minute cron job is the safety net if this call is missed.
create or replace function public.notifications_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url text; v_secret text;
begin
  select value into v_url from public.app_config where key = 'edge_base_url';
  select value into v_secret from public.app_config where key = 'cron_secret';
  if v_url is not null and v_secret is not null
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    begin
      execute 'select net.http_post(url := $1, headers := $2, body := $3)'
        using v_url || '/send-notifications',
              jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
              jsonb_build_object('notification_id', new.id);
    exception when others then
      null; -- never block the business transaction because delivery could not be triggered
    end;
  end if;
  return new;
end $$;
create trigger notifications_dispatch after insert on public.notifications
  for each row execute function public.notifications_after_insert();

-- Edge Function helper: atomically claims undelivered notifications so two runs never double-send.
create or replace function public.claim_pending_notifications(p_limit int default 100, p_only uuid default null)
returns table (
  id uuid, user_id uuid, type public.notification_type, title text, body text, url text, data jsonb,
  email text, full_name text, push_enabled boolean, email_enabled boolean
) language plpgsql security definer set search_path = public as $$
begin
  if auth.role() is not null and auth.role() <> 'service_role' then
    raise exception 'Service role only';
  end if;
  return query
    with picked as (
      select n.id from public.notifications n
       where n.push_sent_at is null and n.created_at > now() - interval '3 days'
         and (p_only is null or n.id = p_only)
       order by n.created_at
       limit greatest(1, least(p_limit, 500))
       for update skip locked
    ), marked as (
      update public.notifications n set push_sent_at = now() from picked where n.id = picked.id returning n.*
    )
    select m.id, m.user_id, m.type, m.title, m.body, m.url, m.data, p.email, p.full_name,
           coalesce(np.push_enabled, true), coalesce(np.email_enabled, true)
      from marked m
      join public.profiles p on p.id = m.user_id
      left join public.notification_preferences np on np.user_id = m.user_id;
end $$;
revoke all on function public.claim_pending_notifications(int, uuid) from public, anon, authenticated;
grant execute on function public.claim_pending_notifications(int, uuid) to service_role;

create or replace function public.mark_notification_emailed(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.notifications set email_sent_at = now() where id = p_id
$$;
revoke all on function public.mark_notification_emailed(uuid) from public, anon, authenticated;
grant execute on function public.mark_notification_emailed(uuid) to service_role;

-- ------------------------------------------------------------------ triggers that create notifications
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
    perform public.notify(v_owner, 'application_received', 'New application',
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
    perform public.notify(v_owner, v_type, v_title,
      coalesce(nullif(v_cand, ''), 'A candidate') || ' Â· ' || v_opp.title,
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
create trigger application_events_notify after insert on public.application_events
  for each row execute function public.notify_on_application_event();

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
      v_opp.title || ' Â· ' || v_when || ' (' || new.mode::text || '). Open the app to confirm or decline.',
      '/candidate/applications/' || v_app.id, jsonb_build_object('application_id', v_app.id, 'interview_id', new.id));
  elsif new.status is distinct from old.status then
    if new.status in ('confirmed', 'declined') then
      perform public.notify(v_owner, 'interview_update',
        case when new.status = 'confirmed' then 'Interview confirmed' else 'Interview declined' end,
        (select full_name from public.profiles where id = v_app.candidate_id) || ' Â· ' || v_opp.title || ' Â· ' || v_when,
        '/employer/interviews', jsonb_build_object('application_id', v_app.id, 'interview_id', new.id));
    elsif new.status = 'cancelled' then
      perform public.notify(v_app.candidate_id, 'interview_update', 'Interview cancelled',
        v_opp.title || ' Â· ' || v_when, '/candidate/applications/' || v_app.id,
        jsonb_build_object('application_id', v_app.id, 'interview_id', new.id));
    end if;
  end if;
  return new;
end $$;
create trigger interviews_notify after insert or update on public.interviews
  for each row execute function public.notify_on_interview();

-- ------------------------------------------------------------------ reminders (called by Edge Functions / cron)
-- Saved opportunities closing in exactly 3 days or 1 day (one reminder per user, opportunity and offset).
create or replace function public.generate_deadline_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int := 0; v_row record; v_days int;
begin
  for v_row in
    select s.user_id, o.id as opp_id, o.title, (o.deadline - public.harare_today()) as days_left
      from public.saved_opportunities s
      join public.opportunities o on o.id = s.opportunity_id
     where o.status = 'published' and not o.suspended
       and (o.deadline - public.harare_today()) in (3, 1)
       and not exists (select 1 from public.applications a where a.opportunity_id = o.id and a.candidate_id = s.user_id)
  loop
    v_days := v_row.days_left;
    if public.notify(v_row.user_id, 'deadline_reminder',
         case when v_days = 1 then 'Closing tomorrow' else 'Closing in 3 days' end,
         v_row.title || ' closes in ' || v_days || ' day' || case when v_days = 1 then '' else 's' end || '. Apply before it''s too late.',
         '/candidate/opportunities/' || v_row.opp_id,
         jsonb_build_object('opportunity_id', v_row.opp_id),
         'deadline:' || v_row.opp_id || ':' || v_row.user_id || ':' || v_days) is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;
revoke all on function public.generate_deadline_reminders() from public, anon, authenticated;
grant execute on function public.generate_deadline_reminders() to service_role;

-- Reminders 24 hours before an interview, to both the candidate and the employer.
create or replace function public.generate_interview_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int := 0; v_row record; v_when text;
begin
  for v_row in
    select i.id, i.scheduled_at, i.mode, a.id as app_id, a.candidate_id, o.title, c.owner_id
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
      v_row.title || ' Â· ' || v_when, '/candidate/applications/' || v_row.app_id,
      jsonb_build_object('interview_id', v_row.id), 'interview-reminder:' || v_row.id || ':candidate');
    perform public.notify(v_row.owner_id, 'interview_reminder', 'Interview tomorrow',
      v_row.title || ' Â· ' || v_when, '/employer/interviews',
      jsonb_build_object('interview_id', v_row.id), 'interview-reminder:' || v_row.id || ':employer');
    update public.interviews set reminder_sent_at = now() where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.generate_interview_reminders() from public, anon, authenticated;
grant execute on function public.generate_interview_reminders() to service_role;

-- Realtime: live unread badge and notification centre.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when duplicate_object then null;
end $$;
