-- Mukana: all migrations in order (generated). Paste into the Supabase SQL editor and run once.

-- ===== 0001_core.sql =====
-- =====================================================================================
-- Mukana · 0001 · Extensions, enums, helpers, profiles, sign-up trigger
-- Run the migration files in numeric order (supabase db push does this automatically).
-- =====================================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ------------------------------------------------------------------ enums
create type public.user_role            as enum ('candidate', 'employer', 'admin');
create type public.account_status       as enum ('active', 'suspended');
create type public.candidate_type       as enum ('attachee', 'graduate_trainee');
create type public.qualification_level  as enum ('certificate', 'diploma', 'bachelors', 'honours', 'masters', 'phd');
create type public.degree_class         as enum ('first', 'upper_second', 'lower_second', 'third', 'pass');
create type public.opportunity_type     as enum ('industrial_attachment', 'graduate_trainee');
create type public.opportunity_status   as enum ('draft', 'published', 'closed');
create type public.work_mode            as enum ('on_site', 'hybrid');
create type public.stipend_type         as enum ('paid', 'unpaid');
create type public.currency_code        as enum ('USD', 'ZiG');
create type public.verification_status  as enum ('unverified', 'pending', 'approved', 'rejected');
create type public.application_status   as enum (
  'submitted', 'under_review', 'shortlisted', 'interview_invited', 'offer_made',
  'accepted', 'unsuccessful', 'withdrawn'
);
create type public.interview_mode       as enum ('physical', 'virtual');
create type public.interview_status     as enum ('scheduled', 'confirmed', 'declined', 'completed', 'cancelled');
create type public.report_target        as enum ('opportunity', 'company');
create type public.report_status        as enum ('open', 'actioned', 'dismissed');
create type public.notification_type    as enum (
  'application_received', 'application_status', 'interview_invite', 'interview_update',
  'interview_reminder', 'offer', 'offer_response', 'deadline_reminder',
  'verification', 'report', 'system'
);

-- ------------------------------------------------------------------ generic helpers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Africa/Harare "today" (Zimbabwe is UTC+2 all year, no daylight saving).
create or replace function public.harare_today()
returns date language sql stable as $$
  select (now() at time zone 'Africa/Harare')::date
$$;

-- ------------------------------------------------------------------ profiles
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  role            public.user_role not null default 'candidate',
  status          public.account_status not null default 'active',
  full_name       text not null default '' check (char_length(full_name) <= 120),
  email           text not null,
  phone           text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  avatar_path     text,
  consent_at      timestamptz not null default now(),
  consent_version text not null default '2026-10',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role helpers. SECURITY DEFINER so RLS policies can call them without recursion.
create or replace function public.my_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' and status = 'active' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'active' from public.profiles where id = auth.uid()), false)
$$;

-- True when the signed-in user has confirmed their email address.
create or replace function public.email_is_verified()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce((select email_confirmed_at is not null from auth.users where id = auth.uid()), false)
$$;

-- ------------------------------------------------------------------ sign-up trigger
-- Creates the profile row from the sign-up metadata. Only 'candidate' and 'employer' can ever be
-- chosen at sign-up; 'admin' is impossible through public sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_role public.user_role;
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if coalesce(v_meta ->> 'consent', 'false') <> 'true' then
    raise exception 'Consent to the Privacy Policy and Terms is required to create an account';
  end if;

  v_role := case when v_meta ->> 'role' = 'employer' then 'employer'::public.user_role
                 else 'candidate'::public.user_role end;

  insert into public.profiles (id, role, full_name, email, phone)
  values (
    new.id,
    v_role,
    left(coalesce(nullif(trim(v_meta ->> 'full_name'), ''), split_part(new.email, '@', 1)), 120),
    new.email,
    nullif(trim(v_meta ->> 'phone'), '')
  );

  if v_role = 'candidate' then
    insert into public.candidate_profiles (user_id, candidate_type)
    values (
      new.id,
      case when v_meta ->> 'candidate_type' = 'graduate_trainee'
           then 'graduate_trainee'::public.candidate_type else 'attachee'::public.candidate_type end
    );
  end if;

  if v_role = 'employer' then
    insert into public.companies (owner_id, name)
    values (new.id, left(coalesce(nullif(trim(v_meta ->> 'company_name'), ''), 'My company'), 160));
  end if;

  -- Server-controlled claim used by the Next.js proxy for role-based routing.
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_role::text)
   where id = new.id;

  return new;
