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
