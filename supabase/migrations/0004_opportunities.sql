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