end $$;

-- Prevent users from changing their own role or status.
-- SECURITY INVOKER on purpose: current_user must be the real caller (a definer function would always
-- see its owner). Calls made from our own admin RPCs run as the owner, which is allowed.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not (public.is_admin() or auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin')) then
    raise exception 'Role and status can only be changed by an administrator';
  end if;
  if new.email is distinct from old.email
     and not (auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin')) then
    new.email := old.email;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Promote an existing user to admin. Not callable by clients: run it from the SQL editor,
-- or with the service role key. See README ("Creating the first admin").
create or replace function public.promote_to_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  -- Not granted to clients; only the service role / database owner (SQL editor) can call this.
  if not (auth.role() is null or auth.role() = 'service_role') then
    raise exception 'Only the database owner can create admins';
  end if;
  update public.profiles set role = 'admin' where id = p_user_id;
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where id = p_user_id;
end $$;
revoke all on function public.promote_to_admin(uuid) from public, anon, authenticated;
grant execute on function public.promote_to_admin(uuid) to service_role;

-- RLS: profiles. (Employer/admin read access is added in later migrations once the tables exist.)
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on public.profiles for select to authenticated using (public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- No insert/delete policies: rows are created by the sign-up trigger and removed by account deletion.

-- ===== 0002_profiles.sql =====
-- =====================================================================================
-- Mukana · 0002 · Candidate profiles, companies, verification, profile completeness
-- =====================================================================================

-- ------------------------------------------------------------------ candidate profiles
create table public.candidate_profiles (
  user_id               uuid primary key references public.profiles (id) on delete cascade,
  candidate_type        public.candidate_type not null default 'attachee',
  city                  text check (char_length(city) <= 80),
  province              text check (char_length(province) <= 80),
  bio                   text check (char_length(bio) <= 1000),
  skills                text[] not null default '{}' check (cardinality(skills) <= 40),
  certifications        jsonb not null default '[]'::jsonb,   -- [{name, issuer, year}]
  projects              jsonb not null default '[]'::jsonb,   -- [{title, description, url}]
  coursework            text[] not null default '{}',
  volunteer             jsonb not null default '[]'::jsonb,   -- [{role, organisation, description}]
  cv_path               text,
  cv_updated_at         timestamptz,
  institution           text check (char_length(institution) <= 160),
  -- attachee
  programme             text check (char_length(programme) <= 160),
  current_level         numeric(2,1) check (current_level is null or (current_level >= 1 and current_level <= 6)),
  registration_number   text check (char_length(registration_number) <= 40),
  attachment_start      date,
  attachment_end        date,
  placement_letter_path text,
  -- graduate trainee
  qualification         text check (char_length(qualification) <= 160),
  qualification_level   public.qualification_level,
  degree_class          public.degree_class,
  graduation_year       int check (graduation_year is null or graduation_year between 1990 and 2100),
  availability_date     date,
  updated_at            timestamptz not null default now(),
  constraint attachment_dates_ordered check (attachment_end is null or attachment_start is null or attachment_end >= attachment_start)
);
create index candidate_profiles_type_idx on public.candidate_profiles (candidate_type);
create index candidate_profiles_skills_idx on public.candidate_profiles using gin (skills);
create trigger candidate_profiles_updated before update on public.candidate_profiles
  for each row execute function public.set_updated_at();

alter table public.candidate_profiles enable row level security;
create policy candidate_profiles_owner_select on public.candidate_profiles for select to authenticated
  using (user_id = auth.uid());
create policy candidate_profiles_owner_update on public.candidate_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy candidate_profiles_admin_select on public.candidate_profiles for select to authenticated
  using (public.is_admin());
-- Rows are created by the sign-up trigger. Employer read access is added in 0004 (applicants only).

-- Candidates may only point file columns at objects inside their own storage folder.
create or replace function public.guard_candidate_file_paths()
returns trigger language plpgsql as $$
begin
  if new.cv_path is not null and split_part(new.cv_path, '/', 1) <> new.user_id::text then
    raise exception 'Invalid CV path';
  end if;
  if new.placement_letter_path is not null and split_part(new.placement_letter_path, '/', 1) <> new.user_id::text then
    raise exception 'Invalid placement letter path';
  end if;
  if new.cv_path is distinct from old.cv_path then new.cv_updated_at := now(); end if;
  return new;
end $$;
create trigger candidate_profiles_guard before update on public.candidate_profiles
  for each row execute function public.guard_candidate_file_paths();

-- ------------------------------------------------------------------ companies
create table public.companies (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null unique references public.profiles (id) on delete cascade,
  name                text not null default '' check (char_length(name) <= 160),
  logo_path           text,
  industry            text check (char_length(industry) <= 120),
  location            text check (char_length(location) <= 160),
  website             text check (website is null or website ~* '^https?://'),
  description         text check (char_length(description) <= 2000),
  verification_status public.verification_status not null default 'unverified',
  verified_at         timestamptz,
  suspended           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index companies_verification_idx on public.companies (verification_status);
create trigger companies_updated before update on public.companies
  for each row execute function public.set_updated_at();

-- Registration details and the authorised representative are private (owner + admin only).
create table public.company_private (
  company_id          uuid primary key references public.companies (id) on delete cascade,
  registration_number text check (char_length(registration_number) <= 60),
  registration_details text check (char_length(registration_details) <= 1000),
  rep_name            text check (char_length(rep_name) <= 120),
  rep_title           text check (char_length(rep_title) <= 120),
  rep_phone           text check (rep_phone is null or rep_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  rep_email           text check (rep_email is null or rep_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at          timestamptz not null default now()
);
create trigger company_private_updated before update on public.company_private
  for each row execute function public.set_updated_at();

create or replace function public.owns_company(p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies where id = p_company and owner_id = auth.uid())
$$;

create or replace function public.my_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.companies where owner_id = auth.uid()
$$;

-- SECURITY INVOKER: see the note on protect_profile_columns() in 0001.
create or replace function public.protect_company_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.verification_status is distinct from old.verification_status
      or new.verified_at is distinct from old.verified_at
      or new.suspended is distinct from old.suspended
      or new.owner_id is distinct from old.owner_id)
     and not (public.is_admin() or auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin')) then
    raise exception 'Verification and moderation fields can only be changed by an administrator';
  end if;
  if new.logo_path is not null and split_part(new.logo_path, '/', 1) <> new.id::text then
    raise exception 'Invalid logo path';
  end if;
  return new;
end $$;
create trigger companies_protect before update on public.companies
  for each row execute function public.protect_company_columns();

create or replace function public.create_company_private()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.company_private (company_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger companies_private_row after insert on public.companies
  for each row execute function public.create_company_private();

alter table public.companies enable row level security;
-- Public company details (name, logo, industry...) are visible to everyone, including visitors.
create policy companies_public_select on public.companies for select to anon, authenticated using (not suspended);
create policy companies_owner_select on public.companies for select to authenticated using (owner_id = auth.uid());
create policy companies_admin_select on public.companies for select to authenticated using (public.is_admin());
create policy companies_owner_update on public.companies for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.company_private enable row level security;
create policy company_private_owner_select on public.company_private for select to authenticated using (public.owns_company(company_id));
create policy company_private_owner_update on public.company_private for update to authenticated
  using (public.owns_company(company_id)) with check (public.owns_company(company_id));
create policy company_private_admin_select on public.company_private for select to authenticated using (public.is_admin());

-- ------------------------------------------------------------------ verification requests
create table public.verification_requests (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  status        public.verification_status not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  document_paths text[] not null default '{}' check (cardinality(document_paths) between 1 and 6),
  note          text check (char_length(note) <= 1000),
  reason        text check (char_length(reason) <= 1000),   -- admin's reason when rejecting
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index verification_requests_company_idx on public.verification_requests (company_id, created_at desc);
create index verification_requests_status_idx on public.verification_requests (status, created_at);
-- At most one pending request per company.
create unique index verification_requests_one_pending on public.verification_requests (company_id) where status = 'pending';

alter table public.verification_requests enable row level security;
create policy verification_owner_select on public.verification_requests for select to authenticated using (public.owns_company(company_id));
create policy verification_admin_select on public.verification_requests for select to authenticated using (public.is_admin());
-- Inserts and reviews go through the RPCs below.

create or replace function public.request_verification(p_document_paths text[], p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company public.companies;
  v_id uuid;
  v_path text;
begin
  if public.my_role() <> 'employer' or not public.is_active_user() then
    raise exception 'Only employers can request verification';
  end if;
  select * into v_company from public.companies where owner_id = auth.uid();
  if v_company.id is null then raise exception 'Company profile not found'; end if;
  if v_company.verification_status = 'approved' then raise exception 'Company is already verified'; end if;
  if v_company.verification_status = 'pending' then raise exception 'A verification request is already pending'; end if;
  if coalesce(trim(v_company.name), '') = '' then raise exception 'Add your company name first'; end if;
  if p_document_paths is null or cardinality(p_document_paths) = 0 then
    raise exception 'Upload at least one supporting document';
  end if;
  foreach v_path in array p_document_paths loop
    if split_part(v_path, '/', 1) <> v_company.id::text then
      raise exception 'Invalid document path';
    end if;
  end loop;

  insert into public.verification_requests (company_id, document_paths, note)
  values (v_company.id, p_document_paths, left(p_note, 1000))
  returning id into v_id;

  update public.companies set verification_status = 'pending' where id = v_company.id;
  return v_id;
end $$;
revoke all on function public.request_verification(text[], text) from public, anon;
grant execute on function public.request_verification(text[], text) to authenticated;

-- ------------------------------------------------------------------ profile completeness
-- Returns {percent, missing: [labels], complete: bool}. A candidate must reach 100% before applying.
create or replace function public.profile_completeness(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles;
  c public.candidate_profiles;
  checks jsonb := '[]'::jsonb;
  total int := 0;
  done int := 0;
  missing text[] := '{}';
  item record;
begin
  if auth.role() is not null and auth.role() <> 'service_role'
     and p_user is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  select * into p from public.profiles where id = p_user;
  select * into c from public.candidate_profiles where user_id = p_user;
  if p.id is null or c.user_id is null then
    return jsonb_build_object('percent', 0, 'missing', '[]'::jsonb, 'complete', false);
  end if;

  for item in
    select * from (values
      ('Full name',               length(trim(coalesce(p.full_name, ''))) > 1),
      ('Phone number',            p.phone is not null and length(trim(p.phone)) > 0),
      ('City',                    coalesce(trim(c.city), '') <> ''),
      ('Province',                coalesce(trim(c.province), '') <> ''),
      ('At least 3 skills',       cardinality(c.skills) >= 3),
      ('CV (PDF)',                c.cv_path is not null),
      ('Institution',             coalesce(trim(c.institution), '') <> '')
    ) as t(label, ok)
  loop
    total := total + 1;
    if item.ok then done := done + 1; else missing := missing || item.label; end if;
  end loop;

  if c.candidate_type = 'attachee' then
    for item in
      select * from (values
        ('Programme of study',          coalesce(trim(c.programme), '') <> ''),
        ('Current level (e.g. 2.2)',    c.current_level is not null),
        ('Registration number',         coalesce(trim(c.registration_number), '') <> ''),
        ('Attachment start date',       c.attachment_start is not null),
        ('Attachment end date',         c.attachment_end is not null)
      ) as t(label, ok)
    loop
      total := total + 1;
      if item.ok then done := done + 1; else missing := missing || item.label; end if;
    end loop;
  else
    for item in
      select * from (values
        ('Qualification',               coalesce(trim(c.qualification), '') <> ''),
        ('Qualification level',         c.qualification_level is not null),
        ('Degree class',                c.degree_class is not null),
        ('Graduation year',             c.graduation_year is not null),
        ('Availability date',           c.availability_date is not null)
      ) as t(label, ok)
    loop
      total := total + 1;
      if item.ok then done := done + 1; else missing := missing || item.label; end if;
    end loop;
  end if;

  return jsonb_build_object(
    'percent', round(done * 100.0 / total),
    'missing', to_jsonb(missing),
    'complete', done = total
  );
end $$;
revoke all on function public.profile_completeness(uuid) from public, anon;
grant execute on function public.profile_completeness(uuid) to authenticated, service_role;

-- ------------------------------------------------------------------ attach sign-up trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== 0003_storage.sql =====
-- =====================================================================================
-- Mukana · 0003 · Storage buckets and owner policies
-- Object path convention: <owner folder>/<filename>
--   cvs, placement-letters, avatars         -> <user id>/...
--   company-logos, verification-docs        -> <company id>/...
-- Bucket-level limits are enforced by Storage itself (size + MIME), in addition to the
-- client checks and the server-side magic-byte check performed by the app after upload.
-- =====================================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cvs',               'cvs',               false, 5242880, array['application/pdf']),
  ('placement-letters', 'placement-letters', false, 5242880, array['application/pdf']),
  ('avatars',           'avatars',           false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('company-logos',     'company-logos',     true,  1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('verification-docs', 'verification-docs', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---- candidate-owned private buckets: full control of own folder only
create policy "cvs owner all" on storage.objects for all to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "placement letters owner all" on storage.objects for all to authenticated
  using (bucket_id = 'placement-letters' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'placement-letters' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner all" on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- company logos: public read, only the owning employer writes
create policy "company logos public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'company-logos');
create policy "company logos owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = public.my_company_id()::text);
create policy "company logos owner update" on storage.objects for update to authenticated
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = public.my_company_id()::text);
create policy "company logos owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = public.my_company_id()::text);

-- ---- verification documents: owning employer + admins can read; employer writes
create policy "verification docs owner all" on storage.objects for all to authenticated
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = public.my_company_id()::text)
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = public.my_company_id()::text);
create policy "verification docs admin read" on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and public.is_admin());

-- ===== 0004_opportunities.sql =====
-- =====================================================================================
-- Mukana · 0004 · Opportunities, saved opportunities, auto-close
-- =====================================================================================

create table public.opportunities (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  type              public.opportunity_type not null,
  title             text not null check (char_length(title) between 3 and 160),
  department        text check (char_length(department) <= 120),
  description       text not null check (char_length(description) between 20 and 8000),
  requirements      text check (char_length(requirements) <= 4000),
  skills            text[] not null default '{}' check (cardinality(skills) <= 30),
  eligible_fields   text[] not null default '{}' check (cardinality(eligible_fields) <= 30),
  min_level         numeric(2,1) check (min_level is null or (min_level >= 1 and min_level <= 6)),
  min_qualification public.qualification_level,
  slots             int not null default 1 check (slots between 1 and 1000),
  location          text not null check (char_length(location) between 2 and 160),
  province          text check (char_length(province) <= 80),
  mode              public.work_mode not null default 'on_site',
  start_date        date,
  duration_months   int check (duration_months is null or duration_months between 1 and 36),
  stipend_type      public.stipend_type not null default 'unpaid',
  stipend_amount    numeric(10,2) check (stipend_amount is null or stipend_amount >= 0),
  stipend_currency  public.currency_code,
  deadline          date not null,
  status            public.opportunity_status not null default 'draft',
  published_at      timestamptz,
  closed_at         timestamptz,
  suspended         boolean not null default false,   -- set by admin moderation
  search_text       text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index opportunities_company_idx   on public.opportunities (company_id, status);
create index opportunities_listing_idx   on public.opportunities (status, deadline desc) where status = 'published';
create index opportunities_type_idx      on public.opportunities (type);
create index opportunities_start_idx     on public.opportunities (start_date);
create index opportunities_search_trgm   on public.opportunities using gin (search_text gin_trgm_ops);
create index opportunities_fields_gin    on public.opportunities using gin (eligible_fields);

-- Keeps derived/normalised columns tidy and enforces the publishing rules.
-- SECURITY INVOKER: see the note on protect_profile_columns() in 0001.
create or replace function public.opportunities_before_write()
returns trigger language plpgsql set search_path = public as $$
declare
  v_company public.companies;
  v_privileged boolean := public.is_admin() or auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin');
begin
  -- Normalise type-specific fields.
  if new.type = 'industrial_attachment' then
    new.min_qualification := null;
  else
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
create trigger opportunities_write before insert or update on public.opportunities
  for each row execute function public.opportunities_before_write();
create trigger opportunities_updated before update on public.opportunities
  for each row execute function public.set_updated_at();

alter table public.opportunities enable row level security;

-- Anyone (including visitors) can read published/closed opportunities of non-suspended companies.
create policy opportunities_public_select on public.opportunities for select to anon, authenticated
  using (status in ('published', 'closed') and not suspended
         and exists (select 1 from public.companies c where c.id = company_id and not c.suspended));
create policy opportunities_owner_select on public.opportunities for select to authenticated
  using (public.owns_company(company_id));
create policy opportunities_admin_select on public.opportunities for select to authenticated
  using (public.is_admin());
create policy opportunities_owner_insert on public.opportunities for insert to authenticated
  with check (public.owns_company(company_id) and public.my_role() = 'employer' and public.is_active_user());
create policy opportunities_owner_update on public.opportunities for update to authenticated
  using (public.owns_company(company_id) and public.is_active_user())
  with check (public.owns_company(company_id));
create policy opportunities_owner_delete on public.opportunities for delete to authenticated
  using (public.owns_company(company_id) and status = 'draft');

-- ------------------------------------------------------------------ saved opportunities
create table public.saved_opportunities (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);
create index saved_opportunities_opp_idx on public.saved_opportunities (opportunity_id);

alter table public.saved_opportunities enable row level security;
create policy saved_select_own on public.saved_opportunities for select to authenticated using (user_id = auth.uid());
create policy saved_insert_own on public.saved_opportunities for insert to authenticated
  with check (user_id = auth.uid() and public.my_role() = 'candidate');
create policy saved_delete_own on public.saved_opportunities for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------------ auto-close past-deadline opportunities
-- Called by the `close-expired-opportunities` Edge Function (pg_cron + pg_net), see 0009_cron.sql.
create or replace function public.close_expired_opportunities()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with closed as (
    update public.opportunities
       set status = 'closed'
     where status = 'published' and deadline < public.harare_today()
    returning id
  )
  select count(*) into v_count from closed;
  return v_count;
end $$;
revoke all on function public.close_expired_opportunities() from public, anon, authenticated;
grant execute on function public.close_expired_opportunities() to service_role;

-- ===== 0005_matching.sql =====
-- =====================================================================================
-- Mukana · 0005 · Rule-based, explainable matching (no black-box AI)
--
-- Score 0-100 = field/programme 35 + skills 30 + level/qualification 15 + availability 15 + location 5.
-- The score only RANKS and EXPLAINS. Nothing is ever rejected automatically; employers decide.
-- =====================================================================================

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
  if (c.candidate_type = 'attachee') <> (o.type = 'industrial_attachment') then
    return jsonb_build_object(
      'score', 0,
      'reason', case when o.type = 'industrial_attachment' then 'This is an attachment opportunity; your profile is set up as a graduate trainee'
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
  if o.type = 'industrial_attachment' then
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
  elsif o.type = 'industrial_attachment' then
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
revoke all on function public.match_internal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.match_internal(uuid, uuid) to service_role;

-- Public wrapper: a candidate can score themselves against any visible opportunity.
-- Employers get scores only for candidates who applied to their own opportunities.
create or replace function public.compute_match(p_candidate uuid, p_opportunity uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_candidate = auth.uid() then
    if not exists (
      select 1 from public.opportunities o
       where o.id = p_opportunity and (o.status in ('published', 'closed') or public.owns_company(o.company_id))
    ) then
      return null;
    end if;
  elsif public.is_admin() then
    null;
  elsif not exists (
    select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
     where a.candidate_id = p_candidate and a.opportunity_id = p_opportunity and public.owns_company(o.company_id)
  ) then
    raise exception 'Not allowed';
  end if;
  return public.match_internal(p_candidate, p_opportunity);
end $$;
revoke all on function public.compute_match(uuid, uuid) from public, anon;
grant execute on function public.compute_match(uuid, uuid) to authenticated;

-- "Recommended for you": best open opportunities for the signed-in candidate, highest score first.
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
           and (o2.type = 'industrial_attachment') = (v_type = 'attachee')
           and not exists (select 1 from public.applications a where a.opportunity_id = o2.id and a.candidate_id = auth.uid())
           and exists (select 1 from public.companies c where c.id = o2.company_id and not c.suspended)
         order by o2.published_at desc nulls last
         limit 300
      ) o
      cross join lateral (select public.match_internal(auth.uid(), o.id) as j) m
     order by (m.j ->> 'score')::int desc, o.deadline asc
     limit greatest(1, least(p_limit, 100));
end $$;
revoke all on function public.recommended_opportunities(int) from public, anon;
grant execute on function public.recommended_opportunities(int) to authenticated;

-- ===== 0006_applications.sql =====
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

-- ===== 0007_notifications.sql =====
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

-- ===== 0008_admin_privacy.sql =====
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

-- ===== 0009_cron.sql =====
-- =====================================================================================
-- Mukana · 0009 · Scheduled jobs (pg_cron + pg_net -> Edge Functions)
--
-- After the Edge Functions are deployed, store where they live and the shared secret ONCE:
--
--   insert into public.app_config (key, value) values
--     ('edge_base_url', 'https://<PROJECT-REF>.supabase.co/functions/v1'),
--     ('cron_secret',   '<the same value as the CRON_SECRET Edge Function secret>')
--   on conflict (key) do update set value = excluded.value;
--
-- Until that row exists the jobs below simply do nothing.
-- =====================================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.call_edge_function(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from public.app_config where key = 'edge_base_url';
  select value into v_secret from public.app_config where key = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end $$;
revoke all on function public.call_edge_function(text) from public, anon, authenticated;

-- Zimbabwe is UTC+2 all year. cron runs in UTC.
-- Safety-net delivery of any notification the instant trigger missed.
select cron.schedule('mukana-send-notifications', '*/5 * * * *', $$select public.call_edge_function('send-notifications')$$);
-- Deadline reminders (3 days and 1 day before) every morning at 08:00 Harare.
select cron.schedule('mukana-deadline-reminders', '0 6 * * *', $$select public.call_edge_function('deadline-reminders')$$);
-- Interview reminders (24h before): hourly.
select cron.schedule('mukana-interview-reminders', '10 * * * *', $$select public.call_edge_function('interview-reminders')$$);
-- Close opportunities whose deadline passed: just after midnight Harare.
select cron.schedule('mukana-close-expired', '5 22 * * *', $$select public.call_edge_function('close-expired-opportunities')$$);

-- ===== 0010_cv_builder.sql =====
-- =====================================================================================
-- Mukana · 0010 · CV builder drafts
-- The generated PDFs themselves live in the private `cvs` bucket (<user id>/cv_builder-*.pdf).
-- =====================================================================================

create table public.cv_drafts (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  template   text not null default 'classic' check (template in ('classic', 'modern')),
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) < 60000),
  updated_at timestamptz not null default now()
);
create trigger cv_drafts_updated before update on public.cv_drafts
  for each row execute function public.set_updated_at();

alter table public.cv_drafts enable row level security;
create policy cv_drafts_own on public.cv_drafts for all to authenticated
  using (user_id = auth.uid() and public.my_role() = 'candidate')
  with check (user_id = auth.uid() and public.my_role() = 'candidate');
