-- =====================================================================================
-- Mukana · 0019 · Career hub
--   Interview Preparation Centre, Skills Development Hub (own lessons), Career Path Explorer,
--   "no experience needed" flag, richer company profiles, company directory, follows and moderated reviews.
-- =====================================================================================

-- ------------------------------------------------------------------ categories shared by the learning areas
create table public.content_categories (
  kind        text not null check (kind in ('interview', 'lesson', 'career')),
  slug        text not null,
  label       text not null,
  description text,
  position    int not null default 100,
  primary key (kind, slug)
);
alter table public.content_categories enable row level security;
create policy content_categories_public on public.content_categories for select to anon, authenticated using (true);

-- ------------------------------------------------------------------ interview preparation
create table public.interview_questions (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  question   text not null check (char_length(question) between 5 and 400),
  answer     text not null check (char_length(answer) between 10 and 4000),
  tip        text check (tip is null or char_length(tip) <= 600),
  audience   text not null default 'all' check (audience in ('all', 'attachee', 'graduate_trainee')),
  position   int not null default 100,
  published  boolean not null default true,
  created_at timestamptz not null default now()
);
create index interview_questions_cat_idx on public.interview_questions (category, position);
alter table public.interview_questions enable row level security;
create policy interview_questions_public on public.interview_questions for select to anon, authenticated using (published or public.is_admin());
create policy interview_questions_admin on public.interview_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Each member's saved questions, practice confidence (1 = needs work, 3 = confident) and notes.
create table public.interview_practice (
  user_id           uuid not null references public.profiles (id) on delete cascade,
  question_id       uuid not null references public.interview_questions (id) on delete cascade,
  saved             boolean not null default false,
  confidence        smallint check (confidence between 1 and 3),
  note              text check (note is null or char_length(note) <= 1000),
  last_practiced_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.interview_practice enable row level security;
create policy interview_practice_own on public.interview_practice for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());
create policy mfa_gate on public.interview_practice as restrictive for all to authenticated using (public.aal_ok()) with check (public.aal_ok());

-- ------------------------------------------------------------------ skills development hub
create table public.lessons (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  category   text not null,
  title      text not null check (char_length(title) between 3 and 160),
  summary    text check (summary is null or char_length(summary) <= 300),
  level      text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  minutes    int not null default 10 check (minutes between 1 and 240),
  skills     text[] not null default '{}',
  body       text not null,
  exercise   text,
  quiz       jsonb not null default '[]'::jsonb,
  position   int not null default 100,
  published  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.lessons enable row level security;
create policy lessons_public on public.lessons for select to anon, authenticated using (published or public.is_admin());
create policy lessons_admin on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.lesson_progress (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  quiz_score   int check (quiz_score between 0 and 100),
  primary key (user_id, lesson_id)
);
alter table public.lesson_progress enable row level security;
create policy lesson_progress_own on public.lesson_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());
create policy mfa_gate on public.lesson_progress as restrictive for all to authenticated using (public.aal_ok()) with check (public.aal_ok());

-- ------------------------------------------------------------------ career path explorer
create table public.careers (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  field          text not null,
  title          text not null,
  summary        text not null,
  what_you_do    text,
  entry_roles    text[] not null default '{}',
  path           jsonb not null default '[]'::jsonb,       -- [{stage, roles, years}]
  qualifications text[] not null default '{}',
  subjects       text[] not null default '{}',
  institutions   text[] not null default '{}',
  bodies         text[] not null default '{}',
  skills         text[] not null default '{}',
  tools          text[] not null default '{}',
  how_to_start   text,
  pay            jsonb,                                    -- {entry:[min,max], mid:[min,max], senior:[min,max]} US$ per month, illustrative
  keywords       text[] not null default '{}',             -- used to find matching opportunities
  position       int not null default 100,
  published      boolean not null default true
);
alter table public.careers enable row level security;
create policy careers_public on public.careers for select to anon, authenticated using (published or public.is_admin());
create policy careers_admin on public.careers for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.saved_careers (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  career_id  uuid not null references public.careers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, career_id)
);
alter table public.saved_careers enable row level security;
create policy saved_careers_own on public.saved_careers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());
create policy mfa_gate on public.saved_careers as restrictive for all to authenticated using (public.aal_ok()) with check (public.aal_ok());

-- ------------------------------------------------------------------ "no experience needed"
alter table public.opportunities add column no_experience boolean not null default false;
create index opportunities_no_experience_idx on public.opportunities (no_experience) where status = 'published';
-- Attachments and internships are for people without experience; the demo listings are marked too.
update public.opportunities set no_experience = true where type::text in ('industrial_attachment', 'internship') or title like '[Demo]%';

-- ------------------------------------------------------------------ richer company profiles
alter table public.companies
  add column tagline      text check (tagline is null or char_length(tagline) <= 160),
  add column size_band    text check (size_band is null or size_band in ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  add column founded_year int check (founded_year is null or founded_year between 1800 and 2100),
  add column locations    text[] not null default '{}' check (cardinality(locations) <= 10),
  add column benefits     text[] not null default '{}' check (cardinality(benefits) <= 12),
  add column culture      text check (culture is null or char_length(culture) <= 1500),
  add column looking_for  text check (looking_for is null or char_length(looking_for) <= 1500),
  add column gallery_paths text[] not null default '{}' check (cardinality(gallery_paths) <= 8);

-- Gallery photos must live in the company's own folder.
create or replace function public.companies_gallery_guard()
returns trigger language plpgsql set search_path = public as $$
declare p text;
begin
  foreach p in array coalesce(new.gallery_paths, '{}') loop
    if split_part(p, '/', 1) <> new.id::text or p like '%..%' then raise exception 'Invalid gallery photo path'; end if;
  end loop;
  return new;
end $$;
create trigger companies_gallery_guard_trg before insert or update of gallery_paths on public.companies
  for each row execute function public.companies_gallery_guard();

create table public.company_follows (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);
create index company_follows_company_idx on public.company_follows (company_id);
alter table public.company_follows enable row level security;
create policy company_follows_own on public.company_follows for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());
create policy mfa_gate on public.company_follows as restrictive for all to authenticated using (public.aal_ok()) with check (public.aal_ok());

-- ------------------------------------------------------------------ company reviews (moderated)
create table public.company_reviews (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  author_id      uuid not null references public.profiles (id) on delete cascade,
  rating         smallint not null check (rating between 1 and 5),
  title          text not null check (char_length(title) between 3 and 100),
  pros           text check (pros is null or char_length(pros) <= 1000),
  cons           text check (cons is null or char_length(cons) <= 1000),
  advice         text check (advice is null or char_length(advice) <= 1000),
  relationship   text not null default 'attachee' check (relationship in ('attachee', 'graduate_trainee', 'intern', 'employee', 'applicant')),
  anonymous      boolean not null default true,
  status         text not null default 'published' check (status in ('published', 'removed')),
  employer_reply text check (employer_reply is null or char_length(employer_reply) <= 1000),
  reply_at       timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, author_id)
);
create index company_reviews_company_idx on public.company_reviews (company_id, status, created_at desc);
alter table public.company_reviews enable row level security;
-- Reviews are read through company_reviews_list() so anonymous authors stay anonymous; the table itself is private.
create policy company_reviews_own on public.company_reviews for select to authenticated using (author_id = auth.uid() or public.is_admin());
create policy company_reviews_delete_own on public.company_reviews for delete to authenticated using (author_id = auth.uid());
create policy mfa_gate on public.company_reviews as restrictive for all to authenticated using (public.aal_ok()) with check (public.aal_ok());

