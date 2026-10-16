-- =====================================================================================
-- Mukana · 0006 · Applications, status timeline, interviews, message templates
-- All writes go through SECURITY DEFINER functions that validate every transition.
-- =====================================================================================

create table public.applications (
  id                uuid primary key default gen_random_uuid(),
  opportunity_id    uuid not null references public.opportunities (id) on delete cascade,
  candidate_id      uuid not null references public.profiles (id) on delete cascade,
  status            public.application_status not null default 'submitted',
  cover_note        text check (char_length(cover_note) <= 2000),
  match_score       int check (match_score between 0 and 100),
  match_breakdown   jsonb,                         -- snapshot of the score and reasons at apply time
  submitted_at      timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- A candidate can apply only once per opportunity.
  constraint applications_one_per_opportunity unique (opportunity_id, candidate_id)
);
create index applications_candidate_idx   on public.applications (candidate_id, submitted_at desc);
create index applications_opp_status_idx  on public.applications (opportunity_id, status);
create index applications_opp_score_idx   on public.applications (opportunity_id, match_score desc nulls last);
create trigger applications_updated before update on public.applications
  for each row execute function public.set_updated_at();

create table public.application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status    public.application_status,
  to_status      public.application_status not null,
  actor_id       uuid references public.profiles (id) on delete set null,
  note           text check (char_length(note) <= 4000),   -- message sent with the change, if any
  created_at     timestamptz not null default now()
);
create index application_events_app_idx on public.application_events (application_id, created_at);

-- ------------------------------------------------------------------ access helpers
create or replace function public.owns_opportunity(p_opportunity uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.opportunities o join public.companies c on c.id = o.company_id
     where o.id = p_opportunity and c.owner_id = auth.uid()
  )
$$;

create or replace function public.employer_can_see_candidate(p_candidate uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      join public.companies c on c.id = o.company_id
     where a.candidate_id = p_candidate and c.owner_id = auth.uid()
  )
$$;

-- Employers may read a stored file only when it is the current CV / placement letter / photo of a
-- candidate who applied to one of THEIR opportunities.
create or replace function public.employer_can_read_object(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      join public.companies c on c.id = o.company_id
      join public.candidate_profiles cp on cp.user_id = a.candidate_id
      join public.profiles pr on pr.id = a.candidate_id
     where c.owner_id = auth.uid()
       and ((p_bucket = 'cvs' and cp.cv_path = p_name)
         or (p_bucket = 'placement-letters' and cp.placement_letter_path = p_name)
         or (p_bucket = 'avatars' and pr.avatar_path = p_name))
  )
$$;

-- ------------------------------------------------------------------ RLS
alter table public.applications enable row level security;
create policy applications_candidate_select on public.applications for select to authenticated using (candidate_id = auth.uid());
create policy applications_employer_select on public.applications for select to authenticated using (public.owns_opportunity(opportunity_id));
-- No insert/update/delete policies: use apply_to_opportunity() and the status functions below.

alter table public.application_events enable row level security;
create policy application_events_select on public.application_events for select to authenticated
  using (exists (select 1 from public.applications a
                  where a.id = application_id and (a.candidate_id = auth.uid() or public.owns_opportunity(a.opportunity_id))));

-- Employers can read the profile of candidates who applied to them (and only those).
create policy profiles_employer_select on public.profiles for select to authenticated
  using (public.my_role() = 'employer' and public.employer_can_see_candidate(id));
create policy candidate_profiles_employer_select on public.candidate_profiles for select to authenticated
  using (public.my_role() = 'employer' and public.employer_can_see_candidate(user_id));

create policy "applicant files employer read" on storage.objects for select to authenticated
  using (bucket_id in ('cvs', 'placement-letters', 'avatars') and public.employer_can_read_object(bucket_id, name));

-- ------------------------------------------------------------------ apply
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
  if (v_type = 'attachee') <> (v_opp.type = 'industrial_attachment') then
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
revoke all on function public.apply_to_opportunity(uuid, text) from public, anon;
grant execute on function public.apply_to_opportunity(uuid, text) to authenticated;

-- ------------------------------------------------------------------ employer status changes (single or bulk)
create or replace function public.employer_transition_allowed(p_from public.application_status, p_to public.application_status)
returns boolean language sql immutable as $$
  select case p_from
    when 'submitted'         then p_to in ('under_review', 'shortlisted', 'unsuccessful')
    when 'under_review'      then p_to in ('shortlisted', 'unsuccessful')
    when 'shortlisted'       then p_to in ('under_review', 'offer_made', 'unsuccessful')
    when 'interview_invited' then p_to in ('shortlisted', 'offer_made', 'unsuccessful')
    when 'offer_made'        then p_to in ('unsuccessful')
    else false end
$$;

