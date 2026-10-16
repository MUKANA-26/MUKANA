-- =====================================================================================
-- Mukana · 0008 · Reports, admin moderation (all audited), platform stats, data export
-- =====================================================================================

-- ------------------------------------------------------------------ reports
create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references public.profiles (id) on delete cascade,
  target_type     public.report_target not null,
  opportunity_id  uuid references public.opportunities (id) on delete cascade,
  company_id      uuid references public.companies (id) on delete cascade,
  reason          text not null check (reason in ('scam_or_fee', 'misleading', 'discriminatory', 'inappropriate', 'duplicate', 'other')),
  details         text check (char_length(details) <= 2000),
  status          public.report_status not null default 'open',
  resolved_by     uuid references public.profiles (id) on delete set null,
  resolved_at     timestamptz,
  resolution_note text check (char_length(resolution_note) <= 1000),
  created_at      timestamptz not null default now(),
  constraint report_has_one_target check (
    (target_type = 'opportunity' and opportunity_id is not null and company_id is null) or
    (target_type = 'company' and company_id is not null and opportunity_id is null))
);
create index reports_status_idx on public.reports (status, created_at desc);
-- A user can have only one open report per target.
create unique index reports_one_open_per_target on public.reports (reporter_id, coalesce(opportunity_id, company_id)) where status = 'open';

alter table public.reports enable row level security;
create policy reports_insert_own on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and resolved_by is null and public.is_active_user());
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = auth.uid());
create policy reports_admin_select on public.reports for select to authenticated using (public.is_admin());

-- ------------------------------------------------------------------ audit log
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
create policy audit_log_admin_select on public.audit_log for select to authenticated using (public.is_admin());
-- Append-only: no write policies, privileges revoked, and the table is written only by audit() below.
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;