-- Only people who have really been through a company's process can review it: an offer, an accepted placement
-- or a completed interview.
create or replace function public.can_review_company(p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.my_role() = 'candidate' and public.is_active_user() and (
    exists (select 1 from public.applications a join public.opportunities o on o.id = a.opportunity_id
             where a.candidate_id = auth.uid() and o.company_id = p_company and a.status in ('offer_made', 'accepted'))
    or exists (select 1 from public.interviews i join public.applications a on a.id = i.application_id join public.opportunities o on o.id = a.opportunity_id
                where a.candidate_id = auth.uid() and o.company_id = p_company and i.status = 'completed'))
$$;
revoke all on function public.can_review_company(uuid) from public, anon;
grant execute on function public.can_review_company(uuid) to authenticated;

create or replace function public.write_company_review(
  p_company uuid, p_rating int, p_title text, p_pros text, p_cons text, p_advice text, p_relationship text default 'attachee', p_anonymous boolean default true
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not public.can_review_company(p_company) then raise exception 'You can review a company after an offer, an accepted placement or a completed interview with them'; end if;
  if not exists (select 1 from public.companies where id = p_company and not suspended) then raise exception 'Company not found'; end if;
  if (select count(*) from public.company_reviews where author_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then raise exception 'Please try again tomorrow'; end if;
  insert into public.company_reviews (company_id, author_id, rating, title, pros, cons, advice, relationship, anonymous)
  values (p_company, auth.uid(), p_rating, trim(p_title), nullif(trim(coalesce(p_pros, '')), ''), nullif(trim(coalesce(p_cons, '')), ''), nullif(trim(coalesce(p_advice, '')), ''), p_relationship, coalesce(p_anonymous, true))
  on conflict (company_id, author_id) do update
    set rating = excluded.rating, title = excluded.title, pros = excluded.pros, cons = excluded.cons, advice = excluded.advice,
        relationship = excluded.relationship, anonymous = excluded.anonymous, updated_at = now(), status = 'published'
  returning id into v_id;
  select name into v_name from public.companies where id = p_company;
  perform public.notify_company(p_company, 'system', 'New review of ' || coalesce(nullif(v_name, ''), 'your company'), left(trim(p_title), 120), '/companies/' || p_company, jsonb_build_object('review_id', v_id), 'review:' || v_id);
  return v_id;
end $$;
revoke all on function public.write_company_review(uuid, int, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.write_company_review(uuid, int, text, text, text, text, text, boolean) to authenticated;

create or replace function public.reply_to_review(p_review uuid, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.company_reviews r set employer_reply = nullif(left(trim(coalesce(p_reply, '')), 1000), ''), reply_at = case when nullif(trim(coalesce(p_reply, '')), '') is null then null else now() end
   where r.id = p_review and public.owns_company(r.company_id) and r.status = 'published';
  if not found then raise exception 'Review not found'; end if;
end $$;
revoke all on function public.reply_to_review(uuid, text) from public, anon;
grant execute on function public.reply_to_review(uuid, text) to authenticated;

create or replace function public.admin_set_review_status(p_review uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  perform public.require_admin();
  if p_status not in ('published', 'removed') then raise exception 'Invalid status'; end if;
  update public.company_reviews set status = p_status where id = p_review returning author_id into v_author;
  if not found then raise exception 'Review not found'; end if;
  perform public.audit('review.' || p_status, 'review', p_review, jsonb_build_object('reason', p_reason));
  if p_status = 'removed' then
    perform public.notify(v_author, 'system', 'Your review was removed', coalesce(nullif(trim(p_reason), ''), 'It did not follow the Mukana community guidelines.'), null, '{}'::jsonb, 'review-removed:' || p_review);
  end if;
end $$;
revoke all on function public.admin_set_review_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_review_status(uuid, text, text) to authenticated;

-- Reviews can be reported like posts and companies.
alter type public.report_target add value if not exists 'review';
alter table public.reports add column review_id uuid references public.company_reviews (id) on delete cascade;
alter table public.reports drop constraint report_has_one_target;
alter table public.reports add constraint report_has_one_target check (
  (target_type::text = 'opportunity' and opportunity_id is not null and company_id is null and post_id is null and user_id is null and review_id is null) or
  (target_type::text = 'company'     and company_id is not null and opportunity_id is null and post_id is null and user_id is null and review_id is null) or
  (target_type::text = 'post'        and post_id is not null and opportunity_id is null and company_id is null and user_id is null and review_id is null) or
  (target_type::text = 'user'        and user_id is not null and opportunity_id is null and company_id is null and post_id is null and review_id is null) or
  (target_type::text = 'review'      and review_id is not null and opportunity_id is null and company_id is null and post_id is null and user_id is null));
drop index public.reports_one_open_per_target;
create unique index reports_one_open_per_target on public.reports (reporter_id, coalesce(opportunity_id, company_id, post_id, user_id, review_id)) where status = 'open';

-- ------------------------------------------------------------------ company directory and page data (public)
create or replace function public.company_rating_summary(p_company uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'count', count(*),
    'avg', coalesce(round(avg(rating)::numeric, 1), 0),
    'distribution', jsonb_build_object('1', count(*) filter (where rating = 1), '2', count(*) filter (where rating = 2), '3', count(*) filter (where rating = 3),
                                       '4', count(*) filter (where rating = 4), '5', count(*) filter (where rating = 5)))
    from public.company_reviews where company_id = p_company and status = 'published'
$$;
grant execute on function public.company_rating_summary(uuid) to anon, authenticated;

create or replace function public.list_companies(
  p_q text default null, p_industry text default null, p_province text default null, p_hiring boolean default false,
  p_sort text default 'name', p_limit int default 24, p_offset int default 0
) returns table (
  id uuid, name text, logo_path text, industry text, location text, tagline text, size_band text,
  open_roles bigint, rating_avg numeric, rating_count bigint, followers bigint, total bigint
) language sql stable security definer set search_path = public as $$
  with base as (
    select c.id, c.name, c.logo_path, c.industry, c.location, c.tagline, c.size_band,
           (select count(*) from public.opportunities o where o.company_id = c.id and o.status = 'published' and not o.suspended and o.deadline >= public.harare_today()) as open_roles,
           (select coalesce(round(avg(r.rating)::numeric, 1), 0) from public.company_reviews r where r.company_id = c.id and r.status = 'published') as rating_avg,
           (select count(*) from public.company_reviews r where r.company_id = c.id and r.status = 'published') as rating_count,
           (select count(*) from public.company_follows f where f.company_id = c.id) as followers
      from public.companies c
     where c.verification_status = 'approved' and not c.suspended
       and (p_q is null or trim(p_q) = '' or c.name ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%' or c.industry ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%' or c.tagline ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%')
       and (p_industry is null or p_industry = '' or c.industry = p_industry)
       and (p_province is null or p_province = '' or c.location ilike '%' || replace(replace(p_province, '%', ''), '_', '') || '%')
  )
  select b.*, count(*) over () as total from base b
   where (not coalesce(p_hiring, false)) or b.open_roles > 0
   order by case when p_sort = 'hiring' then b.open_roles end desc nulls last,
            case when p_sort = 'rating' then b.rating_avg end desc nulls last,
            case when p_sort = 'followers' then b.followers end desc nulls last,
            b.name
   offset greatest(coalesce(p_offset, 0), 0) limit greatest(1, least(coalesce(p_limit, 24), 60))
$$;
grant execute on function public.list_companies(text, text, text, boolean, text, int, int) to anon, authenticated;

create or replace function public.company_page_data(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.companies;
begin
  select * into c from public.companies where id = p_id and not suspended;
  if c.id is null then return null; end if;
  return jsonb_build_object(
    'company', jsonb_build_object('id', c.id, 'owner_id', c.owner_id, 'name', c.name, 'logo_path', c.logo_path, 'industry', c.industry, 'location', c.location,
      'website', c.website, 'description', c.description, 'verification_status', c.verification_status, 'tagline', c.tagline, 'size_band', c.size_band,
      'founded_year', c.founded_year, 'locations', to_jsonb(c.locations), 'benefits', to_jsonb(c.benefits), 'culture', c.culture, 'looking_for', c.looking_for,
      'gallery_paths', to_jsonb(c.gallery_paths)),
    'rating', public.company_rating_summary(p_id),
    'followers', (select count(*) from public.company_follows f where f.company_id = p_id),
    'following', me is not null and exists (select 1 from public.company_follows f where f.company_id = p_id and f.user_id = me),
    'can_review', public.can_review_company(p_id),
    'my_review', (select to_jsonb(r) - 'author_id' from public.company_reviews r where r.company_id = p_id and r.author_id = me),
    'open_roles', (select count(*) from public.opportunities o where o.company_id = p_id and o.status = 'published' and not o.suspended and o.deadline >= public.harare_today()));
end $$;
grant execute on function public.company_page_data(uuid) to anon, authenticated;

create or replace function public.company_reviews_list(p_company uuid, p_limit int default 20, p_offset int default 0)
returns table (id uuid, rating smallint, title text, pros text, cons text, advice text, relationship text, author_name text, employer_reply text, reply_at timestamptz, created_at timestamptz, mine boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.rating, r.title, r.pros, r.cons, r.advice, r.relationship,
         case when r.anonymous then null else p.full_name end, r.employer_reply, r.reply_at, r.created_at, r.author_id = auth.uid()
    from public.company_reviews r join public.profiles p on p.id = r.author_id
   where r.company_id = p_company and r.status = 'published'
   order by r.created_at desc
   offset greatest(coalesce(p_offset, 0), 0) limit greatest(1, least(coalesce(p_limit, 20), 50))
$$;
grant execute on function public.company_reviews_list(uuid, int, int) to anon, authenticated;

-- ------------------------------------------------------------------ content
insert into public.content_categories (kind, slug, label, description, position) values
('interview', $q$getting_started$q$, $q$Getting started$q$, $q$The questions almost every interview begins with.$q$, 1),
('interview', $q$behavioural$q$, $q$Behavioural questions$q$, $q$Tell me about a time... Use the SAR method: Situation, Action, Result.$q$, 2),
('interview', $q$attachment$q$, $q$Industrial attachment$q$, $q$For students applying for attachment or internships.$q$, 3),
('interview', $q$graduate_trainee$q$, $q$Graduate trainee programmes$q$, $q$For graduates applying to structured trainee schemes.$q$, 4),
('interview', $q$technical_it$q$, $q$Technical: IT and data$q$, $q$Software, systems, networks and data roles.$q$, 5),
('interview', $q$technical_finance$q$, $q$Technical: accounting and finance$q$, $q$Accounting, audit, banking and finance roles.$q$, 6),
('interview', $q$technical_engineering$q$, $q$Technical: engineering and mining$q$, $q$Civil, electrical, mechanical, mining and related roles.$q$, 7),
('interview', $q$technical_business$q$, $q$Technical: business and operations$q$, $q$Marketing, HR, supply chain and general business roles.$q$, 8),
('interview', $q$situational$q$, $q$Situational questions$q$, $q$What would you do if... Think out loud and show your reasoning.$q$, 9),
('interview', $q$video_phone$q$, $q$Video and phone interviews$q$, $q$Online interviews with unreliable internet? Prepare for it.$q$, 10),
('interview', $q$your_questions$q$, $q$Questions to ask them$q$, $q$Good questions show you are serious.$q$, 11),
('interview', $q$salary_logistics$q$, $q$Pay, availability and logistics$q$, $q$Allowances, start dates and relocation.$q$, 12),
('lesson', $q$career_basics$q$, $q$Career basics$q$, $q$CVs, cover letters and finding opportunities.$q$, 1),
('lesson', $q$communication$q$, $q$Communication$q$, $q$Write, speak and listen like a professional.$q$, 2),
('lesson', $q$workplace$q$, $q$Workplace skills$q$, $q$Be the attachee or trainee people want to keep.$q$, 3),
('lesson', $q$digital$q$, $q$Digital skills$q$, $q$Excel, online safety and everyday tools.$q$, 4),
('lesson', $q$finance$q$, $q$Money and finance$q$, $q$Manage your first salary and understand business money.$q$, 5),
('lesson', $q$business$q$, $q$Business skills$q$, $q$Projects, customers and ideas.$q$, 6),
('lesson', $q$technical$q$, $q$Technical foundations$q$, $q$Data and programming first steps.$q$, 7),
('career', $q$technology$q$, $q$Technology$q$, null, 1),
('career', $q$finance$q$, $q$Finance and business$q$, null, 2),
('career', $q$engineering$q$, $q$Engineering and construction$q$, null, 3),
('career', $q$mining$q$, $q$Mining and geology$q$, null, 4),
('career', $q$agriculture$q$, $q$Agriculture and environment$q$, null, 5),
('career', $q$hospitality$q$, $q$Hospitality and services$q$, null, 6);

insert into public.interview_questions (category, question, answer, tip, audience, position) values
($q$getting_started$q$, $q$Tell me about yourself.$q$, $q$Give a 60 to 90 second summary in three parts: who you are now (your programme or qualification and institution), what you have done that is relevant (a project, volunteering, a short course), and what you want next and why this role fits. For example: "I am a third-year Computer Science student at the University of Zimbabwe. I built a small attendance app for my class and I enjoy turning messy problems into simple tools. I am looking for an attachment where I can work with a real development team, and your company's focus on mobile services is exactly the area I want to learn."$q$, $q$Do not read out your CV. Pick two or three things that match the advert and practise saying them naturally.$q$, $q$all$q$, 1),
($q$getting_started$q$, $q$Why do you want to work for us?$q$, $q$Show that you did your homework. Mention one specific thing about the company (a product, a programme, how they treat trainees, a recent project) and connect it to your goals. For example: "I have followed your agricultural research and I would like to learn how field trials are designed. Your programme is known for giving attachees real tasks, not just filing."$q$, $q$Spend 15 minutes on the company's website and Mukana company page before the interview. Generic answers are easy to spot.$q$, $q$all$q$, 2),
($q$getting_started$q$, $q$Why should we choose you over other candidates?$q$, $q$Do not compare yourself to others. Describe what you bring: relevant skills, reliability, willingness to learn and a concrete example. For example: "I can use Excel for budgets and I completed a payroll project at college. I am punctual, I take feedback well, and I will finish what I start."$q$, $q$Back every claim with a short example. Evidence beats adjectives.$q$, $q$all$q$, 3),
($q$getting_started$q$, $q$What are your strengths?$q$, $q$Choose two strengths that matter for the role and give proof. For example: "I am organised. In my final-year project I kept a weekly plan and we submitted two days early. I am also a quick learner: I taught myself SQL over a long weekend to finish our database coursework."$q$, $q$Pick strengths from the job advert's requirements.$q$, $q$all$q$, 4),
($q$getting_started$q$, $q$What is your biggest weakness?$q$, $q$Choose a real but manageable weakness, then show what you are doing about it. For example: "I used to hesitate to ask questions because I did not want to look unsure. I now write my questions down and ask them early, which saves time and gives better results." Do not say "I work too hard" or claim you have no weaknesses.$q$, $q$The goal is honesty plus improvement.$q$, $q$all$q$, 5),
($q$getting_started$q$, $q$Where do you see yourself in five years?$q$, $q$Be realistic and tie it to the field and to growth with the company. For example: "I want to be a confident junior engineer who can lead small tasks, and later work towards professional registration. I hope to keep learning here as the company grows." Avoid naming a specific job title that is above the interviewer.$q$, $q$Show ambition, not impatience.$q$, $q$all$q$, 6),
($q$getting_started$q$, $q$What do you know about our company?$q$, $q$Give two or three facts (what they do, where they operate, who their customers are) and one thing that interests you. Mention recent news if you know it. If you only learned a little, be honest and show curiosity: "I know you operate mainly in Harare and Bulawayo, and I would like to learn more about how the teams are organised."$q$, $q$Use the company's page on Mukana and their official site.$q$, $q$all$q$, 7),
($q$getting_started$q$, $q$What motivates you?$q$, $q$Choose something genuine and work-related, such as solving problems, learning new skills, helping customers or seeing a project completed. Give a quick example of a time that motivated you.$q$, $q$Avoid answering only with money.$q$, $q$all$q$, 8),
($q$behavioural$q$, $q$Tell me about a time you worked in a team.$q$, $q$Use SAR. Situation: "In our group project of five students we had to build a prototype in four weeks." Action: "I suggested we split tasks by strength and I set up a shared task list. When one member fell behind I offered to pair with them." Result: "We delivered on time and got a distinction. I learned that clear roles and regular check-ins prevent most problems."$q$, $q$Say "I" for what you did and "we" for what the team achieved.$q$, $q$all$q$, 9),
($q$behavioural$q$, $q$Describe a time you handled a conflict.$q$, $q$Choose a small, professional disagreement. Explain how you listened first, stayed respectful, focused on the goal and agreed a solution. For example: two team members wanted different approaches; you suggested testing both on a small scale and used the results to decide.$q$, $q$Never blame or criticise a person. Focus on the problem and what you learned.$q$, $q$all$q$, 10),
($q$behavioural$q$, $q$Tell me about a mistake you made and what you learned.$q$, $q$Pick a genuine, minor mistake. Own it, explain how you fixed it, and say what you now do differently. For example: "I once submitted a report with the wrong figures. I noticed within the hour, told my lecturer, corrected it, and now I always have a classmate double-check numbers."$q$, $q$Employers value honesty and learning more than perfection.$q$, $q$all$q$, 11),
($q$behavioural$q$, $q$Tell me about a time you worked under pressure or a tight deadline.$q$, $q$Describe how you planned, prioritised and stayed calm. For example: "I had three assignments due in the same week. I listed them by deadline and weight, blocked out study sessions, asked for a small extension on one and finished all three."$q$, $q$Show a method (lists, priorities), not just that you worked hard.$q$, $q$all$q$, 12),
($q$behavioural$q$, $q$Give an example of when you showed leadership.$q$, $q$Leadership does not need a title. Describe a time you organised a study group, led a club activity, or guided a new student. Explain what you did to help the group succeed.$q$, $q$Include how you got others involved.$q$, $q$all$q$, 13),
($q$behavioural$q$, $q$Tell me about a time you had to learn something quickly.$q$, $q$Describe the situation, how you broke the learning into steps, what resources or people you used, and the result. For example, learning a new software for a project in a week.$q$, $q$Great for attachment and trainee interviews: it shows you can ramp up.$q$, $q$all$q$, 14),
($q$behavioural$q$, $q$Describe a time you went above and beyond.$q$, $q$Pick an example where you did more than required for a good reason, such as helping a classmate understand a topic or improving a process. State the result.$q$, $q$Keep it modest. Let the result speak.$q$, $q$all$q$, 15),
($q$behavioural$q$, $q$How do you handle feedback or criticism?$q$, $q$Say you listen without defending, ask clarifying questions and act on it. Give a quick example: a lecturer pointed out weak structure in your report, you rewrote it using their advice and your next mark improved.$q$, $q$Smile, nod and take notes in the interview too. Show it.$q$, $q$all$q$, 16),
($q$attachment$q$, $q$Why do you want to do your attachment with us?$q$, $q$Link your programme to what the company does and say what you hope to learn. For example: "My course covers power systems in theory, and I want to see how a real distribution network is maintained. Your engineering team works on exactly that."$q$, $q$Name one specific thing you want to learn or see.$q$, $q$attachee$q$, 17),
($q$attachment$q$, $q$What do you hope to learn during this attachment?$q$, $q$Give two or three clear goals: practical skills, how a professional team works, and how theory is applied. For example: "I want to learn how to use AutoCAD on live projects, how site reports are written, and how safety is managed."$q$, $q$Goals should match what the employer can actually offer.$q$, $q$attachee$q$, 18),
($q$attachment$q$, $q$What can you contribute during the attachment?$q$, $q$Mention reliable attendance, willingness to help with any task, relevant skills and a learning attitude. For example: "I can help with data entry and Excel reports, I learn quickly, and I will ask when I do not understand."$q$, $q$Attachees who are helpful and teachable get invited back.$q$, $q$attachee$q$, 19),
($q$attachment$q$, $q$How will you handle being given tasks that seem basic or boring?$q$, $q$Say you understand every professional starts with basics, you will do them carefully, and you will use them to learn how the business runs. Add that you will ask for more responsibility when you finish.$q$, $q$This is a test of attitude. Show humility and initiative.$q$, $q$attachee$q$, 20),
($q$attachment$q$, $q$Do you understand what an attachment logbook and report require?$q$, $q$Yes: you record daily activities and what you learned, get your supervisor to sign weekly, and write a final report linking theory to practice. Say you will keep notes every day so nothing is forgotten.$q$, $q$Mention your institution's attachment coordinator and visit schedule.$q$, $q$attachee$q$, 21),
($q$attachment$q$, $q$When are you available and for how long?$q$, $q$State your exact dates from your placement letter, whether you can start on time, and whether you can work full days. Mention any exams or commitments honestly.$q$, $q$Have your attachment dates and placement letter ready on your Mukana profile.$q$, $q$attachee$q$, 22),
($q$graduate_trainee$q$, $q$Why do you want to join a graduate trainee programme rather than a regular job?$q$, $q$Because you want structured learning, mentorship and exposure to different parts of the business while you build a career foundation. For example: "I want rotations so I can understand how finance, operations and customer teams connect."$q$, $q$Show you value learning, not only a job.$q$, $q$graduate_trainee$q$, 23),
($q$graduate_trainee$q$, $q$Are you willing to rotate between departments or locations?$q$, $q$If yes, say so and explain the benefit. If you have limits (for example family reasons), be honest and say what you can do. Graduate programmes often include rotations, so flexibility counts.$q$, $q$Do not promise what you cannot deliver.$q$, $q$graduate_trainee$q$, 24),
($q$graduate_trainee$q$, $q$What did you do during your degree that prepared you for this role?$q$, $q$Mention your final-year project, relevant coursework, attachment experience and any leadership or volunteering. Link each to a skill the programme needs.$q$, $q$Your Mukana profile projects section is a good memory aid.$q$, $q$graduate_trainee$q$, 25),
($q$graduate_trainee$q$, $q$How do you plan to commit to the company after training?$q$, $q$Say you see the programme as the start of a long-term career, you intend to grow in the company, and you are open to discussing bonding or service agreements. Show you understand the investment the company is making.$q$, $q$Ask about retention and growth paths later in the interview.$q$, $q$graduate_trainee$q$, 26),
($q$graduate_trainee$q$, $q$Tell us about your degree result or project and what it taught you.$q$, $q$Give the topic, your role, the main finding, and one lesson that applies to work. If your result was average, focus on the project and on what you improved over the years.$q$, $q$Be proud but not defensive about grades.$q$, $q$graduate_trainee$q$, 27),
($q$technical_it$q$, $q$What is the difference between a primary key and a foreign key?$q$, $q$A primary key uniquely identifies each row in a table (for example a student ID). A foreign key is a column in another table that refers to that primary key, linking the two tables (for example the student ID in an enrolments table). Together they keep data consistent.$q$, $q$Use a simple example from your own coursework.$q$, $q$all$q$, 28),
($q$technical_it$q$, $q$Explain what an API is in simple terms.$q$, $q$An API is a way for one program to ask another program for data or actions in a defined format, like a waiter taking your order to the kitchen. For example, a weather app calls a weather API to get today's forecast.$q$, $q$Use an analogy and one real example.$q$, $q$all$q$, 29),
($q$technical_it$q$, $q$How do you troubleshoot a computer that cannot connect to the network?$q$, $q$Start simple: check the cable or Wi-Fi, check the IP configuration, try pinging the gateway and a public address, check DNS, then check the router or switch. Work from the physical layer upwards and note what you tried.$q$, $q$Describe your method, not only the answer.$q$, $q$all$q$, 30),
($q$technical_it$q$, $q$Tell me about a program or project you built.$q$, $q$Explain the problem it solved, the tools you used, what you personally built, one challenge you overcame and what you would improve. Offer to show it on your phone or laptop.$q$, $q$Keep a simple demo ready, even screenshots.$q$, $q$all$q$, 31),
($q$technical_it$q$, $q$What is the difference between Git and GitHub?$q$, $q$Git is the version-control tool that tracks changes in your code on your computer. GitHub is a website that hosts Git repositories online so teams can share and review code.$q$, $q$Mention that you use branches and commits for your projects.$q$, $q$all$q$, 32),
($q$technical_it$q$, $q$How would you keep your data and passwords safe online?$q$, $q$Use long unique passwords or a password manager, turn on two-step verification, update software, avoid public Wi-Fi for sensitive logins, and never share one-time codes. Report phishing messages.$q$, $q$Security awareness is valued in every IT role.$q$, $q$all$q$, 33),
($q$technical_finance$q$, $q$What is the difference between an asset, a liability and equity?$q$, $q$Assets are what a business owns (cash, stock, equipment). Liabilities are what it owes (loans, suppliers). Equity is the owners' share: assets minus liabilities. The accounting equation is Assets = Liabilities + Equity.$q$, $q$Be ready to draw the equation on paper.$q$, $q$all$q$, 34),
($q$technical_finance$q$, $q$What is a bank reconciliation and why do we do it?$q$, $q$It compares the company's cash book to the bank statement to find differences such as unpresented cheques, deposits in transit and bank charges, so the cash balance is accurate and errors or fraud are detected.$q$, $q$Mention you practised one in college.$q$, $q$all$q$, 35),
($q$technical_finance$q$, $q$How would you check that a set of figures in Excel is correct?$q$, $q$Cross-check totals with a second method, use simple formulas such as SUM and subtotals, look for outliers, compare with last period, check formulas for consistent ranges, and have someone else review.$q$, $q$Accuracy habits matter more than clever formulas.$q$, $q$all$q$, 36),
($q$technical_finance$q$, $q$What is the difference between profit and cash flow?$q$, $q$Profit is revenue minus expenses over a period, recorded when earned or incurred. Cash flow is actual money coming in and going out. A company can be profitable but short of cash if customers pay late.$q$, $q$Use a simple example: a sale on credit.$q$, $q$all$q$, 37),
($q$technical_finance$q$, $q$What do you know about IFRS or the role of an auditor?$q$, $q$IFRS are international standards that make financial statements comparable and reliable. Auditors independently examine the statements and records and give an opinion on whether they present a true and fair view.$q$, $q$If you are studying ACCA or similar, mention the papers you have passed.$q$, $q$all$q$, 38),
($q$technical_engineering$q$, $q$What safety precautions would you take before working on or near electrical equipment?$q$, $q$Follow the site's safety procedure: isolate and lock out the supply, test that it is dead, wear the correct PPE, never work alone on live equipment, and report hazards. Safety rules exist because mistakes can be fatal.$q$, $q$Safety answers must be confident and specific.$q$, $q$all$q$, 39),
($q$technical_engineering$q$, $q$Describe a design or engineering project you worked on.$q$, $q$State the problem, the constraints (cost, time, materials), your design decisions and calculations, how you tested it and the result. Mention what you would change.$q$, $q$Bring sketches, drawings or photos if allowed.$q$, $q$all$q$, 40),
($q$technical_engineering$q$, $q$How do you read and interpret an engineering drawing?$q$, $q$Start with the title block and scale, read the views and sections, dimensions and tolerances, notes and symbols, and the bill of materials. Ask when something is unclear instead of guessing.$q$, $q$Show you respect drawings as the shared language on site.$q$, $q$all$q$, 41),
($q$technical_engineering$q$, $q$What is the importance of safety in a mining environment?$q$, $q$Mining involves heavy equipment, underground or open-pit hazards and chemicals, so safety systems (risk assessments, PPE, ventilation, ground support, reporting) protect lives and keep production going. Every worker is responsible for safety.$q$, $q$Mention you completed a safety induction if you have.$q$, $q$all$q$, 42),
($q$technical_engineering$q$, $q$How would you estimate the quantities of materials for a small construction job?$q$, $q$Take measurements from the drawings, calculate volumes or areas for each item, add a wastage allowance, list items in a bill of quantities and check with a second person or method.$q$, $q$Walk through a simple example, such as a concrete slab.$q$, $q$all$q$, 43),
($q$technical_business$q$, $q$How would you promote a new product on a small budget?$q$, $q$Define the audience, choose low-cost channels (social media, WhatsApp groups, community partners, word of mouth), create simple useful content, offer a small trial or promotion, and measure which channel brings customers.$q$, $q$Show you think in terms of audience and results.$q$, $q$all$q$, 44),
($q$technical_business$q$, $q$What would you consider when recruiting someone for a role?$q$, $q$Clarify the role and skills needed, write a clear advert, shortlist against criteria, use structured interviews, check references and communicate respectfully with all candidates, while following labour law and fairness.$q$, $q$Mention fairness and clear criteria.$q$, $q$all$q$, 45),
($q$technical_business$q$, $q$What is procurement and why does it matter?$q$, $q$Procurement is how an organisation buys goods and services. Good procurement gets the right quality at the right price and time, manages supplier relationships and prevents fraud through transparent processes.$q$, $q$Mention comparing quotations and keeping records.$q$, $q$all$q$, 46),
($q$technical_business$q$, $q$How do you keep stock records accurate?$q$, $q$Record every movement (receipts and issues), count regularly, reconcile counts to records, investigate differences quickly and secure the store. Use simple systems such as stock cards or spreadsheets consistently.$q$, $q$Give an example of a stock count you did.$q$, $q$all$q$, 47),
($q$situational$q$, $q$What would you do if you were given a task and did not understand the instructions?$q$, $q$Ask a polite, specific question early, repeat the task back in your own words to confirm, and note the answer. If the supervisor is busy, check any notes or ask a colleague, then confirm.$q$, $q$Asking early is a strength, not a weakness.$q$, $q$all$q$, 48),
($q$situational$q$, $q$What would you do if a colleague was not doing their share of group work?$q$, $q$Talk to them privately and respectfully first to understand the problem and offer help. If it continues, involve the supervisor with facts, focusing on the team goal.$q$, $q$Show maturity: private conversation before escalation.$q$, $q$all$q$, 49),
($q$situational$q$, $q$What would you do if you noticed a colleague breaking a safety or company rule?$q$, $q$Safety first. If there is danger, stop the activity and alert a supervisor immediately. Otherwise, raise it politely with the person and, if needed, report through the proper channel.$q$, $q$Show you take safety and integrity seriously.$q$, $q$all$q$, 50),
($q$situational$q$, $q$What would you do if you had two urgent tasks from two different people?$q$, $q$Tell both people about the clash, ask which is higher priority or what the real deadlines are, agree a plan, and communicate progress. Do not stay silent and hope to finish both.$q$, $q$Prioritising and communicating are the key points.$q$, $q$all$q$, 51),
($q$situational$q$, $q$What would you do if you realised you had made an error that nobody had noticed yet?$q$, $q$Tell your supervisor as soon as possible, explain what happened and how to fix it, and fix it. Hiding mistakes causes bigger problems later.$q$, $q$Integrity is what they are testing.$q$, $q$all$q$, 52),
($q$video_phone$q$, $q$How do you prepare for a video interview when your internet is unreliable?$q$, $q$Test your connection beforehand, charge your device and keep a power bank, use a quiet place with good signal, have a backup plan (mobile data or phone call number) and message the interviewer immediately if you are disconnected. Join five minutes early.$q$, $q$Share your backup phone number at the start of the call.$q$, $q$all$q$, 53),
($q$video_phone$q$, $q$What should you wear and where should you sit for a video interview?$q$, $q$Dress as you would for an in-person interview (at least from the waist up). Sit facing a window or lamp so your face is lit, with a plain background and the camera at eye level. Silence notifications.$q$, $q$Look at the camera when you speak, not only at the screen.$q$, $q$all$q$, 54),
($q$video_phone$q$, $q$How do you make a good impression on a phone interview?$q$, $q$Take the call in a quiet place, have your CV and notes in front of you, smile as you talk (it changes your tone), speak clearly and slowly, and thank the interviewer at the end.$q$, $q$Keep a glass of water nearby.$q$, $q$all$q$, 55),
($q$your_questions$q$, $q$Do you have any questions for us?$q$, $q$Always ask two or three. Good ones: "What would a successful first month look like?", "Who will I be working with and who will supervise me?", "What training or mentoring do you provide?", "What are the next steps and when can I expect to hear from you?"$q$, $q$Write your questions down and bring them. It shows preparation.$q$, $q$all$q$, 56),
($q$your_questions$q$, $q$What should you avoid asking in an interview?$q$, $q$Avoid asking only about pay, leave or time off at the start, and avoid asking things you could have found on the company website. Save logistics for after an offer or when the interviewer raises them.$q$, $q$Ask about learning and growth first.$q$, $q$all$q$, 57),
($q$your_questions$q$, $q$How should you end an interview?$q$, $q$Thank them by name, repeat your interest in the role, confirm next steps, and ask when you can expect a decision. Send a short thank-you message the same day.$q$, $q$A thank-you message is remembered.$q$, $q$all$q$, 58),
($q$salary_logistics$q$, $q$What are your salary or stipend expectations?$q$, $q$Research typical ranges for the role. Say you are flexible and more interested in learning, then give a reasonable range if pressed. For attachment, ask what allowance or support is offered (transport, lunch, accommodation).$q$, $q$Never lie about your previous pay. Be polite and informed.$q$, $q$all$q$, 59),
($q$salary_logistics$q$, $q$Are you willing to relocate or work away from home?$q$, $q$Answer honestly. If yes, say which areas. If you have limits, state them and ask about transport, accommodation or remote options. Mention your plan for managing costs.$q$, $q$Check the location on the advert before the interview.$q$, $q$all$q$, 60),
($q$salary_logistics$q$, $q$When can you start?$q$, $q$Give a clear date and any constraints, such as exams or a notice period. Attachees should match the dates in their placement letter; graduates should mention their availability date.$q$, $q$Keep your availability date updated on Mukana.$q$, $q$all$q$, 61);

insert into public.lessons (slug, category, title, summary, level, minutes, skills, body, exercise, quiz, position) values
($q$write-a-cover-letter$q$, $q$career_basics$q$, $q$Write a cover letter that gets read$q$, $q$Four short paragraphs that make a recruiter want to open your CV.$q$, $q$beginner$q$, 8, array[$q$Writing$q$, $q$Applications$q$]::text[], $q$A cover letter (or the note you write when applying on Mukana) is your chance to explain why you fit **this** opportunity. Recruiters often read the first three lines and decide whether to continue.

## The four-paragraph structure
1. **Opening:** say what you are applying for and one sentence on who you are, for example "I am a third-year Civil Engineering student at NUST applying for your site engineering attachment."
2. **Fit:** pick two requirements from the advert and show evidence you meet them.
3. **Motivation:** one specific reason you want to work with this company.
4. **Close:** thank them, say your CV is attached, and that you are available to start on your dates.

## What to avoid
- Copying the same letter for every company
- Long paragraphs and big words
- Apologising ("I know I have no experience, but...")

Tip: Use the exact words from the advert for the skills you have. Many companies scan for them.

## Example middle paragraph
"The advert asks for Excel and report writing. In my final-year project I built a budget model in Excel with charts, and I wrote a 40-page report that earned a distinction."$q$, $q$Open an advert you like on Mukana. Write the four paragraphs in under 180 words. Read it aloud and cut anything that is not specific to that company.$q$, '[{"q":"How long should a cover letter or application note usually be?","options":["A full page of storytelling","Short: about four brief paragraphs","Just one word","Three pages"],"correct":1,"why":"Recruiters read many applications. Short, specific notes get read."},{"q":"What should the second paragraph do?","options":["Repeat your whole CV","Show evidence for two requirements in the advert","Ask about salary","Describe your hobbies"],"correct":1,"why":"Match your evidence to what they asked for."},{"q":"Which is better to open with?","options":["To whom it may concern, I need a job.","I am applying for the X attachment and I am a Y student at Z.","Please give me a chance.","Dear Sir, hello."],"correct":1,"why":"Say what you apply for and who you are right away."}]'::jsonb, 1),
($q$find-opportunities-and-follow-up$q$, $q$career_basics$q$, $q$Find opportunities and follow up$q$, $q$A weekly routine for finding attachments, trainee programmes and jobs, and following up politely.$q$, $q$beginner$q$, 8, array[$q$Job search$q$, $q$Networking$q$]::text[], $q$Most students apply to a few places and wait. People who get placed treat the search like a weekly routine.

## A simple weekly routine
- **Monday:** check new opportunities on Mukana and save the ones that fit.
- **Tuesday to Thursday:** apply to two or three opportunities with a tailored note.
- **Friday:** follow up on applications from last week and update your CV or profile.

## Use more than one source
- Mukana opportunities and job alerts for your field
- Your institution's attachment office and lecturers
- Career fairs and events
- People you know: ask classmates, seniors and mentors

## Following up
If you applied a week ago and heard nothing, send a short message: thank them, restate your interest and ask whether they need anything else. One polite follow-up is professional. More than two is pestering.

Tip: Set a job alert on Mukana so new matching opportunities are sent to you.$q$, $q$Create a job alert for your field. Then write down five people (lecturers, seniors, relatives) you will ask about opportunities this month.$q$, '[{"q":"How many follow-up messages are reasonable after applying?","options":["None ever","One or two, politely","Daily until they reply","Five a week"],"correct":1,"why":"A polite follow-up shows interest. Too many looks like pressure."},{"q":"Why use several sources?","options":["It is more tiring","Opportunities come from different places, including people you know","Employers prefer it","You do not need to"],"correct":1,"why":"Many placements come through people and events, not only adverts."},{"q":"What does a job alert do?","options":["Deletes old jobs","Notifies you when matching opportunities are published","Writes your CV","Sends your CV automatically"],"correct":1,"why":"You hear about matches as soon as they open."}]'::jsonb, 2),
($q$attachment-logbook-and-report$q$, $q$workplace$q$, $q$Keep a strong attachment logbook and report$q$, $q$Daily habits that make your logbook easy and your report excellent.$q$, $q$beginner$q$, 9, array[$q$Report writing$q$, $q$Documentation$q$]::text[], $q$Your attachment logbook and final report are assessed by your institution and also show employers how you think.

## Daily logbook habit
Spend five minutes at the end of every day writing:
- What tasks you did (be specific: "calibrated pressure gauge" not "helped in workshop")
- What you learned or found difficult
- Tools, equipment or software you used
- Any safety observations

Get your supervisor to sign and comment every week. Do not wait until the last weekend to fill in a month.

## Final report structure
1. Introduction and the company profile
2. Your departments and duties
3. Skills learned and how they link to your course
4. Challenges and how you handled them
5. Conclusion and recommendations
6. Appendices (photos, forms and charts, with permission)

Tip: Take permission before photographing anything and never include confidential data.

## Make it count
Write down numbers: how many machines you serviced, how many reports you prepared. Concrete results show the value of your attachment and become CV points later.$q$, $q$Start today: write three sentences about what you did yesterday at college or work using the logbook format. Repeat for a week.$q$, '[{"q":"When is the best time to write the logbook?","options":["At the end of each day","Once a month","After the attachment","Never"],"correct":0,"why":"Short daily notes are more accurate and easier."},{"q":"What should a final report link?","options":["Only the company history","Your tasks to what you studied","Only photos","Only pay"],"correct":1,"why":"The report shows how theory meets practice."},{"q":"What must you do before taking photographs at work?","options":["Nothing","Get permission and avoid confidential data","Post them online","Delete the logbook"],"correct":1,"why":"Respect company confidentiality."}]'::jsonb, 3),
($q$first-week-at-work$q$, $q$workplace$q$, $q$Your first week at a new workplace$q$, $q$How to make a good first impression and learn fast.$q$, $q$beginner$q$, 7, array[$q$Professionalism$q$, $q$Teamwork$q$]::text[], $q$The first week sets the tone. You do not need to know everything, but you do need to show you are reliable and eager.

## Before day one
- Confirm the address, start time and who to ask for
- Plan transport and arrive 15 minutes early
- Dress smartly and modestly unless told otherwise
- Carry a notebook, pen, your ID and documents

## During the week
- **Introduce yourself** to people in your section and learn their names
- **Take notes** on instructions so you do not ask twice
- **Ask questions** early, after you have tried to find the answer
- **Observe** how people communicate and handle problems

## Do and don't
- Do keep your phone on silent and use it only for work or breaks
- Do thank people who help you
- Don't gossip or complain about the workplace
- Don't leave without telling your supervisor

Tip: At the end of the week ask your supervisor: "What is one thing I can do better next week?"$q$, $q$Write a short script for introducing yourself to a new team in 20 seconds: your name, your programme or role, and one thing you want to learn.$q$, '[{"q":"How early should you arrive on the first day?","options":["Exactly on time","About 15 minutes early","An hour late","Whenever"],"correct":1,"why":"Arriving early shows reliability."},{"q":"What is a good habit when given instructions?","options":["Trust your memory","Write them down","Ignore them","Ask the same question daily"],"correct":1,"why":"Notes save everyone time."},{"q":"Which question helps you improve?","options":["Why is the pay low?","What is one thing I can do better next week?","Can I go home early?","Who is the worst colleague?"],"correct":1,"why":"Asking for feedback shows maturity."}]'::jsonb, 4),
($q$professional-email$q$, $q$communication$q$, $q$Write professional emails and messages$q$, $q$Clear subject lines, short messages and polite closings.$q$, $q$beginner$q$, 7, array[$q$Written communication$q$, $q$Email$q$]::text[], $q$Email and chat messages are how professionals judge you before they meet you.

## The anatomy of a good email
- **Subject:** specific, for example "Application: Industrial attachment, Jane Moyo"
- **Greeting:** "Dear Mr Dube," or "Good morning Ms Ncube,"
- **Purpose in the first line:** why you are writing
- **Details:** short paragraphs or bullet points
- **Closing:** "Kind regards," followed by your full name and phone number

## Quick rules
- Use a professional email address (name.surname, not nicknames)
- Keep it short and check spelling
- Attach files with clear names, for example "Jane-Moyo-CV.pdf"
- Reply within a day when you can

## WhatsApp at work
If a supervisor uses WhatsApp, keep messages short, polite and about work. Avoid voice notes unless they ask for them, and do not send jokes or forwards.

Tip: Read your message aloud before sending. If it sounds rude or confusing, rewrite it.$q$, $q$Write an email to a recruiter asking about the status of your application, in under 80 words.$q$, '[{"q":"What makes a good subject line?","options":["Hi","URGENT!!!","Specific: what it is and who it is from","No subject"],"correct":2,"why":"A clear subject helps the reader file and find it."},{"q":"Which email address looks most professional?","options":["sweetgirl99@mail.com","jane.moyo@mail.com","jamo_lol@mail.com","ladyj@mail.com"],"correct":1,"why":"Your name is the safest choice."},{"q":"How should you name an attached CV file?","options":["cv final final.pdf","Jane-Moyo-CV.pdf","document1.pdf","IMG_2034.pdf"],"correct":1,"why":"Clear file names show care."}]'::jsonb, 5),
($q$present-with-confidence$q$, $q$communication$q$, $q$Present with confidence$q$, $q$Structure, practice and body language for presentations and interviews.$q$, $q$beginner$q$, 8, array[$q$Presentation$q$, $q$Public speaking$q$]::text[], $q$Presenting well helps in class, at work and in interviews.

## Plan in three parts
1. **Open:** one sentence that tells people why they should listen
2. **Middle:** no more than three key points, each with an example
3. **Close:** repeat the main message and say what happens next

## Slides
- One idea per slide and big text
- Use pictures and charts instead of paragraphs
- Do not read the slide word for word

## Delivery
- Stand tall, breathe, and pause between points
- Make eye contact with different people
- Speak slower than you think you need to
- It is normal to be nervous. Practise out loud at least three times.

Tip: If you lose your place, pause, take a breath and say "Let me return to my main point."

## If the power goes off
Have a plan B: a printed copy of your notes and the ability to explain without slides.$q$, $q$Choose a topic you know well and give a two-minute talk to a friend or your phone camera. Watch it and note one thing to improve.$q$, '[{"q":"How many key points are best in a short talk?","options":["Ten","Up to three","None","As many as possible"],"correct":1,"why":"People remember a few clear points."},{"q":"What is a good plan for a power cut during a presentation?","options":["Cancel","Have printed notes and be ready to speak without slides","Wait for hours","Read from the phone only"],"correct":1,"why":"Preparing for problems shows professionalism."},{"q":"What should you do with your slides?","options":["Read them word for word","Use them as support, with few words","Fill them with text","Skip them"],"correct":1,"why":"Slides support you; they are not the talk."}]'::jsonb, 6),
($q$teamwork-and-listening$q$, $q$communication$q$, $q$Teamwork and active listening$q$, $q$How to work well with people, even when you disagree.$q$, $q$beginner$q$, 7, array[$q$Teamwork$q$, $q$Listening$q$]::text[], $q$Most work is done in teams. Employers rate teamwork and listening as top skills for graduates.

## Active listening
- Give your full attention and put your phone away
- Let the other person finish before you speak
- Repeat back what you heard: "So you need the report by Friday?"
- Ask questions to understand, not to argue

## Working with others
- Agree who does what and by when
- Share information early, including problems
- Give credit to others and say thank you
- Accept feedback without defending yourself

## When you disagree
1. Listen to the other view first
2. Focus on the goal you share
3. Suggest options and agree a test or a decision rule
4. Move on once decided

Tip: In meetings, summarise decisions and actions in a short message afterwards so nothing is forgotten.$q$, $q$In your next conversation, practise repeating back one sentence before replying. Notice how the other person responds.$q$, '[{"q":"What is a good sign of active listening?","options":["Interrupting often","Repeating back what you heard","Looking at your phone","Changing the subject"],"correct":1,"why":"Repeating shows you understood."},{"q":"What should you do first in a disagreement?","options":["Win the argument","Listen to the other view","Walk away","Complain to others"],"correct":1,"why":"Understand before you respond."},{"q":"Why send a summary after a meeting?","options":["To fill the inbox","So decisions and actions are clear","To impress the boss","No reason"],"correct":1,"why":"Written summaries prevent confusion."}]'::jsonb, 7),
($q$manage-your-time$q$, $q$workplace$q$, $q$Manage your time and priorities$q$, $q$A simple system to get important things done on time.$q$, $q$beginner$q$, 8, array[$q$Time management$q$, $q$Planning$q$]::text[], $q$Good time management is not about being busy. It is about doing the right things at the right time.

## The weekly plan
1. On Sunday or Monday morning list everything you must do
2. Mark each task **Urgent** (deadline soon) and **Important** (matters for your goals)
3. Do Urgent and Important first, schedule Important but not urgent, delegate or drop the rest
4. Put tasks into time blocks in your calendar or notebook

## Daily habits
- Start with the hardest task while your energy is high
- Work in 25-minute blocks with 5-minute breaks
- Keep your phone on silent during focus blocks
- End the day by writing tomorrow's top three tasks

## When you are overloaded
Tell the people who depend on you early and ask which task matters most. Do not wait until the deadline.

Tip: A task that takes under two minutes should be done immediately instead of added to the list.$q$, $q$Write your top three tasks for tomorrow tonight. Do the first one before checking your phone.$q$, '[{"q":"What should you do first?","options":["Urgent and important tasks","Easy tasks only","Tasks others like","Nothing"],"correct":0,"why":"These carry the highest cost if delayed."},{"q":"What should you do if you cannot finish everything?","options":["Say nothing","Tell people early and ask for priorities","Work through the night every day","Quit"],"correct":1,"why":"Early communication prevents bigger problems."},{"q":"What is a good focus technique?","options":["Check social media every minute","Work in 25-minute blocks with short breaks","Multitask on five things","Study with the TV on"],"correct":1,"why":"Short focused blocks improve concentration."}]'::jsonb, 8),
($q$excel-formulas-essentials$q$, $q$digital$q$, $q$Excel essentials: formulas that matter$q$, $q$SUM, AVERAGE, IF, VLOOKUP and cell references explained with examples.$q$, $q$beginner$q$, 10, array[$q$Excel$q$, $q$Data Analysis$q$]::text[], $q$Excel is used in almost every office. Learn these basics and you will stand out.

## Formulas start with =
- **=SUM(B2:B10)** adds a range
- **=AVERAGE(B2:B10)** gives the mean
- **=MAX(B2:B10)** and **=MIN(B2:B10)** find the highest and lowest
- **=COUNT(B2:B10)** counts numbers

## Making decisions with IF
**=IF(C2>=50,"Pass","Fail")** shows Pass when the score is 50 or more. You can combine conditions with AND and OR.

## Looking up values
**=VLOOKUP(A2, Table, 2, FALSE)** finds A2 in the first column of a table and returns the value from column 2. Use FALSE for exact matches. Newer Excel also has XLOOKUP.

## Cell references
- **B2** changes when you copy the formula (relative)
- **$B$2** stays fixed (absolute), useful for a tax rate cell
- **B$2** or **$B2** fix only the row or column

## Good habits
- Keep one table per sheet with headings in the first row
- Do not merge cells in data tables
- Check totals with a second method

Tip: Press F4 after clicking a cell reference to cycle through relative and absolute.$q$, $q$Build a simple monthly budget: list income and expenses, use SUM for totals and an IF to show 'Over budget' when expenses exceed income.$q$, '[{"q":"What does =SUM(B2:B10) do?","options":["Counts text","Adds the numbers in B2 to B10","Finds the biggest","Sorts the data"],"correct":1,"why":"SUM adds a range."},{"q":"What does $B$2 mean?","options":["The cell moves when copied","The reference stays fixed","A dollar amount","A comment"],"correct":1,"why":"Dollar signs lock the reference."},{"q":"Which function checks a condition and returns different results?","options":["SUM","IF","COUNT","MAX"],"correct":1,"why":"IF tests a condition."}]'::jsonb, 9),
($q$excel-tidy-data-and-pivot-tables$q$, $q$digital$q$, $q$Excel: tidy data and pivot tables$q$, $q$Prepare a clean table and summarise it in seconds with a PivotTable.$q$, $q$intermediate$q$, 10, array[$q$Excel$q$, $q$Data Analysis$q$, $q$Reporting$q$]::text[], $q$A PivotTable summarises thousands of rows into a short report in a few clicks, but only if your data is tidy.

## Tidy data checklist
- One row per record (for example one sale)
- One column per field (date, product, branch, amount)
- Headings in the first row, no blank rows or columns
- Consistent spelling ("Harare" not "harare" or "Hre")
- Dates as real dates and numbers as numbers, not text

## Create a PivotTable
1. Click any cell in your data
2. Insert, then PivotTable, then OK
3. Drag **Branch** to Rows, **Product** to Columns, **Amount** to Values
4. Right-click a value to change Sum to Count or Average
5. Use Slicers to filter by month or region

## Charts
Select the PivotTable and use PivotChart to turn the summary into a column or pie chart.

Tip: Refresh the PivotTable after changing the source data (right-click, Refresh).

## Common mistakes
- Totals that look wrong because numbers are stored as text
- New rows added below the data and not included in the range. Turn your data into a Table (Ctrl+T) so it grows automatically.$q$, $q$Take any list of sales or marks, convert it to a Table with Ctrl+T and build a PivotTable that shows totals by category.$q$, '[{"q":"What should the first row of your data contain?","options":["Blank cells","Headings","Totals","Notes"],"correct":1,"why":"Headings are needed for PivotTables."},{"q":"Why turn data into a Table (Ctrl+T)?","options":["It looks nicer only","It grows automatically when you add rows","It deletes data","It hides data"],"correct":1,"why":"Tables expand with new rows."},{"q":"What does Refresh do on a PivotTable?","options":["Updates it with changed source data","Deletes it","Prints it","Closes Excel"],"correct":0,"why":"Pivot tables do not update on their own."}]'::jsonb, 10),
($q$stay-safe-online$q$, $q$digital$q$, $q$Stay safe online while job hunting$q$, $q$Spot fake job adverts, protect your accounts and your documents.$q$, $q$beginner$q$, 7, array[$q$Digital safety$q$, $q$Cyber awareness$q$]::text[], $q$Scammers target job seekers with fake adverts. Protect yourself.

## Red flags
- You are asked to pay a "registration", "interview" or "uniform" fee
- The advert promises high pay for little work
- The sender uses a free email address while claiming to be a big company
- You are rushed or asked to keep it secret

Genuine employers do not charge to hire you.

## Protect your accounts
- Use a long, unique password for each important account
- Turn on two-step verification in your Mukana settings
- Never share one-time codes sent to your phone
- Log out on shared computers

## Protect your documents
- Share your ID, bank and home address only after you are sure the employer is real
- Send CVs as PDF files
- Do not put your national ID number on a CV

Tip: If you are unsure, check the company profile and verified badge on Mukana, or ask a lecturer or mentor.$q$, $q$Turn on two-step verification on your email and on Mukana. Then write down three red flags you will watch for.$q$, '[{"q":"A job asks for a fee to attend an interview. What do you do?","options":["Pay quickly","Treat it as a likely scam and report it","Ask friends to pay","Send your ID"],"correct":1,"why":"Real employers do not charge."},{"q":"What is two-step verification?","options":["Two passwords the same","A second proof of identity such as a code from an app","Two emails","A bank account"],"correct":1,"why":"It blocks people who only have your password."},{"q":"Should you put your national ID number on your CV?","options":["Yes, always","No","Only on social media","Yes, in the headline"],"correct":1,"why":"Keep sensitive identifiers private."}]'::jsonb, 11),
($q$think-with-data$q$, $q$technical$q$, $q$Think with data$q$, $q$Ask a question, find the data, clean it and explain the answer.$q$, $q$beginner$q$, 9, array[$q$Data Analysis$q$, $q$Statistics$q$]::text[], $q$Data skills are valuable in finance, agriculture, health, marketing and engineering.

## A simple process
1. **Ask:** what decision are we trying to make? ("Which product sells best in Bulawayo?")
2. **Collect:** gather the data from sales records, surveys or sensors
3. **Clean:** remove duplicates, fix spelling and handle missing values
4. **Analyse:** use totals, averages, percentages and charts
5. **Explain:** tell the story in plain words and recommend an action

## Basic measures
- **Mean** (average), **median** (middle) and **mode** (most common)
- **Range** shows how spread out values are
- Percentages and growth rates compare things of different sizes

## Charts that work
- Column charts for comparisons
- Line charts for change over time
- Pie charts only for a few shares of a whole

Tip: One chart, one message. Add a title that states the finding, such as "Sales rose 12% after the promotion".

## Be careful
Correlation does not prove cause. Always check the source and sample size of the data.$q$, $q$Find a small dataset (for example your last ten test marks). Calculate the mean and median, draw a line chart, and write two sentences about what you notice.$q$, '[{"q":"What is the first step in a data task?","options":["Draw a chart","Ask the question you want to answer","Buy software","Delete data"],"correct":1,"why":"A clear question guides everything else."},{"q":"Which chart shows change over time best?","options":["Pie chart","Line chart","Table of text","Map"],"correct":1,"why":"Line charts show trends."},{"q":"Why clean data?","options":["To make it look pretty","Errors and duplicates give wrong answers","It is required by law","To shrink the file"],"correct":1,"why":"Dirty data leads to wrong conclusions."}]'::jsonb, 12),
($q$python-first-steps$q$, $q$technical$q$, $q$Python: your first steps$q$, $q$Variables, decisions, loops and functions in plain language.$q$, $q$beginner$q$, 12, array[$q$Python$q$, $q$Programming$q$, $q$Problem Solving$q$]::text[], $q$Python is popular for data, automation and software development. This lesson explains the ideas. Try the examples in a free online editor or on your computer.

## Variables store values
A variable is a named box. For example, name = "Tendai" and marks = 72 store text and a number. Use print(name) to show it.

## Decisions with if
An if statement runs code only when a condition is true. For example: if marks >= 50, print "Pass", otherwise print "Fail". Indentation (the spaces at the start of a line) tells Python which lines belong to the if.

## Loops repeat work
A for loop repeats code for each item in a list. For example, for mark in [60, 45, 82]: check each mark and print the result. Loops save you from writing the same line many times.

## Functions package ideas
A function is a reusable block with a name. def average(numbers) can calculate the average of any list, and you can call it many times.

## Lists and dictionaries
- A **list** holds items in order: ["Harare", "Bulawayo", "Mutare"]
- A **dictionary** stores pairs: {"Harare": 2000, "Bulawayo": 1500}

Tip: Read error messages from the bottom up: the last line says what went wrong and the line above shows where.

## How to practise
Solve one small problem a day: a mark calculator, a unit converter, a simple budget. Keep your code on GitHub to show employers.$q$, $q$Write a program that asks for three marks, calculates the average and prints Pass if it is 50 or more. Then change it to use a function.$q$, '[{"q":"What does a variable do?","options":["Deletes data","Stores a value under a name","Draws a chart","Opens a file"],"correct":1,"why":"Variables hold values."},{"q":"Which keyword runs code only when a condition is true?","options":["for","if","def","print"],"correct":1,"why":"if tests a condition."},{"q":"What is a function?","options":["A reusable named block of code","A comment","A file type","An error"],"correct":0,"why":"Functions make code reusable."}]'::jsonb, 13),
($q$first-salary-budget$q$, $q$finance$q$, $q$Budget your first salary or allowance$q$, $q$Needs, wants and saving: a simple plan that works on a small income.$q$, $q$beginner$q$, 8, array[$q$Budgeting$q$, $q$Personal finance$q$]::text[], $q$Whether you earn an attachment allowance or a first salary, a plan helps your money last.

## Step by step
1. **List your income** for the month (allowance, salary, support)
2. **List fixed costs:** rent, transport, data, groceries
3. **List variable costs:** clothes, outings, airtime
4. **Pay yourself first:** put a small amount aside for savings or emergencies, even 5 to 10 percent
5. **Track** what you spend for a month and adjust

## Tools
A notebook, a mobile money statement or a simple Excel sheet is enough. Check where small purchases add up.

## Good habits
- Build an emergency fund of one month's costs first
- Avoid borrowing for things you want but do not need
- Compare prices before buying data or transport passes
- Be careful with offers that promise fast returns: they are often scams

Tip: A budget is not a punishment. It is permission to spend on the things you value, without guilt.$q$, $q$Make a one-month budget for a typical allowance. Decide your savings amount first, then see what is left for everything else.$q$, '[{"q":"What does ''pay yourself first'' mean?","options":["Spend on treats first","Set aside savings before spending","Pay others last","Borrow money"],"correct":1,"why":"Savings come off the top."},{"q":"What is an emergency fund for?","options":["Shopping","Unexpected costs like illness or repairs","Gifts only","Investments only"],"correct":1,"why":"It protects you from shocks."},{"q":"What should you be careful about?","options":["Offers promising fast, high returns","Writing a budget","Saving","Tracking spending"],"correct":0,"why":"Fast-return schemes are often scams."}]'::jsonb, 14),
($q$bookkeeping-basics$q$, $q$finance$q$, $q$Bookkeeping basics for small businesses$q$, $q$Record sales and expenses properly and read a simple profit statement.$q$, $q$beginner$q$, 10, array[$q$Bookkeeping$q$, $q$Accounting$q$]::text[], $q$Every business, from a tuckshop to a factory, needs records.

## What to record
- **Sales:** date, customer, items, amount and how paid
- **Purchases and expenses:** date, supplier, item and amount, with receipts
- **Cash and bank:** every payment in and out

## The cash book
A cash book lists money received and paid in date order. At the end of the month, compare it with your bank or mobile money statement to find errors.

## A simple profit statement
- Sales **minus** cost of goods sold = **gross profit**
- Gross profit **minus** other expenses (rent, transport, wages, data) = **net profit**

## Keep proof
File receipts, invoices and statements by month. Number your invoices. Keep personal and business money separate.

Tip: Update your records weekly. Waiting until the end of the year makes mistakes more likely.

## Next steps
Learn a tool such as Excel, Sage or QuickBooks, and consider an accounting qualification (for example ACCA or a college certificate) if you want to build a career in this area.$q$, $q$Record one week of sales and expenses for an imaginary tuckshop in a table. Calculate gross profit and net profit.$q$, '[{"q":"What is net profit?","options":["Sales only","Gross profit minus other expenses","Cash in the bank","Loans"],"correct":1,"why":"Net profit is what remains after all expenses."},{"q":"Why keep personal and business money separate?","options":["No reason","It keeps records clear and accurate","Tax forbids it","Banks demand it"],"correct":1,"why":"Mixing them hides the real performance."},{"q":"How often should you update records?","options":["Weekly","Every five years","Never","Only when audited"],"correct":0,"why":"Regular updates reduce errors."}]'::jsonb, 15),
($q$project-management-basics$q$, $q$business$q$, $q$Project management basics$q$, $q$Scope, schedule, budget and risks in plain language.$q$, $q$intermediate$q$, 9, array[$q$Project Management$q$, $q$Planning$q$]::text[], $q$A project is a temporary effort with a goal, a deadline and a budget. Building a classroom, launching an app or organising a graduation event are all projects.

## The five stages
1. **Initiate:** define the goal and who benefits
2. **Plan:** list tasks, owners, dates, costs and risks
3. **Execute:** do the work and communicate
4. **Monitor:** compare progress with the plan and adjust
5. **Close:** hand over, learn lessons and thank the team

## The triangle
Scope (what), time (when) and cost (how much) are linked. If you add scope, you need more time or money.

## Useful tools
- A task list with owners and deadlines
- A simple Gantt chart in Excel
- A risk list: what could go wrong, how likely, what will we do?
- A weekly status update: done, doing, problems

Tip: Break big tasks into pieces of no more than two days of work so progress is easy to see.

## Soft skills
Clear communication, fair sharing of work and calm problem solving matter as much as the tools.$q$, $q$Plan a one-day event for your class. List ten tasks, who does each, deadlines and two risks with a backup plan.$q$, '[{"q":"What does the project triangle link?","options":["Scope, time and cost","Names, dates and places","Boss, team and client","Plan, do and rest"],"correct":0,"why":"Changing one affects the others."},{"q":"Why keep a risk list?","options":["To worry","To plan responses before problems happen","To delay work","To impress"],"correct":1,"why":"Planning for risks saves time."},{"q":"How big should a task be?","options":["As large as possible","Small enough to track, about two days or less","Always a year","No size"],"correct":1,"why":"Small tasks make progress visible."}]'::jsonb, 16),
($q$great-customer-service$q$, $q$business$q$, $q$Great customer service$q$, $q$Listen, solve and follow through, even with difficult customers.$q$, $q$beginner$q$, 7, array[$q$Customer Service$q$, $q$Communication$q$]::text[], $q$Customer service is part of almost every job, from banks to hotels to online support.

## The four steps
1. **Greet and listen:** smile, give full attention and let the customer explain
2. **Understand:** ask questions and repeat the problem back
3. **Solve:** offer a solution or explain what you can do and when
4. **Follow up:** make sure the problem is really solved

## Handling an upset customer
- Stay calm and do not take it personally
- Say "I understand" and "I am sorry for the problem"
- Focus on what you can do, not what you cannot
- If you do not know, say you will find out and give a time

## Written service
In emails and chat, reply quickly, keep sentences short and use the customer's name.

Tip: A customer who has a problem fixed well often becomes more loyal than one who never had a problem.$q$, $q$Write the exact words you would say to a customer whose order arrived late. Include an apology, a solution and a time.$q$, '[{"q":"What is the first step with an upset customer?","options":["Argue","Listen and stay calm","Walk away","Blame the team"],"correct":1,"why":"Listening calms the situation."},{"q":"What should you do if you do not know the answer?","options":["Guess","Say you will find out and give a time","Ignore","Hang up"],"correct":1,"why":"Honest follow-through builds trust."},{"q":"Why follow up?","options":["To check the problem is solved","To waste time","To sell more","It is not needed"],"correct":0,"why":"Follow-up shows you care."}]'::jsonb, 17),
($q$solve-problems-step-by-step$q$, $q$workplace$q$, $q$Solve problems step by step$q$, $q$A five-step method for fixing problems at work or in your studies.$q$, $q$beginner$q$, 8, array[$q$Problem Solving$q$, $q$Critical thinking$q$]::text[], $q$Employers hire people who solve problems instead of only reporting them.

## The five steps
1. **Define the problem** clearly. What exactly is wrong, and since when?
2. **Find the causes.** Ask "why?" five times to reach the root.
3. **List options.** Aim for three possible solutions.
4. **Choose and test.** Pick the best option, try it on a small scale.
5. **Check and learn.** Did it work? What will you do differently next time?

## Tools
- A fishbone diagram groups causes by people, process, equipment and materials
- A pros and cons list compares options
- A checklist prevents the same error again

## Example
A water pump keeps tripping. Why? The motor overheats. Why? The vent is blocked. Why? Dust is not cleaned. Why? No maintenance schedule. Solution: add a weekly cleaning task.

Tip: Bring a possible solution, not just a problem, when you speak to your supervisor.$q$, $q$Choose a recurring problem (late submissions, a noisy study space) and apply the five steps on one page.$q$, '[{"q":"What is the first step?","options":["Blame someone","Define the problem clearly","Buy something","Ignore it"],"correct":1,"why":"A clear definition keeps you on track."},{"q":"What does asking ''why?'' repeatedly help you find?","options":["The root cause","The cheapest option","A friend","A new job"],"correct":0,"why":"It moves past symptoms."},{"q":"What should you bring to your supervisor?","options":["Only the problem","The problem and a possible solution","A complaint","Nothing"],"correct":1,"why":"Solutions show initiative."}]'::jsonb, 18),
($q$validate-a-business-idea$q$, $q$business$q$, $q$Validate a business idea before you spend$q$, $q$Test your idea with real people before investing money.$q$, $q$beginner$q$, 9, array[$q$Entrepreneurship$q$, $q$Market Research$q$]::text[], $q$Many small businesses fail because the owner built something nobody wanted. Test first.

## Questions to answer
- **Who** has the problem? (students, farmers, small shops)
- **What** is the problem and how do they solve it now?
- **Why** would they choose you? (price, quality, convenience)
- **How** will you reach them? (WhatsApp, flyers, referrals)

## Quick tests
1. Talk to ten potential customers. Ask about their problem, not about your idea.
2. Offer a simple version (a trial, a sample or a pre-order) and see who pays.
3. Count the costs honestly: stock, transport, data, your time
4. Calculate break-even: how many sales do you need to cover costs?

## Simple numbers
- Price minus cost per item = profit per item
- Fixed costs divided by profit per item = items needed to break even

Tip: Start small and keep your day job or studies while you learn. Reinvest early profits.

## Rules and support
Find out what registration, licences or permits your business needs and seek advice from small business support services.$q$, $q$Write your idea in one sentence. Interview three potential customers this week and note their answers. Calculate your break-even.$q$, '[{"q":"What is the best first step?","options":["Rent a shop","Talk to potential customers","Buy lots of stock","Print signs"],"correct":1,"why":"Learn from real customers before spending."},{"q":"What is break-even?","options":["Sales needed to cover all costs","Your profit","A discount","Your debt"],"correct":0,"why":"Beyond break-even you earn profit."},{"q":"Why start small?","options":["It is boring","It reduces risk while you learn","It is illegal to start big","It gives free stock"],"correct":1,"why":"Small experiments are cheaper."}]'::jsonb, 19),
($q$build-your-professional-profile$q$, $q$career_basics$q$, $q$Build a professional profile that gets noticed$q$, $q$Use your Mukana profile, headline and network to attract opportunities.$q$, $q$beginner$q$, 8, array[$q$Personal branding$q$, $q$Networking$q$]::text[], $q$Your online profile is often the first thing an employer sees.

## Make your profile strong
- **Photo:** clear, friendly, plain background, dressed smartly
- **Headline:** say what you study or do and what you want, for example "BSc Computer Science student at UZ, seeking attachment in software development"
- **Skills:** list at least six real skills and ask friends to endorse them
- **Projects:** describe one or two things you built, with results
- **CV:** upload a clean one-page PDF

## Grow your network
- Connect with classmates, lecturers, seniors and people you meet at events
- Send a short note with each invitation
- Congratulate others and share useful tips
- Join a group in your field and take part

## Be professional
Post and message as if your future employer will read it, because they might.

Tip: Turn on "Open to work" so recruiters searching for candidates can find you, and keep your availability dates current.$q$, $q$Rewrite your headline in under 110 characters, then invite five people to connect with a personal note.$q$, '[{"q":"What makes a good headline?","options":["A single word","What you study or do and what you want","A joke","Blank"],"correct":1,"why":"A headline explains you in one line."},{"q":"How can you show skills credibly?","options":["List skills with projects and endorsements","Say nothing","Copy someone else''s","Use only adjectives"],"correct":0,"why":"Proof beats claims."},{"q":"What does ''Open to work'' do?","options":["Hides your profile","Lets recruiters know you are looking","Deletes your account","Closes messages"],"correct":1,"why":"It signals you are available."}]'::jsonb, 20);

insert into public.careers (slug, field, title, summary, what_you_do, entry_roles, path, qualifications, subjects, institutions, bodies, skills, tools, how_to_start, pay, keywords, position) values
($q$software-developer$q$, $q$technology$q$, $q$Software Developer$q$, $q$Designs, builds and maintains the apps, websites and systems people use every day.$q$, $q$You turn problems into working software: writing code, testing it, fixing bugs and working with designers, analysts and users. Developers work in banks, telecoms, start-ups, government and as freelancers.$q$, array[$q$Attachee developer$q$, $q$Junior developer$q$, $q$QA tester$q$]::text[], '[{"stage":"Student","roles":"Learn programming, databases and Git. Build small projects.","years":"Years 1 to 3"},{"stage":"Entry level","roles":"Junior developer working under a senior","years":"0 to 2 years"},{"stage":"Mid level","roles":"Developer owning features end to end","years":"2 to 5 years"},{"stage":"Senior","roles":"Senior developer, tech lead or architect","years":"5+ years"}]'::jsonb, array[$q$BSc Computer Science, Software Engineering or Information Systems$q$, $q$Diploma in Software Development or ICT (a start for some roles)$q$, $q$Short courses and certificates that prove practical skills$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Physics or a science subject helps$q$, $q$Computer Studies if offered$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Harare Institute of Technology$q$, $q$Midlands State University$q$, $q$Chinhoyi University of Technology$q$, $q$Africa University$q$]::text[], array[$q$Zimbabwe Computer Society$q$]::text[], array[$q$Python$q$, $q$JavaScript$q$, $q$SQL$q$, $q$Git$q$, $q$Problem Solving$q$, $q$Web Development$q$, $q$Communication$q$]::text[], array[$q$VS Code$q$, $q$GitHub$q$, $q$PostgreSQL$q$, $q$React$q$, $q$Linux$q$]::text[], $q$Build two or three real projects (a student app, a small shop system), put them on GitHub, and apply for attachment or internships in software teams. Practise coding daily for 30 minutes.$q$, '{"entry":[350,800],"mid":[900,2200],"senior":[2200,5000]}'::jsonb, array[$q$software$q$, $q$developer$q$, $q$programming$q$, $q$computer science$q$, $q$web$q$, $q$app$q$]::text[], 1),
($q$data-analyst$q$, $q$technology$q$, $q$Data Analyst$q$, $q$Turns raw data into insights that help organisations decide.$q$, $q$You collect and clean data, build reports and dashboards, and explain what the numbers mean. Data analysts work in banks, retail, health, agriculture and government.$q$, array[$q$Data intern$q$, $q$Junior analyst$q$, $q$Reporting officer$q$]::text[], '[{"stage":"Student","roles":"Learn statistics, Excel, SQL and a visualisation tool","years":"Years 1 to 3"},{"stage":"Entry level","roles":"Junior data analyst preparing reports","years":"0 to 2 years"},{"stage":"Mid level","roles":"Analyst leading projects and dashboards","years":"2 to 5 years"},{"stage":"Senior","roles":"Senior analyst, data scientist or analytics manager","years":"5+ years"}]'::jsonb, array[$q$BSc Statistics, Data Science, Mathematics, Computer Science or Economics$q$, $q$Certificates in Excel, SQL, Power BI or Python$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Statistics or Accounts helps$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Harare Institute of Technology$q$, $q$Bindura University of Science Education$q$]::text[], array[$q$Zimbabwe Statistical society or Zimbabwe Computer Society (where applicable)$q$]::text[], array[$q$Excel$q$, $q$SQL$q$, $q$Statistics$q$, $q$Power BI$q$, $q$Data Analysis$q$, $q$Python$q$, $q$Communication$q$]::text[], array[$q$Excel$q$, $q$Power BI$q$, $q$SQL$q$, $q$Python$q$, $q$R$q$]::text[], $q$Practise with public datasets, build a small dashboard, and explain it in a short written summary. Take the Excel and Think with data lessons in the Skills hub.$q$, '{"entry":[350,800],"mid":[900,2000],"senior":[2000,4500]}'::jsonb, array[$q$data$q$, $q$analyst$q$, $q$statistics$q$, $q$reporting$q$, $q$analytics$q$]::text[], 2),
($q$it-support-network-engineer$q$, $q$technology$q$, $q$IT Support and Network Engineer$q$, $q$Keeps computers, networks and systems running for an organisation.$q$, $q$You set up and repair devices, manage user accounts, maintain networks and respond to problems. It is a practical job with many entry points.$q$, array[$q$IT attachee$q$, $q$Help desk officer$q$, $q$Junior network technician$q$]::text[], '[{"stage":"Student","roles":"Learn hardware, operating systems and networking","years":"Years 1 to 3"},{"stage":"Entry level","roles":"Help desk or technician","years":"0 to 2 years"},{"stage":"Mid level","roles":"Network or systems administrator","years":"2 to 5 years"},{"stage":"Senior","roles":"IT manager or infrastructure engineer","years":"5+ years"}]'::jsonb, array[$q$Diploma or degree in Information Technology, Computer Science or Telecommunications$q$, $q$Industry certificates such as CCNA or CompTIA$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Computer Studies if offered$q$]::text[], array[$q$Harare Institute of Technology$q$, $q$National University of Science and Technology (NUST)$q$, $q$University of Zimbabwe$q$, $q$Midlands State University$q$, $q$Harare and Bulawayo polytechnics$q$]::text[], array[$q$Zimbabwe Computer Society$q$]::text[], array[$q$Networking$q$, $q$Linux$q$, $q$Troubleshooting$q$, $q$Customer Service$q$, $q$Communication$q$]::text[], array[$q$Windows Server$q$, $q$Linux$q$, $q$Cisco$q$, $q$Wireshark$q$]::text[], $q$Practise by setting up a small home network, learn the basics of Linux, and volunteer to support a school or small business lab.$q$, '{"entry":[250,550],"mid":[600,1200],"senior":[1200,2500]}'::jsonb, array[$q$network$q$, $q$it support$q$, $q$systems$q$, $q$helpdesk$q$, $q$infrastructure$q$]::text[], 3),
($q$cyber-security-analyst$q$, $q$technology$q$, $q$Cyber Security Analyst$q$, $q$Protects organisations from hackers, fraud and data loss.$q$, $q$You monitor systems for attacks, test defences, respond to incidents and teach staff safe habits. Banks, telecoms and government need more of these specialists.$q$, array[$q$Security intern$q$, $q$SOC analyst (junior)$q$, $q$IT security officer$q$]::text[], '[{"stage":"Student","roles":"Learn networking, operating systems and security basics","years":"Years 1 to 3"},{"stage":"Entry level","roles":"Junior security analyst","years":"0 to 2 years"},{"stage":"Mid level","roles":"Security engineer or incident responder","years":"2 to 5 years"},{"stage":"Senior","roles":"Security architect or CISO","years":"6+ years"}]'::jsonb, array[$q$BSc in Computer Science, Information Systems or Cyber Security$q$, $q$Certifications such as Security+, CEH or CISSP later in your career$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Computer Studies if offered$q$]::text[], array[$q$Harare Institute of Technology$q$, $q$National University of Science and Technology (NUST)$q$, $q$University of Zimbabwe$q$, $q$Chinhoyi University of Technology$q$]::text[], array[$q$Zimbabwe Computer Society$q$]::text[], array[$q$Networking$q$, $q$Linux$q$, $q$Problem Solving$q$, $q$Security$q$, $q$Communication$q$]::text[], array[$q$Wireshark$q$, $q$Linux$q$, $q$Nmap$q$, $q$SIEM tools$q$]::text[], $q$Learn networking well, practise safe hacking in lab environments, and follow security news. Use the Stay safe online lesson to build habits.$q$, '{"entry":[400,900],"mid":[1000,2500],"senior":[2500,5500]}'::jsonb, array[$q$security$q$, $q$cyber$q$, $q$network$q$, $q$information systems$q$]::text[], 4),
($q$telecommunications-engineer$q$, $q$technology$q$, $q$Telecommunications Engineer$q$, $q$Designs and maintains the networks that carry voice, data and mobile money.$q$, $q$You plan, install and optimise mobile, fibre and radio networks, fix faults and make sure coverage and speed meet demand.$q$, array[$q$Telecoms attachee$q$, $q$Network operations engineer$q$, $q$Radio planning trainee$q$]::text[], '[{"stage":"Student","roles":"Learn electronics, signals and networking","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Graduate engineer in a network operations team","years":"0 to 2 years"},{"stage":"Mid level","roles":"Network or radio planning engineer","years":"2 to 5 years"},{"stage":"Senior","roles":"Principal engineer or network manager","years":"6+ years"}]'::jsonb, array[$q$BEng Telecommunications, Electronic or Electrical Engineering$q$, $q$Vendor certificates (for example Huawei or Cisco)$q$]::text[], array[$q$Mathematics$q$, $q$Physics$q$, $q$English$q$]::text[], array[$q$Harare Institute of Technology$q$, $q$National University of Science and Technology (NUST)$q$, $q$University of Zimbabwe$q$, $q$Midlands State University$q$]::text[], array[$q$Engineering Council of Zimbabwe$q$, $q$Zimbabwe Institution of Engineers$q$]::text[], array[$q$Networking$q$, $q$Circuit Design$q$, $q$Fault Finding$q$, $q$Problem Solving$q$, $q$Safety Procedures$q$]::text[], array[$q$Spectrum analysers$q$, $q$Fibre splicers$q$, $q$Network monitoring tools$q$]::text[], $q$Apply for attachments in network operations, learn the basics of RF and fibre, and take a networking certificate while you study.$q$, '{"entry":[350,800],"mid":[800,1800],"senior":[1800,4000]}'::jsonb, array[$q$telecom$q$, $q$network$q$, $q$radio$q$, $q$fibre$q$, $q$electronic$q$]::text[], 5),
($q$accountant$q$, $q$finance$q$, $q$Accountant$q$, $q$Records, analyses and reports a business's money.$q$, $q$You prepare financial statements, manage ledgers, budgets and tax, and advise managers. Accountants work in every sector.$q$, array[$q$Accounting attachee$q$, $q$Accounts clerk$q$, $q$Graduate trainee accountant$q$]::text[], '[{"stage":"Student","roles":"Study accounting and start professional papers","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Trainee or junior accountant","years":"0 to 3 years"},{"stage":"Mid level","roles":"Accountant or finance officer, qualified","years":"3 to 7 years"},{"stage":"Senior","roles":"Finance manager, financial controller or CFO","years":"8+ years"}]'::jsonb, array[$q$BCom or BAcc in Accounting, plus professional papers (ACCA, CIMA or ICAZ route)$q$, $q$Diploma in Accounting for technician roles$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Accounts or Commerce helps$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Africa University$q$, $q$Great Zimbabwe University$q$, $q$Zimbabwe Open University$q$]::text[], array[$q$Institute of Chartered Accountants of Zimbabwe (ICAZ)$q$, $q$ACCA$q$, $q$CIMA$q$]::text[], array[$q$Excel$q$, $q$Bookkeeping$q$, $q$Financial Reporting$q$, $q$Budgeting$q$, $q$Tax$q$, $q$IFRS$q$, $q$Communication$q$]::text[], array[$q$Excel$q$, $q$Sage Pastel$q$, $q$QuickBooks$q$, $q$SAP$q$]::text[], $q$Start professional papers early, practise Excel, and apply for attachment in the finance department. Use the Bookkeeping lesson in the Skills hub.$q$, '{"entry":[300,700],"mid":[800,1800],"senior":[1800,4500]}'::jsonb, array[$q$account$q$, $q$finance$q$, $q$bookkeeping$q$, $q$payroll$q$]::text[], 6),
($q$auditor$q$, $q$finance$q$, $q$Auditor$q$, $q$Checks that financial records are accurate and that rules are followed.$q$, $q$You examine accounts, test controls and report findings to management and owners. External auditors work at audit firms; internal auditors work inside organisations.$q$, array[$q$Audit intern$q$, $q$Audit trainee$q$, $q$Junior auditor$q$]::text[], '[{"stage":"Student","roles":"Study accounting and auditing","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Audit trainee at a firm","years":"0 to 3 years"},{"stage":"Mid level","roles":"Senior auditor or audit supervisor","years":"3 to 6 years"},{"stage":"Senior","roles":"Audit manager or partner","years":"8+ years"}]'::jsonb, array[$q$BCom in Accounting or Auditing, plus ACCA or ICAZ papers$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Accounts$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Africa University$q$]::text[], array[$q$ICAZ$q$, $q$ACCA$q$, $q$Public Accountants and Auditors Board$q$]::text[], array[$q$Auditing$q$, $q$Excel$q$, $q$Financial Reporting$q$, $q$IFRS$q$, $q$Report Writing$q$, $q$Attention to detail$q$]::text[], array[$q$Excel$q$, $q$Audit software$q$, $q$Sage$q$, $q$SAP$q$]::text[], $q$Apply for audit firm internships, learn IFRS basics and practise writing clear findings.$q$, '{"entry":[300,700],"mid":[800,1800],"senior":[1800,4500]}'::jsonb, array[$q$audit$q$, $q$account$q$, $q$finance$q$, $q$compliance$q$]::text[], 7),
($q$bank-officer$q$, $q$finance$q$, $q$Bank Officer$q$, $q$Serves customers and manages accounts, loans and payments.$q$, $q$You open accounts, process transactions, assess loans, and help customers with products such as mobile banking. Graduates often join trainee programmes that rotate across departments.$q$, array[$q$Banking attachee$q$, $q$Teller or customer service officer$q$, $q$Graduate trainee$q$]::text[], '[{"stage":"Student","roles":"Study banking, finance or business","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Graduate trainee or customer service officer","years":"0 to 2 years"},{"stage":"Mid level","roles":"Relationship, credit or operations officer","years":"2 to 6 years"},{"stage":"Senior","roles":"Branch manager or head of department","years":"7+ years"}]'::jsonb, array[$q$BCom Banking and Finance, Accounting, Economics or Business$q$, $q$Banking certificates$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Accounts or Commerce$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Africa University$q$, $q$Great Zimbabwe University$q$]::text[], array[$q$ACCA$q$, $q$banking institutes and certificates$q$]::text[], array[$q$Customer Service$q$, $q$Excel$q$, $q$Communication$q$, $q$Sales$q$, $q$Numeracy$q$, $q$Integrity$q$]::text[], array[$q$Core banking systems$q$, $q$Excel$q$]::text[], $q$Practise customer service, learn how loans and interest work, and apply to bank graduate trainee programmes.$q$, '{"entry":[300,650],"mid":[700,1500],"senior":[1500,4000]}'::jsonb, array[$q$bank$q$, $q$finance$q$, $q$customer$q$, $q$credit$q$]::text[], 8),
($q$financial-analyst$q$, $q$finance$q$, $q$Financial Analyst$q$, $q$Studies financial data to guide investment and business decisions.$q$, $q$You build financial models, forecast revenue and costs, assess projects and present recommendations to managers.$q$, array[$q$Finance intern$q$, $q$Junior analyst$q$, $q$Graduate trainee: finance$q$]::text[], '[{"stage":"Student","roles":"Study finance or accounting and learn Excel modelling","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Junior financial analyst","years":"0 to 2 years"},{"stage":"Mid level","roles":"Senior analyst or portfolio analyst","years":"3 to 6 years"},{"stage":"Senior","roles":"Finance manager or investment manager","years":"7+ years"}]'::jsonb, array[$q$BCom Finance, Accounting, Economics or Statistics$q$, $q$ACCA, CIMA or CFA later$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Accounts or Economics$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Africa University$q$]::text[], array[$q$ACCA$q$, $q$CIMA$q$]::text[], array[$q$Excel$q$, $q$Financial Reporting$q$, $q$Budgeting$q$, $q$Data Analysis$q$, $q$Communication$q$]::text[], array[$q$Excel$q$, $q$Power BI$q$, $q$Financial databases$q$]::text[], $q$Practise building a simple budget and forecast model in Excel and explain your assumptions clearly.$q$, '{"entry":[400,850],"mid":[900,2000],"senior":[2000,5000]}'::jsonb, array[$q$finance$q$, $q$analyst$q$, $q$budget$q$, $q$investment$q$]::text[], 9),
($q$economist$q$, $q$finance$q$, $q$Economist$q$, $q$Studies how money, markets and policy shape people's lives.$q$, $q$You analyse data on prices, jobs, trade and growth, write reports and advise banks, government, NGOs and businesses.$q$, array[$q$Research assistant$q$, $q$Junior economist$q$, $q$Policy analyst trainee$q$]::text[], '[{"stage":"Student","roles":"Study economics, statistics and writing","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Research or junior analyst","years":"0 to 2 years"},{"stage":"Mid level","roles":"Economist","years":"3 to 6 years"},{"stage":"Senior","roles":"Senior economist or policy adviser","years":"8+ years"}]'::jsonb, array[$q$BSc Economics (often with Statistics), MSc for senior research roles$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Economics or Geography$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Africa University$q$]::text[], array[$q$Zimbabwe Economic Society$q$]::text[], array[$q$Statistics$q$, $q$Data Analysis$q$, $q$Excel$q$, $q$Report Writing$q$, $q$Communication$q$]::text[], array[$q$Excel$q$, $q$Stata or R$q$, $q$Power BI$q$]::text[], $q$Write short briefs on current economic issues, learn a statistics tool and apply for research internships.$q$, '{"entry":[350,750],"mid":[800,1800],"senior":[1800,4000]}'::jsonb, array[$q$economic$q$, $q$research$q$, $q$policy$q$, $q$statistics$q$]::text[], 10),
($q$marketing-officer$q$, $q$finance$q$, $q$Marketing Officer$q$, $q$Helps people discover and choose a company's products.$q$, $q$You research customers, plan campaigns, manage social media, write content and measure results.$q$, array[$q$Marketing attachee$q$, $q$Social media assistant$q$, $q$Junior marketing officer$q$]::text[], '[{"stage":"Student","roles":"Study marketing and build a content portfolio","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Marketing assistant or officer","years":"0 to 2 years"},{"stage":"Mid level","roles":"Brand or digital marketing specialist","years":"2 to 6 years"},{"stage":"Senior","roles":"Marketing manager or head of marketing","years":"7+ years"}]'::jsonb, array[$q$BCom Marketing, Business Management or Communication$q$, $q$Digital marketing certificates$q$]::text[], array[$q$English$q$, $q$Business Studies$q$, $q$Mathematics$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Africa University$q$, $q$Chinhoyi University of Technology$q$]::text[], array[$q$Marketers Association of Zimbabwe$q$]::text[], array[$q$Social Media Marketing$q$, $q$Market Research$q$, $q$Canva$q$, $q$Content Writing$q$, $q$Communication$q$, $q$Sales$q$]::text[], array[$q$Canva$q$, $q$Meta Business Suite$q$, $q$Google Analytics$q$, $q$Excel$q$]::text[], $q$Run a small campaign for a local business or club, track results and show them in your portfolio.$q$, '{"entry":[250,600],"mid":[600,1500],"senior":[1500,3500]}'::jsonb, array[$q$marketing$q$, $q$brand$q$, $q$social media$q$, $q$sales$q$, $q$customer$q$]::text[], 11),
($q$human-resource-officer$q$, $q$finance$q$, $q$Human Resource Officer$q$, $q$Recruits, develops and supports the people of an organisation.$q$, $q$You manage recruitment, onboarding, payroll inputs, training, employee relations and policies.$q$, array[$q$HR attachee$q$, $q$HR assistant$q$, $q$Graduate trainee: HR$q$]::text[], '[{"stage":"Student","roles":"Study HR management and labour law","years":"Years 1 to 4"},{"stage":"Entry level","roles":"HR assistant or officer","years":"0 to 3 years"},{"stage":"Mid level","roles":"HR generalist or specialist","years":"3 to 7 years"},{"stage":"Senior","roles":"HR manager or director","years":"8+ years"}]'::jsonb, array[$q$BSc or BCom in Human Resource Management$q$, $q$IPMZ qualifications$q$]::text[], array[$q$English$q$, $q$Business Studies$q$, $q$Mathematics$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Africa University$q$, $q$Great Zimbabwe University$q$]::text[], array[$q$Institute of People Management of Zimbabwe (IPMZ)$q$]::text[], array[$q$Recruitment$q$, $q$Labour Law$q$, $q$Communication$q$, $q$Excel$q$, $q$Payroll$q$, $q$Interviewing$q$]::text[], array[$q$Excel$q$, $q$HR information systems$q$]::text[], $q$Learn the basics of labour law, practise structured interviewing and volunteer to help organise recruitment events.$q$, '{"entry":[250,600],"mid":[600,1400],"senior":[1400,3500]}'::jsonb, array[$q$human resource$q$, $q$hr$q$, $q$recruitment$q$, $q$people$q$, $q$payroll$q$]::text[], 12),
($q$supply-chain-officer$q$, $q$finance$q$, $q$Supply Chain and Procurement Officer$q$, $q$Gets the right goods to the right place at the right price.$q$, $q$You source suppliers, compare quotations, manage stock, plan transport and keep records so operations never run out of materials.$q$, array[$q$Procurement attachee$q$, $q$Stores clerk$q$, $q$Graduate trainee: supply chain$q$]::text[], '[{"stage":"Student","roles":"Study supply chain or logistics","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Procurement or stores officer","years":"0 to 2 years"},{"stage":"Mid level","roles":"Buyer or logistics coordinator","years":"3 to 6 years"},{"stage":"Senior","roles":"Supply chain manager","years":"7+ years"}]'::jsonb, array[$q$BCom Supply Chain Management, Logistics or Business$q$, $q$CIPS professional qualifications$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Business Studies$q$]::text[], array[$q$Midlands State University$q$, $q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Chinhoyi University of Technology$q$, $q$Great Zimbabwe University$q$]::text[], array[$q$Chartered Institute of Procurement and Supply (CIPS)$q$]::text[], array[$q$Procurement$q$, $q$Inventory Management$q$, $q$Logistics Planning$q$, $q$Excel$q$, $q$Negotiation$q$]::text[], array[$q$Excel$q$, $q$SAP$q$, $q$Inventory systems$q$]::text[], $q$Learn to compare quotations and manage stock in Excel, and apply for attachments in stores or procurement.$q$, '{"entry":[300,650],"mid":[700,1600],"senior":[1600,3800]}'::jsonb, array[$q$supply chain$q$, $q$procurement$q$, $q$logistics$q$, $q$stores$q$, $q$inventory$q$]::text[], 13),
($q$business-analyst$q$, $q$finance$q$, $q$Business Analyst$q$, $q$Connects business problems to practical solutions.$q$, $q$You gather requirements, map processes, analyse data and help teams improve how they work or build the right systems.$q$, array[$q$Business analysis intern$q$, $q$Junior business analyst$q$, $q$Operations analyst$q$]::text[], '[{"stage":"Student","roles":"Study business, IT or statistics","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Junior analyst","years":"0 to 2 years"},{"stage":"Mid level","roles":"Business analyst","years":"3 to 6 years"},{"stage":"Senior","roles":"Senior analyst or product manager","years":"7+ years"}]'::jsonb, array[$q$BCom, BSc in Business, Information Systems, Computer Science or Statistics$q$]::text[], array[$q$English$q$, $q$Mathematics$q$, $q$Business Studies$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Harare Institute of Technology$q$]::text[], array[$q$Zimbabwe Computer Society (where applicable)$q$]::text[], array[$q$Data Analysis$q$, $q$Communication$q$, $q$Excel$q$, $q$Problem Solving$q$, $q$Report Writing$q$]::text[], array[$q$Excel$q$, $q$Power BI$q$, $q$Process mapping tools$q$]::text[], $q$Practise mapping a process you know well (like enrolment) on one page, and write a short problem statement.$q$, '{"entry":[400,850],"mid":[900,2000],"senior":[2000,4500]}'::jsonb, array[$q$business analyst$q$, $q$analyst$q$, $q$operations$q$, $q$process$q$]::text[], 14),
($q$entrepreneur$q$, $q$finance$q$, $q$Entrepreneur and Small Business Owner$q$, $q$Starts and grows a business that solves a real problem.$q$, $q$You find a need, test an idea, sell, manage money and people, and keep improving. Income varies widely, especially at the start.$q$, array[$q$Side business while studying$q$, $q$Business support intern$q$, $q$Start-up junior$q$]::text[], '[{"stage":"Student","roles":"Test ideas on a small scale","years":"Any time"},{"stage":"Start","roles":"Launch a small product or service","years":"Year 0 to 2"},{"stage":"Grow","roles":"Hire help, formalise and reinvest","years":"Year 2 to 5"},{"stage":"Scale","roles":"Expand and build a team","years":"5+ years"}]'::jsonb, array[$q$No fixed qualification. Business, accounting or the field of your product helps.$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Business Studies$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Africa University$q$, $q$Zimbabwe Open University$q$]::text[], array[$q$Business associations and small business support bodies$q$]::text[], array[$q$Sales$q$, $q$Bookkeeping$q$, $q$Customer Service$q$, $q$Market Research$q$, $q$Communication$q$, $q$Budgeting$q$]::text[], array[$q$WhatsApp Business$q$, $q$Mobile money$q$, $q$Excel$q$]::text[], $q$Use the Validate a business idea lesson: talk to ten customers, sell a small version and keep records from day one.$q$, '{"entry":[0,500],"mid":[300,2000],"senior":[1000,6000]}'::jsonb, array[$q$business$q$, $q$entrepreneur$q$, $q$start-up$q$, $q$sales$q$]::text[], 15),
($q$project-manager$q$, $q$finance$q$, $q$Project Manager$q$, $q$Leads teams to deliver projects on time and within budget.$q$, $q$You define scope, plan schedules and costs, manage risks and keep stakeholders informed, in construction, IT, NGOs and industry.$q$, array[$q$Project assistant$q$, $q$Project coordinator$q$, $q$Graduate trainee$q$]::text[], '[{"stage":"Student","roles":"Study your field and lead student projects","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Project assistant","years":"0 to 3 years"},{"stage":"Mid level","roles":"Project coordinator or manager","years":"3 to 7 years"},{"stage":"Senior","roles":"Senior project manager or programme director","years":"8+ years"}]'::jsonb, array[$q$A degree in your field (engineering, IT, business), plus project management certification (for example PMP or PRINCE2) later$q$]::text[], array[$q$Mathematics$q$, $q$English$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Harare Institute of Technology$q$]::text[], array[$q$Project Management Institute chapters$q$]::text[], array[$q$Project Management$q$, $q$Communication$q$, $q$Planning$q$, $q$Budgeting$q$, $q$Teamwork$q$, $q$Problem Solving$q$]::text[], array[$q$Excel$q$, $q$MS Project$q$, $q$Trello or similar$q$]::text[], $q$Take the Project management basics lesson, lead a student event or club project and keep a simple plan and risk list.$q$, '{"entry":[450,900],"mid":[1000,2500],"senior":[2500,5500]}'::jsonb, array[$q$project$q$, $q$coordinator$q$, $q$planning$q$, $q$construction$q$]::text[], 16),
($q$civil-engineer$q$, $q$engineering$q$, $q$Civil Engineer$q$, $q$Designs and builds roads, bridges, water systems and buildings.$q$, $q$You design structures, supervise construction, check quality and safety and manage budgets and schedules.$q$, array[$q$Site attachee$q$, $q$Graduate engineer$q$, $q$Site engineer$q$]::text[], '[{"stage":"Student","roles":"Study engineering and complete attachments","years":"Years 1 to 5"},{"stage":"Entry level","roles":"Graduate engineer","years":"0 to 3 years"},{"stage":"Mid level","roles":"Professional engineer or project engineer","years":"3 to 8 years"},{"stage":"Senior","roles":"Senior engineer or project director","years":"10+ years"}]'::jsonb, array[$q$BEng Civil Engineering, followed by professional registration$q$]::text[], array[$q$Mathematics$q$, $q$Physics$q$, $q$English$q$]::text[], array[$q$National University of Science and Technology (NUST)$q$, $q$University of Zimbabwe$q$, $q$Harare Institute of Technology$q$, $q$Midlands State University$q$]::text[], array[$q$Engineering Council of Zimbabwe$q$, $q$Zimbabwe Institution of Engineers$q$]::text[], array[$q$AutoCAD$q$, $q$Structural Analysis$q$, $q$Surveying$q$, $q$Project Management$q$, $q$Site Supervision$q$, $q$Report Writing$q$]::text[], array[$q$AutoCAD$q$, $q$Revit$q$, $q$Excel$q$, $q$Surveying equipment$q$]::text[], $q$Seek site attachments each long vacation, learn AutoCAD and keep a good logbook.$q$, '{"entry":[350,800],"mid":[800,2000],"senior":[2000,4500]}'::jsonb, array[$q$civil$q$, $q$construction$q$, $q$site$q$, $q$structural$q$, $q$engineering$q$]::text[], 17),
($q$electrical-engineer$q$, $q$engineering$q$, $q$Electrical Engineer$q$, $q$Designs and maintains power systems, machines and control systems.$q$, $q$You design electrical installations, maintain generation and distribution equipment, work with control systems and ensure safety.$q$, array[$q$Maintenance attachee$q$, $q$Graduate engineer$q$, $q$Power systems trainee$q$]::text[], '[{"stage":"Student","roles":"Study engineering and attach in industry","years":"Years 1 to 5"},{"stage":"Entry level","roles":"Graduate engineer","years":"0 to 3 years"},{"stage":"Mid level","roles":"Professional engineer","years":"3 to 8 years"},{"stage":"Senior","roles":"Chief engineer or manager","years":"10+ years"}]'::jsonb, array[$q$BEng Electrical Engineering and professional registration$q$]::text[], array[$q$Mathematics$q$, $q$Physics$q$, $q$English$q$]::text[], array[$q$National University of Science and Technology (NUST)$q$, $q$University of Zimbabwe$q$, $q$Harare Institute of Technology$q$, $q$Midlands State University$q$]::text[], array[$q$Engineering Council of Zimbabwe$q$, $q$Zimbabwe Institution of Engineers$q$]::text[], array[$q$Circuit Design$q$, $q$Power Systems$q$, $q$PLC Programming$q$, $q$Maintenance$q$, $q$Safety Procedures$q$, $q$MATLAB$q$]::text[], array[$q$AutoCAD$q$, $q$MATLAB$q$, $q$PLC software$q$]::text[], $q$Seek attachments in power or manufacturing, practise PLC basics and always follow safety rules.$q$, '{"entry":[350,800],"mid":[800,2000],"senior":[2000,4500]}'::jsonb, array[$q$electrical$q$, $q$power$q$, $q$maintenance$q$, $q$plc$q$, $q$engineering$q$]::text[], 18),
($q$mechanical-engineer$q$, $q$engineering$q$, $q$Mechanical Engineer$q$, $q$Designs, maintains and improves machines and plants.$q$, $q$You design machine parts, maintain plant equipment, improve production and solve breakdown problems.$q$, array[$q$Maintenance attachee$q$, $q$Graduate engineer$q$, $q$Production engineer$q$]::text[], '[{"stage":"Student","roles":"Study engineering and attach in plants or workshops","years":"Years 1 to 5"},{"stage":"Entry level","roles":"Graduate engineer","years":"0 to 3 years"},{"stage":"Mid level","roles":"Maintenance or production engineer","years":"3 to 8 years"},{"stage":"Senior","roles":"Plant manager or chief engineer","years":"10+ years"}]'::jsonb, array[$q$BEng Mechanical or Industrial and Manufacturing Engineering$q$]::text[], array[$q$Mathematics$q$, $q$Physics$q$, $q$English$q$]::text[], array[$q$National University of Science and Technology (NUST)$q$, $q$University of Zimbabwe$q$, $q$Harare Institute of Technology$q$, $q$Midlands State University$q$]::text[], array[$q$Engineering Council of Zimbabwe$q$, $q$Zimbabwe Institution of Engineers$q$]::text[], array[$q$SolidWorks$q$, $q$AutoCAD$q$, $q$Maintenance$q$, $q$Quality Control$q$, $q$Thermodynamics$q$, $q$Workshop Practice$q$]::text[], array[$q$SolidWorks$q$, $q$AutoCAD$q$, $q$Excel$q$]::text[], $q$Seek attachments in manufacturing or mines, learn a CAD tool and document a maintenance improvement you made.$q$, '{"entry":[350,800],"mid":[800,2000],"senior":[2000,4500]}'::jsonb, array[$q$mechanical$q$, $q$maintenance$q$, $q$production$q$, $q$manufacturing$q$, $q$engineering$q$]::text[], 19),
($q$mining-engineer$q$, $q$mining$q$, $q$Mining Engineer$q$, $q$Plans and runs safe and efficient mines.$q$, $q$You design mine layouts, plan production, manage safety and ventilation, and control costs in open-pit or underground mines.$q$, array[$q$Mine attachee$q$, $q$Graduate mining engineer$q$, $q$Mine planning trainee$q$]::text[], '[{"stage":"Student","roles":"Study mining engineering and attach at mines","years":"Years 1 to 5"},{"stage":"Entry level","roles":"Graduate mining engineer","years":"0 to 3 years"},{"stage":"Mid level","roles":"Mine planning or production engineer","years":"3 to 8 years"},{"stage":"Senior","roles":"Mine manager","years":"10+ years"}]'::jsonb, array[$q$BEng Mining Engineering and professional registration$q$]::text[], array[$q$Mathematics$q$, $q$Physics$q$, $q$Chemistry$q$, $q$English$q$]::text[], array[$q$National University of Science and Technology (NUST)$q$, $q$University of Zimbabwe$q$, $q$Bindura University of Science Education$q$, $q$Midlands State University$q$]::text[], array[$q$Engineering Council of Zimbabwe$q$, $q$Chamber of Mines of Zimbabwe (industry)$q$]::text[], array[$q$Mine Planning$q$, $q$Surveying$q$, $q$Safety Management$q$, $q$AutoCAD$q$, $q$Data Analysis$q$, $q$Report Writing$q$]::text[], array[$q$Surpac or similar$q$, $q$AutoCAD$q$, $q$Excel$q$]::text[], $q$Seek vacation attachments at mines, complete safety induction and learn mine planning software.$q$, '{"entry":[500,1200],"mid":[1200,3000],"senior":[3000,7000]}'::jsonb, array[$q$mining$q$, $q$mine$q$, $q$geology$q$, $q$safety$q$, $q$engineering$q$]::text[], 20),
($q$metallurgical-chemical-engineer$q$, $q$mining$q$, $q$Metallurgical and Chemical Engineer$q$, $q$Turns raw ore and materials into valuable products.$q$, $q$You design and run processing plants, control quality, reduce losses and improve safety in mineral processing, chemicals and manufacturing.$q$, array[$q$Plant attachee$q$, $q$Graduate metallurgist$q$, $q$Process engineer trainee$q$]::text[], '[{"stage":"Student","roles":"Study metallurgy or chemical engineering and attach in plants","years":"Years 1 to 5"},{"stage":"Entry level","roles":"Graduate process engineer","years":"0 to 3 years"},{"stage":"Mid level","roles":"Process or plant engineer","years":"3 to 8 years"},{"stage":"Senior","roles":"Plant manager or technical manager","years":"10+ years"}]'::jsonb, array[$q$BEng Metallurgical or Chemical Engineering$q$]::text[], array[$q$Mathematics$q$, $q$Physics$q$, $q$Chemistry$q$, $q$English$q$]::text[], array[$q$National University of Science and Technology (NUST)$q$, $q$University of Zimbabwe$q$, $q$Harare Institute of Technology$q$]::text[], array[$q$Engineering Council of Zimbabwe$q$, $q$Zimbabwe Institution of Engineers$q$]::text[], array[$q$Mineral Processing$q$, $q$Quality Control$q$, $q$Data Analysis$q$, $q$Safety Management$q$, $q$Excel$q$]::text[], array[$q$Excel$q$, $q$Process simulation software$q$, $q$Laboratory equipment$q$]::text[], $q$Seek attachments at processing plants or laboratories and learn to read process flow diagrams.$q$, '{"entry":[400,900],"mid":[900,2200],"senior":[2200,5000]}'::jsonb, array[$q$metallurg$q$, $q$chemical$q$, $q$process$q$, $q$plant$q$, $q$processing$q$]::text[], 21),
($q$quantity-surveyor$q$, $q$engineering$q$, $q$Quantity Surveyor$q$, $q$Measures, prices and controls the costs of construction projects.$q$, $q$You measure quantities from drawings, prepare bills of quantities and tenders, value work done and control project costs.$q$, array[$q$QS attachee$q$, $q$Junior quantity surveyor$q$, $q$Graduate trainee$q$]::text[], '[{"stage":"Student","roles":"Study quantity surveying or construction management","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Junior QS","years":"0 to 3 years"},{"stage":"Mid level","roles":"Quantity surveyor","years":"3 to 8 years"},{"stage":"Senior","roles":"Senior QS or commercial manager","years":"9+ years"}]'::jsonb, array[$q$BSc Quantity Surveying or Construction Management, plus professional registration$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Technical Graphics or Physics helps$q$]::text[], array[$q$National University of Science and Technology (NUST)$q$, $q$University of Zimbabwe$q$, $q$Harare Institute of Technology$q$]::text[], array[$q$relevant professional institute for quantity surveyors$q$]::text[], array[$q$Excel$q$, $q$Budgeting$q$, $q$Project Management$q$, $q$Report Writing$q$, $q$Attention to detail$q$]::text[], array[$q$Excel$q$, $q$Measurement software$q$, $q$AutoCAD$q$]::text[], $q$Practise measuring a simple drawing, building a bill of quantities in Excel and seek site attachments.$q$, '{"entry":[350,750],"mid":[800,1900],"senior":[1900,4200]}'::jsonb, array[$q$quantity$q$, $q$surveyor$q$, $q$construction$q$, $q$estimat$q$]::text[], 22),
($q$architect$q$, $q$engineering$q$, $q$Architect$q$, $q$Designs buildings and spaces that are useful and beautiful.$q$, $q$You design buildings, produce drawings, work with engineers and clients, and supervise construction.$q$, array[$q$Architecture attachee$q$, $q$Architectural assistant$q$, $q$Graduate architect$q$]::text[], '[{"stage":"Student","roles":"Study architecture and build a design portfolio","years":"Years 1 to 5"},{"stage":"Entry level","roles":"Architectural assistant","years":"0 to 3 years"},{"stage":"Mid level","roles":"Registered architect","years":"3 to 8 years"},{"stage":"Senior","roles":"Senior architect or partner","years":"10+ years"}]'::jsonb, array[$q$Degree in Architecture, then professional registration$q$]::text[], array[$q$Mathematics$q$, $q$Art or Technical Graphics$q$, $q$English$q$]::text[], array[$q$National University of Science and Technology (NUST)$q$, $q$University of Zimbabwe$q$, $q$Harare Institute of Technology$q$]::text[], array[$q$Architects Council of Zimbabwe$q$]::text[], array[$q$AutoCAD$q$, $q$Design$q$, $q$Revit$q$, $q$Communication$q$, $q$Project Management$q$]::text[], array[$q$AutoCAD$q$, $q$Revit$q$, $q$SketchUp$q$]::text[], $q$Build a portfolio of drawings and models, attach with an architecture firm and learn CAD and 3D tools.$q$, '{"entry":[350,750],"mid":[800,1900],"senior":[1900,4200]}'::jsonb, array[$q$architect$q$, $q$design$q$, $q$drawing$q$, $q$construction$q$]::text[], 23),
($q$geologist$q$, $q$mining$q$, $q$Geologist$q$, $q$Finds and studies the minerals and rocks beneath our feet.$q$, $q$You map rock formations, sample and analyse them, interpret data and help find and evaluate mineral deposits and groundwater.$q$, array[$q$Geology attachee$q$, $q$Field geologist$q$, $q$Graduate geologist$q$]::text[], '[{"stage":"Student","roles":"Study geology and spend vacations in field attachments","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Field or graduate geologist","years":"0 to 3 years"},{"stage":"Mid level","roles":"Project or mine geologist","years":"3 to 8 years"},{"stage":"Senior","roles":"Chief geologist or exploration manager","years":"10+ years"}]'::jsonb, array[$q$BSc Geology or Earth Sciences, MSc for specialist roles$q$]::text[], array[$q$Mathematics$q$, $q$Physics$q$, $q$Chemistry$q$, $q$Geography helps$q$]::text[], array[$q$University of Zimbabwe$q$, $q$Bindura University of Science Education$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$]::text[], array[$q$Geological Society of Zimbabwe$q$]::text[], array[$q$Geological Mapping$q$, $q$Data Analysis$q$, $q$Report Writing$q$, $q$Surveying$q$, $q$Safety Management$q$]::text[], array[$q$GIS software$q$, $q$Excel$q$, $q$Mapping equipment$q$]::text[], $q$Join field trips, learn GIS and seek attachments with exploration or mining companies.$q$, '{"entry":[450,1000],"mid":[1000,2500],"senior":[2500,6000]}'::jsonb, array[$q$geolog$q$, $q$exploration$q$, $q$mining$q$, $q$mapping$q$]::text[], 24),
($q$agronomist$q$, $q$agriculture$q$, $q$Agronomist$q$, $q$Helps farmers grow more crops, sustainably.$q$, $q$You advise on soils, seeds, fertilisers, pests and irrigation, run field trials and train farmers.$q$, array[$q$Agronomy attachee$q$, $q$Field officer$q$, $q$Graduate agronomist$q$]::text[], '[{"stage":"Student","roles":"Study agriculture and attach on farms and research stations","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Field officer or graduate agronomist","years":"0 to 3 years"},{"stage":"Mid level","roles":"Agronomist or research officer","years":"3 to 8 years"},{"stage":"Senior","roles":"Head of agronomy or research manager","years":"10+ years"}]'::jsonb, array[$q$BSc Agriculture, Crop Science or Soil Science; MSc for research roles$q$]::text[], array[$q$Biology$q$, $q$Chemistry$q$, $q$Agriculture$q$, $q$Mathematics$q$]::text[], array[$q$University of Zimbabwe$q$, $q$Bindura University of Science Education$q$, $q$Great Zimbabwe University$q$, $q$Africa University$q$, $q$Chinhoyi University of Technology$q$]::text[], array[$q$agricultural professional associations$q$]::text[], array[$q$Crop Science$q$, $q$Soil Analysis$q$, $q$Irrigation$q$, $q$Data Collection$q$, $q$Report Writing$q$, $q$Communication$q$]::text[], array[$q$Excel$q$, $q$GIS$q$, $q$Soil testing kits$q$]::text[], $q$Seek attachments on commercial farms or seed companies and keep careful records of trials.$q$, '{"entry":[300,650],"mid":[650,1500],"senior":[1500,3500]}'::jsonb, array[$q$agronom$q$, $q$agricultur$q$, $q$farm$q$, $q$crop$q$, $q$seed$q$]::text[], 25),
($q$agribusiness-manager$q$, $q$agriculture$q$, $q$Agribusiness Manager$q$, $q$Runs the business side of farming and food value chains.$q$, $q$You manage production, marketing, finance and supply chains of farms and agro-processors, and connect farmers to markets.$q$, array[$q$Agribusiness attachee$q$, $q$Farm administrator$q$, $q$Graduate trainee: agribusiness$q$]::text[], '[{"stage":"Student","roles":"Study agribusiness and business skills","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Farm or agribusiness assistant","years":"0 to 3 years"},{"stage":"Mid level","roles":"Operations or marketing manager","years":"3 to 8 years"},{"stage":"Senior","roles":"General manager or director","years":"9+ years"}]'::jsonb, array[$q$BSc Agribusiness or Agricultural Economics, BCom with agriculture focus$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Agriculture or Business Studies$q$]::text[], array[$q$University of Zimbabwe$q$, $q$Bindura University of Science Education$q$, $q$Great Zimbabwe University$q$, $q$Africa University$q$]::text[], array[$q$agricultural and business associations$q$]::text[], array[$q$Agribusiness$q$, $q$Budgeting$q$, $q$Market Research$q$, $q$Excel$q$, $q$Communication$q$, $q$Logistics Planning$q$]::text[], array[$q$Excel$q$, $q$Farm management software$q$]::text[], $q$Learn gross margins and bookkeeping, and apply for attachments with agro-processors and large farms.$q$, '{"entry":[300,700],"mid":[700,1700],"senior":[1700,4000]}'::jsonb, array[$q$agribusiness$q$, $q$agricultur$q$, $q$farm$q$, $q$market$q$]::text[], 26),
($q$environmental-scientist$q$, $q$agriculture$q$, $q$Environmental Scientist$q$, $q$Protects water, land and air and helps organisations meet environmental rules.$q$, $q$You measure pollution, assess environmental impacts, advise on rules and help communities and companies reduce harm.$q$, array[$q$Environment attachee$q$, $q$Environmental officer$q$, $q$Graduate trainee$q$]::text[], '[{"stage":"Student","roles":"Study environmental science and gather field experience","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Environmental officer","years":"0 to 3 years"},{"stage":"Mid level","roles":"Environmental or sustainability manager","years":"3 to 8 years"},{"stage":"Senior","roles":"Head of environment or consultant","years":"10+ years"}]'::jsonb, array[$q$BSc Environmental Science or related; MSc for specialist roles$q$]::text[], array[$q$Biology$q$, $q$Chemistry$q$, $q$Geography$q$, $q$Mathematics$q$]::text[], array[$q$University of Zimbabwe$q$, $q$Bindura University of Science Education$q$, $q$National University of Science and Technology (NUST)$q$, $q$Great Zimbabwe University$q$, $q$Lupane State University$q$]::text[], array[$q$environmental professional associations$q$]::text[], array[$q$Data Collection$q$, $q$Report Writing$q$, $q$Data Analysis$q$, $q$Safety Management$q$, $q$Communication$q$]::text[], array[$q$GIS$q$, $q$Excel$q$, $q$Water testing kits$q$]::text[], $q$Volunteer on environmental projects, learn GIS and apply for attachments with mines, councils or NGOs.$q$, '{"entry":[300,650],"mid":[650,1500],"senior":[1500,3500]}'::jsonb, array[$q$environment$q$, $q$sustainab$q$, $q$water$q$, $q$waste$q$]::text[], 27),
($q$hospitality-manager$q$, $q$hospitality$q$, $q$Hospitality and Tourism Manager$q$, $q$Runs hotels, lodges, restaurants and tourism services.$q$, $q$You manage guests, staff, budgets and quality in hotels, lodges and event venues, so that visitors have a great experience.$q$, array[$q$Hospitality attachee$q$, $q$Front office or restaurant supervisor$q$, $q$Graduate trainee: hotel management$q$]::text[], '[{"stage":"Student","roles":"Study hospitality and gain practical experience","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Supervisor or trainee","years":"0 to 3 years"},{"stage":"Mid level","roles":"Department manager","years":"3 to 8 years"},{"stage":"Senior","roles":"General manager","years":"9+ years"}]'::jsonb, array[$q$Diploma or degree in Hospitality and Tourism Management$q$]::text[], array[$q$English$q$, $q$Business Studies$q$, $q$Geography or Food and Nutrition helps$q$]::text[], array[$q$Zimbabwe Open University$q$, $q$Great Zimbabwe University$q$, $q$Africa University$q$, $q$Harare and Bulawayo polytechnics$q$, $q$Chinhoyi University of Technology$q$]::text[], array[$q$Zimbabwe Tourism Authority (industry regulator)$q$]::text[], array[$q$Customer Service$q$, $q$Front Office$q$, $q$Event Planning$q$, $q$Team Leadership$q$, $q$Communication$q$, $q$Budgeting$q$]::text[], array[$q$Hotel booking systems$q$, $q$Excel$q$]::text[], $q$Work part-time or on attachment in a hotel, learn a second language and practise great customer service.$q$, '{"entry":[250,550],"mid":[550,1300],"senior":[1300,3000]}'::jsonb, array[$q$hospitality$q$, $q$hotel$q$, $q$tourism$q$, $q$front office$q$, $q$customer$q$]::text[], 28),
($q$statistician$q$, $q$technology$q$, $q$Statistician$q$, $q$Uses numbers and probability to understand the world and test ideas.$q$, $q$You design surveys and experiments, analyse data, build models and explain uncertainty to decision makers in government, health, agriculture and business.$q$, array[$q$Statistics attachee$q$, $q$Survey analyst$q$, $q$Graduate statistician$q$]::text[], '[{"stage":"Student","roles":"Study statistics and a programming tool","years":"Years 1 to 4"},{"stage":"Entry level","roles":"Junior statistician","years":"0 to 3 years"},{"stage":"Mid level","roles":"Statistician or data scientist","years":"3 to 8 years"},{"stage":"Senior","roles":"Chief statistician or head of analytics","years":"9+ years"}]'::jsonb, array[$q$BSc Statistics or Mathematics and Statistics; MSc for senior roles$q$]::text[], array[$q$Mathematics$q$, $q$English$q$, $q$Computer Studies helps$q$]::text[], array[$q$University of Zimbabwe$q$, $q$National University of Science and Technology (NUST)$q$, $q$Midlands State University$q$, $q$Bindura University of Science Education$q$]::text[], array[$q$Zimbabwe Statistical society or similar$q$]::text[], array[$q$Statistics$q$, $q$R$q$, $q$Python$q$, $q$Data Analysis$q$, $q$Excel$q$, $q$Report Writing$q$]::text[], array[$q$R$q$, $q$Python$q$, $q$SPSS$q$, $q$Excel$q$]::text[], $q$Analyse a public dataset in R or Python, write a short report and apply for roles in surveys, research or analytics.$q$, '{"entry":[350,750],"mid":[800,1800],"senior":[1800,4000]}'::jsonb, array[$q$statistic$q$, $q$survey$q$, $q$research$q$, $q$data$q$, $q$analytic$q$]::text[], 29);
