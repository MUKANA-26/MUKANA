// Builds supabase/migrations/0019_career_hub.sql from the content files in supabase/content/ plus the schema below.
// Run:  node scripts/build-0019.mjs
import { writeFileSync } from "node:fs";
import { CATEGORIES, QUESTIONS } from "../supabase/content/interview-questions.mjs";
import { LESSON_CATEGORIES, LESSONS } from "../supabase/content/lessons.mjs";
import { CAREERS, FIELD_LABELS } from "../supabase/content/careers.mjs";

const lit = (s) => {
  if (s == null) return "null";
  if (String(s).includes("$q$")) throw new Error("content contains the quote tag: " + String(s).slice(0, 40));
  return `$q$${s}$q$`;
};
const arr = (a) => (a?.length ? `array[${a.map(lit).join(", ")}]::text[]` : "'{}'::text[]");
const json = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

const categoryRows = [
  ...CATEGORIES.map(([slug, label, desc], i) => `('interview', ${lit(slug)}, ${lit(label)}, ${lit(desc)}, ${i + 1})`),
  ...LESSON_CATEGORIES.map(([slug, label, desc], i) => `('lesson', ${lit(slug)}, ${lit(label)}, ${lit(desc)}, ${i + 1})`),
  ...Object.entries(FIELD_LABELS).map(([slug, label], i) => `('career', ${lit(slug)}, ${lit(label)}, null, ${i + 1})`),
];
const questionRows = QUESTIONS.map(([cat, q, a, tip, aud], i) => `(${lit(cat)}, ${lit(q)}, ${lit(a)}, ${lit(tip)}, ${lit(aud)}, ${i + 1})`);
const lessonRows = LESSONS.map((l, i) => {
  const quiz = l.quiz.map(([q, options, correct, why]) => ({ q, options, correct, why }));
  return `(${lit(l.slug)}, ${lit(l.category)}, ${lit(l.title)}, ${lit(l.summary)}, ${lit(l.level)}, ${l.minutes}, ${arr(l.skills)}, ${lit(l.body)}, ${lit(l.exercise)}, ${json(quiz)}, ${i + 1})`;
});
const careerRows = CAREERS.map((c, i) => {
  const path = c.path.map(([stage, roles, years]) => ({ stage, roles, years }));
  return `(${lit(c.slug)}, ${lit(c.field)}, ${lit(c.title)}, ${lit(c.summary)}, ${lit(c.whatYouDo)}, ${arr(c.entryRoles)}, ${json(path)}, ${arr(c.qualifications)}, ${arr(c.subjects)}, ${arr(c.institutions)}, ${arr(c.bodies)}, ${arr(c.skills)}, ${arr(c.tools)}, ${lit(c.start)}, ${json(c.pay)}, ${arr(c.keywords)}, ${i + 1})`;
});

const sql = `-- =====================================================================================
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
${categoryRows.join(",\n")};

insert into public.interview_questions (category, question, answer, tip, audience, position) values
${questionRows.join(",\n")};

insert into public.lessons (slug, category, title, summary, level, minutes, skills, body, exercise, quiz, position) values
${lessonRows.join(",\n")};

insert into public.careers (slug, field, title, summary, what_you_do, entry_roles, path, qualifications, subjects, institutions, bodies, skills, tools, how_to_start, pay, keywords, position) values
${careerRows.join(",\n")};
`;

writeFileSync("supabase/migrations/0019_career_hub.sql", sql, "utf8");
console.log("written", sql.length, "chars:", QUESTIONS.length, "questions,", LESSONS.length, "lessons,", CAREERS.length, "careers");