-- Returns {updated, skipped}. Interview invitations are created with schedule_interview().
create or replace function public.employer_set_status(p_ids uuid[], p_status public.application_status, p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_app public.applications;
  v_updated int := 0;
  v_skipped int := 0;
begin
  if public.my_role() <> 'employer' or not public.is_active_user() then raise exception 'Only employers can change application status'; end if;
  if p_status in ('submitted', 'accepted', 'withdrawn', 'interview_invited') then
    raise exception 'That status cannot be set directly';
  end if;
  if cardinality(p_ids) > 200 then raise exception 'Too many applications selected'; end if;

  foreach v_id in array p_ids loop
    select a.* into v_app from public.applications a where a.id = v_id and public.owns_opportunity(a.opportunity_id) for update;
    if v_app.id is null or not public.employer_transition_allowed(v_app.status, p_status) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    update public.applications set status = p_status, status_changed_at = now() where id = v_app.id;
    insert into public.application_events (application_id, from_status, to_status, actor_id, note)
    values (v_app.id, v_app.status, p_status, auth.uid(), nullif(left(trim(coalesce(p_message, '')), 4000), ''));
    -- A rejected/rescinded application cancels any open interview.
    if p_status = 'unsuccessful' then
      update public.interviews set status = 'cancelled' where application_id = v_app.id and status in ('scheduled', 'confirmed');
    end if;
    v_updated := v_updated + 1;
  end loop;
  return jsonb_build_object('updated', v_updated, 'skipped', v_skipped);
end $$;
revoke all on function public.employer_set_status(uuid[], public.application_status, text) from public, anon;
grant execute on function public.employer_set_status(uuid[], public.application_status, text) to authenticated;

-- ------------------------------------------------------------------ candidate actions
-- p_action: 'withdraw' (any stage before accepted), 'accept' or 'decline' (an offer).
create or replace function public.candidate_application_action(p_application uuid, p_action text, p_message text default null)
returns public.application_status language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_to public.application_status;
  v_note text := nullif(left(trim(coalesce(p_message, '')), 1000), '');
begin
  if public.my_role() <> 'candidate' then raise exception 'Only candidates can do this'; end if;
  select * into v_app from public.applications where id = p_application and candidate_id = auth.uid() for update;
  if v_app.id is null then raise exception 'Application not found'; end if;

  if p_action = 'withdraw' then
    if v_app.status not in ('submitted', 'under_review', 'shortlisted', 'interview_invited', 'offer_made') then
      raise exception 'This application can no longer be withdrawn';
    end if;
    v_to := 'withdrawn';
  elsif p_action = 'accept' then
    if v_app.status <> 'offer_made' then raise exception 'There is no offer to accept'; end if;
    v_to := 'accepted';
  elsif p_action = 'decline' then
    if v_app.status <> 'offer_made' then raise exception 'There is no offer to decline'; end if;
    v_to := 'withdrawn';
    v_note := coalesce(v_note, 'Offer declined');
  else
    raise exception 'Unknown action';
  end if;

  update public.applications set status = v_to, status_changed_at = now() where id = v_app.id;
  insert into public.application_events (application_id, from_status, to_status, actor_id, note)
  values (v_app.id, v_app.status, v_to, auth.uid(), v_note);
  update public.interviews set status = 'cancelled' where application_id = v_app.id and status in ('scheduled', 'confirmed');
  return v_to;
end $$;
revoke all on function public.candidate_application_action(uuid, text, text) from public, anon;
grant execute on function public.candidate_application_action(uuid, text, text) to authenticated;

-- After accepting an attachment offer: withdraw the candidate's other pending attachment applications.
create or replace function public.withdraw_other_attachment_applications(p_accepted uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  v_row record;
begin
  if not exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
     where a.id = p_accepted and a.candidate_id = auth.uid() and a.status = 'accepted' and o.type = 'industrial_attachment'
  ) then
    raise exception 'No accepted attachment offer found';
  end if;
  for v_row in
    select a.id, a.status from public.applications a join public.opportunities o on o.id = a.opportunity_id
     where a.candidate_id = auth.uid() and a.id <> p_accepted and o.type = 'industrial_attachment'
       and a.status in ('submitted', 'under_review', 'shortlisted', 'interview_invited', 'offer_made')
  loop
    update public.applications set status = 'withdrawn', status_changed_at = now() where id = v_row.id;
    insert into public.application_events (application_id, from_status, to_status, actor_id, note)
    values (v_row.id, v_row.status, 'withdrawn', auth.uid(), 'Withdrawn after accepting another attachment offer');
    update public.interviews set status = 'cancelled' where application_id = v_row.id and status in ('scheduled', 'confirmed');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.withdraw_other_attachment_applications(uuid) from public, anon;
grant execute on function public.withdraw_other_attachment_applications(uuid) to authenticated;

-- ------------------------------------------------------------------ interviews
create table public.interviews (
  id                    uuid primary key default gen_random_uuid(),
  application_id        uuid not null references public.applications (id) on delete cascade,
  scheduled_at          timestamptz not null,
  duration_minutes      int not null default 30 check (duration_minutes between 10 and 480),
  mode                  public.interview_mode not null,
  location              text not null check (char_length(location) between 2 and 500),   -- address or meeting link
  instructions          text check (char_length(instructions) <= 2000),
  status                public.interview_status not null default 'scheduled',
  candidate_response_at timestamptz,
  reminder_sent_at      timestamptz,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index interviews_app_idx on public.interviews (application_id);
create index interviews_time_idx on public.interviews (scheduled_at) where status in ('scheduled', 'confirmed');
create trigger interviews_updated before update on public.interviews
  for each row execute function public.set_updated_at();

alter table public.interviews enable row level security;
create policy interviews_candidate_select on public.interviews for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and a.candidate_id = auth.uid()));
create policy interviews_employer_select on public.interviews for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and public.owns_opportunity(a.opportunity_id)));
-- Writes only through the functions below.

