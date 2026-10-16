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