create or replace function public.audit(p_action text, p_target_type text, p_target uuid, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target, coalesce(p_details, '{}'::jsonb))
$$;
revoke all on function public.audit(text, text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
end $$;
revoke all on function public.require_admin() from public, anon;
grant execute on function public.require_admin() to authenticated;

-- ------------------------------------------------------------------ verification review
create or replace function public.admin_review_verification(p_request uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_req public.verification_requests;
begin
  perform public.require_admin();
  select * into v_req from public.verification_requests where id = p_request for update;
  if v_req.id is null or v_req.status <> 'pending' then raise exception 'This request has already been reviewed'; end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then raise exception 'Give a reason when rejecting a request'; end if;

  update public.verification_requests
     set status = case when p_approve then 'approved'::public.verification_status else 'rejected'::public.verification_status end,
         reason = case when p_approve then null else left(trim(p_reason), 1000) end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_request;
  update public.companies
     set verification_status = case when p_approve then 'approved'::public.verification_status else 'rejected'::public.verification_status end,
         verified_at = case when p_approve then now() else null end
   where id = v_req.company_id;
  perform public.audit(case when p_approve then 'verification.approve' else 'verification.reject' end, 'company', v_req.company_id,
                       jsonb_build_object('request_id', p_request, 'reason', p_reason));
end $$;
revoke all on function public.admin_review_verification(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_verification(uuid, boolean, text) to authenticated;

create or replace function public.notify_on_verification_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_name text;
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    select owner_id, name into v_owner, v_name from public.companies where id = new.company_id;
    perform public.notify(v_owner, 'verification',
      case when new.status = 'approved' then 'Your company is verified' else 'Verification not approved' end,
      case when new.status = 'approved' then v_name || ' now has the Verified badge. You can publish opportunities.'
           else 'Reason: ' || coalesce(new.reason, 'not provided') end,
      '/employer/company', jsonb_build_object('request_id', new.id));
  end if;
  return new;
end $$;
create trigger verification_requests_notify after update on public.verification_requests
  for each row execute function public.notify_on_verification_review();

-- ------------------------------------------------------------------ moderation actions
create or replace function public.admin_set_company_suspended(p_company uuid, p_suspended boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  perform public.require_admin();
  update public.companies set suspended = p_suspended where id = p_company returning owner_id into v_owner;
  if v_owner is null then raise exception 'Company not found'; end if;
  perform public.audit(case when p_suspended then 'company.suspend' else 'company.restore' end, 'company', p_company, jsonb_build_object('reason', p_reason));
  perform public.notify(v_owner, 'system',
    case when p_suspended then 'Your company has been suspended' else 'Your company has been restored' end,
    coalesce(p_reason, ''), '/employer/company');
end $$;
revoke all on function public.admin_set_company_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_company_suspended(uuid, boolean, text) to authenticated;

-- "Remove" = suspend and close, so the listing disappears everywhere but the record (and audit trail) remains.
create or replace function public.admin_moderate_opportunity(p_opportunity uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text;
begin
  perform public.require_admin();
  if p_action not in ('suspend', 'restore', 'remove') then raise exception 'Unknown action'; end if;
  select c.owner_id, o.title into v_owner, v_title
    from public.opportunities o join public.companies c on c.id = o.company_id where o.id = p_opportunity;
  if v_owner is null then raise exception 'Opportunity not found'; end if;

  if p_action = 'restore' then
    update public.opportunities set suspended = false where id = p_opportunity;
  elsif p_action = 'suspend' then
    update public.opportunities set suspended = true where id = p_opportunity;
  else
    update public.opportunities set suspended = true, status = 'closed' where id = p_opportunity;
  end if;
  perform public.audit('opportunity.' || p_action, 'opportunity', p_opportunity, jsonb_build_object('reason', p_reason));
  perform public.notify(v_owner, 'system',
    case p_action when 'restore' then 'Opportunity restored' when 'suspend' then 'Opportunity suspended' else 'Opportunity removed' end,
    v_title || coalesce(' · ' || nullif(p_reason, ''), ''), '/employer/opportunities');
end $$;
revoke all on function public.admin_moderate_opportunity(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_opportunity(uuid, text, text) to authenticated;

create or replace function public.admin_set_user_status(p_user uuid, p_status public.account_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_role public.user_role;
begin
  perform public.require_admin();
  if p_user = auth.uid() then raise exception 'You cannot change your own status'; end if;
  select role into v_role from public.profiles where id = p_user;
  if v_role is null then raise exception 'User not found'; end if;
  if v_role = 'admin' then raise exception 'Administrators cannot be suspended here'; end if;
  update public.profiles set status = p_status where id = p_user;
  perform public.audit(case when p_status = 'suspended' then 'user.suspend' else 'user.restore' end, 'user', p_user, jsonb_build_object('reason', p_reason));
end $$;
revoke all on function public.admin_set_user_status(uuid, public.account_status, text) from public, anon;
grant execute on function public.admin_set_user_status(uuid, public.account_status, text) to authenticated;

-- Admin accounts are created only by an existing admin (here) or directly in the database
-- (promote_to_admin in 0001). Never through public sign-up.
create or replace function public.admin_create_admin(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.require_admin();
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'User not found'; end if;
  update public.profiles set role = 'admin', status = 'active' where id = p_user;
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb where id = p_user;
  perform public.audit('user.make_admin', 'user', p_user, '{}'::jsonb);
end $$;
revoke all on function public.admin_create_admin(uuid) from public, anon;
grant execute on function public.admin_create_admin(uuid) to authenticated;

create or replace function public.admin_resolve_report(p_report uuid, p_status public.report_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p_status = 'open' then raise exception 'Choose actioned or dismissed'; end if;
  update public.reports
     set status = p_status, resolved_by = auth.uid(), resolved_at = now(), resolution_note = left(trim(p_note), 1000)
   where id = p_report and status = 'open';
  if not found then raise exception 'Report not found or already resolved'; end if;
  perform public.audit('report.' || p_status::text, 'report', p_report, jsonb_build_object('note', p_note));
end $$;
revoke all on function public.admin_resolve_report(uuid, public.report_status, text) from public, anon;
grant execute on function public.admin_resolve_report(uuid, public.report_status, text) to authenticated;

-- ------------------------------------------------------------------ platform statistics
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'users', jsonb_build_object(
      'candidates', (select count(*) from public.profiles where role = 'candidate'),
      'employers', (select count(*) from public.profiles where role = 'employer'),
      'admins', (select count(*) from public.profiles where role = 'admin'),
      'suspended', (select count(*) from public.profiles where status = 'suspended'),
      'new_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days')),
    'companies', jsonb_build_object(
      'verified', (select count(*) from public.companies where verification_status = 'approved'),
      'pending', (select count(*) from public.companies where verification_status = 'pending'),
      'suspended', (select count(*) from public.companies where suspended)),
    'opportunities', jsonb_build_object(
      'published', (select count(*) from public.opportunities where status = 'published' and not suspended),
      'closed', (select count(*) from public.opportunities where status = 'closed'),
      'draft', (select count(*) from public.opportunities where status = 'draft'),
      'attachments', (select count(*) from public.opportunities where type = 'industrial_attachment' and status = 'published'),
      'trainee', (select count(*) from public.opportunities where type = 'graduate_trainee' and status = 'published')),
    'applications', jsonb_build_object(
      'total', (select count(*) from public.applications),
      'new_30d', (select count(*) from public.applications where submitted_at > now() - interval '30 days'),
      'accepted', (select count(*) from public.applications where status = 'accepted'),
      'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from public.applications group by status) s)),
    'reports', jsonb_build_object('open', (select count(*) from public.reports where status = 'open')),
    'signups_by_week', (
      select coalesce(jsonb_agg(jsonb_build_object('week', w, 'count', n) order by w), '[]'::jsonb)
        from (select date_trunc('week', created_at)::date as w, count(*) n from public.profiles
               where created_at > now() - interval '8 weeks' group by 1) x)
  );
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- Admin user directory: profile + company name, with simple search and paging.
create or replace function public.admin_list_users(p_search text default null, p_role public.user_role default null, p_limit int default 20, p_offset int default 0)
returns table (id uuid, full_name text, email text, role public.user_role, status public.account_status, created_at timestamptz, company_name text, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
    select p.id, p.full_name, p.email, p.role, p.status, p.created_at, c.name, count(*) over () as total
      from public.profiles p left join public.companies c on c.owner_id = p.id
     where (p_role is null or p.role = p_role)
       and (p_search is null or p_search = '' or p.full_name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
     order by p.created_at desc
     limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
end $$;
revoke all on function public.admin_list_users(text, public.user_role, int, int) from public, anon;
grant execute on function public.admin_list_users(text, public.user_role, int, int) to authenticated;

-- ------------------------------------------------------------------ employer analytics
create or replace function public.opportunity_analytics(p_company uuid default null)
returns table (
  opportunity_id uuid, title text, status public.opportunity_status, applications bigint,
  by_status jsonb, avg_match numeric, time_to_fill_days numeric
) language plpgsql stable security definer set search_path = public as $$
declare v_company uuid := coalesce(p_company, public.my_company_id());
begin
  if v_company is null or not (public.owns_company(v_company) or public.is_admin()) then raise exception 'Not allowed'; end if;
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
revoke all on function public.opportunity_analytics(uuid) from public, anon;
grant execute on function public.opportunity_analytics(uuid) to authenticated;

-- ------------------------------------------------------------------ privacy: data export
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
    'consent', (select jsonb_build_object('consent_at', consent_at, 'consent_version', consent_version) from public.profiles where id = v_user)
  );
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
