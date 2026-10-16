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
