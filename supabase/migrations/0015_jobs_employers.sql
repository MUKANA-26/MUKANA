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