create or replace function public.schedule_interview(
  p_application uuid,
  p_scheduled_at timestamptz,
  p_duration int,
  p_mode public.interview_mode,
  p_location text,
  p_instructions text default null,
  p_message text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_id uuid;
begin
  if public.my_role() <> 'employer' or not public.is_active_user() then raise exception 'Only employers can schedule interviews'; end if;
  select a.* into v_app from public.applications a where a.id = p_application and public.owns_opportunity(a.opportunity_id) for update;
  if v_app.id is null then raise exception 'Application not found'; end if;
  if v_app.status not in ('under_review', 'shortlisted', 'interview_invited') then
    raise exception 'Shortlist the candidate before scheduling an interview';
  end if;
  if p_scheduled_at <= now() then raise exception 'Choose a time in the future'; end if;

  -- A new invitation replaces any open one.
  update public.interviews set status = 'cancelled' where application_id = p_application and status in ('scheduled', 'confirmed');

  insert into public.interviews (application_id, scheduled_at, duration_minutes, mode, location, instructions, created_by)
  values (p_application, p_scheduled_at, p_duration, p_mode, trim(p_location), nullif(trim(coalesce(p_instructions, '')), ''), auth.uid())
  returning id into v_id;

  if v_app.status <> 'interview_invited' then
    update public.applications set status = 'interview_invited', status_changed_at = now() where id = p_application;
    insert into public.application_events (application_id, from_status, to_status, actor_id, note)
    values (p_application, v_app.status, 'interview_invited', auth.uid(), nullif(left(trim(coalesce(p_message, '')), 4000), ''));
  else
    -- Re-invite: keep the status, but tell the candidate.
    insert into public.application_events (application_id, from_status, to_status, actor_id, note)
    values (p_application, 'interview_invited', 'interview_invited', auth.uid(), coalesce(nullif(left(trim(coalesce(p_message, '')), 4000), ''), 'Interview rescheduled'));
  end if;
  return v_id;
end $$;
revoke all on function public.schedule_interview(uuid, timestamptz, int, public.interview_mode, text, text, text) from public, anon;
grant execute on function public.schedule_interview(uuid, timestamptz, int, public.interview_mode, text, text, text) to authenticated;

create or replace function public.cancel_interview(p_interview uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.interviews i set status = 'cancelled'
   where i.id = p_interview and i.status in ('scheduled', 'confirmed')
     and exists (select 1 from public.applications a where a.id = i.application_id and public.owns_opportunity(a.opportunity_id));
  if not found then raise exception 'Interview not found'; end if;
end $$;
revoke all on function public.cancel_interview(uuid) from public, anon;
grant execute on function public.cancel_interview(uuid) to authenticated;

create or replace function public.respond_to_interview(p_interview uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.interviews i
     set status = case when p_accept then 'confirmed'::public.interview_status else 'declined'::public.interview_status end,
         candidate_response_at = now()
   where i.id = p_interview and i.status in ('scheduled', 'confirmed') and i.scheduled_at > now()
     and exists (select 1 from public.applications a where a.id = i.application_id and a.candidate_id = auth.uid());
  if not found then raise exception 'Interview not found or no longer open'; end if;
end $$;
revoke all on function public.respond_to_interview(uuid, boolean) from public, anon;
grant execute on function public.respond_to_interview(uuid, boolean) to authenticated;

-- ------------------------------------------------------------------ message templates (employer-editable)
create table public.message_templates (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind       text not null check (kind in ('shortlist', 'interview', 'offer', 'rejection')),
  subject    text not null check (char_length(subject) between 1 and 160),
  body       text not null check (char_length(body) between 1 and 4000),
  updated_at timestamptz not null default now(),
  unique (company_id, kind)
);
create trigger message_templates_updated before update on public.message_templates
  for each row execute function public.set_updated_at();
alter table public.message_templates enable row level security;
create policy templates_owner_all on public.message_templates for all to authenticated
  using (public.owns_company(company_id)) with check (public.owns_company(company_id));
