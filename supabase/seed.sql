-- =====================================================================================
-- Mukana · DEMO SEED DATA  (development / staging ONLY: never run this in production)
--
--   * 1 admin, 5 verified employers, 10 candidates, 15 opportunities, a few applications
--   * Every demo account uses the password:  Mukana#Demo2026
--   * Demo emails end in @seed.mukana.test
--
-- Run it after the migrations:
--   supabase db reset                       (local: runs migrations + this file)
--   or paste into the SQL editor of a throw-away project.
-- To give the seeded candidates real demo CV files, then run:  node scripts/seed-demo-files.mjs
-- To remove everything:  delete from auth.users where email like '%@seed.mukana.test';
-- =====================================================================================

do $seed$
declare
  v_pw text := extensions.crypt('Mukana#Demo2026', extensions.gen_salt('bf'));
  v_id uuid;
  r record;
  v_company uuid;
  v_opp uuid;
  v_app uuid;
  v_cand uuid;
begin
  -- Never create demo accounts twice.
  if exists (select 1 from auth.users where email like '%@seed.mukana.test') then
    raise notice 'Seed data already present; skipping.';
    return;
  end if;

  -- ---------------------------------------------------------------- admin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'admin@seed.mukana.test', v_pw, now(),
          '{"provider":"email","providers":["email"]}', '{"full_name":"Mukana Admin","consent":"true"}', now(), now(), '', '', '', '')
  returning id into v_id;
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, 'email', jsonb_build_object('sub', v_id::text, 'email', 'admin@seed.mukana.test', 'email_verified', true), now(), now(), now());
  perform public.promote_to_admin(v_id);

  -- ---------------------------------------------------------------- employers (fictional companies), all verified
  for r in
    select * from (values
      ('hr@zambezitelecom.seed.mukana.test',  'Rudo Chikwanha',  'Zambezi Telecom',            'Telecommunications',        'Harare, Harare',            'https://zambezitelecom.example.co.zw',  'Mobile and broadband provider connecting homes and businesses across Zimbabwe.', 'CR-2011-04417', 'Rudo Chikwanha', 'Head of Talent'),
      ('talent@kopjeengineering.seed.mukana.test', 'Tafara Ndlovu', 'Kopje Engineering Works', 'Construction & Engineering', 'Bulawayo, Bulawayo',       'https://kopje-engineering.example.co.zw','Civil, mechanical and electrical engineering contractor with projects in Matabeleland.', 'CR-2004-11802', 'Tafara Ndlovu', 'Managing Director'),
      ('careers@msasaagro.seed.mukana.test',  'Chipo Mandaza',   'Msasa Agro Industries',      'Agriculture',               'Marondera, Mashonaland East','https://msasaagro.example.co.zw',        'Agro-processing and export of horticulture and grains.', 'CR-2015-20931', 'Chipo Mandaza', 'HR Manager'),
      ('people@dykemining.seed.mukana.test',  'Joseph Banda',    'Dyke Mining Services',       'Mining',                    'Kwekwe, Midlands',          'https://dykemining.example.co.zw',      'Mining support services, geology and metallurgy.', 'CR-2008-07733', 'Joseph Banda', 'People & Culture Lead'),
      ('graduates@sunrisefinancial.seed.mukana.test', 'Nokuthula Sibanda', 'Sunrise Financial Group', 'Banking & Finance', 'Harare, Harare',           'https://sunrisefinancial.example.co.zw','Retail banking, insurance and asset management.', 'CR-1999-00215', 'Nokuthula Sibanda', 'Graduate Programme Manager')
    ) as t(email, person, company, industry, location, website, descr, reg, rep, rep_title)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', r.email, v_pw, now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', r.person, 'role', 'employer', 'company_name', r.company, 'consent', 'true'), now(), now(), '', '', '', '')
    returning id into v_id;
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text, 'email', jsonb_build_object('sub', v_id::text, 'email', r.email, 'email_verified', true), now(), now(), now());

    update public.companies
       set industry = r.industry, location = r.location, website = r.website, description = r.descr,
           verification_status = 'approved', verified_at = now()
     where owner_id = v_id returning id into v_company;
    update public.company_private
       set registration_number = r.reg, registration_details = 'Registered with the Registrar of Companies',
           rep_name = r.rep, rep_title = r.rep_title, rep_email = r.email
     where company_id = v_company;
  end loop;

  -- ---------------------------------------------------------------- candidates (10, different institutions)
  for r in
    select * from (values
      ('tendai.moyo',       'Tendai Moyo',        'attachee',         'University of Zimbabwe',                                 'BSc Computer Science',            2.2, 'R214501A', 'Harare',     'Harare',         array['Python','SQL','Git','JavaScript','Teamwork']),
      ('chipo.ncube',       'Chipo Ncube',        'attachee',         'National University of Science and Technology (NUST)',   'BEng Civil Engineering',          3.1, 'N0345122B', 'Bulawayo',  'Bulawayo',       array['AutoCAD','Surveying','Excel','Project management']),
      ('farai.dube',        'Farai Dube',         'attachee',         'Midlands State University',                              'BCom Accounting',                 2.1, 'M18433321', 'Gweru',     'Midlands',       array['Excel','Bookkeeping','Pastel','Communication']),
      ('tafadzwa.mutasa',   'Tafadzwa Mutasa',    'attachee',         'Harare Institute of Technology',                         'BTech Software Engineering',      3.2, 'H210984Z', 'Harare',     'Harare',         array['Java','React','Git','Docker','SQL']),
      ('nyasha.sibanda',    'Nyasha Sibanda',     'attachee',         'Chinhoyi University of Technology',                      'BSc Agriculture',                 2.2, 'C21093745', 'Chinhoyi',  'Mashonaland West', array['Agronomy','Irrigation','Data collection','Excel']),
      ('blessing.mpofu',    'Blessing Mpofu',     'attachee',         'Bindura University of Science Education',                'BSc Environmental Science',       2.1, 'B20122907', 'Bindura',   'Mashonaland Central', array['GIS','Report writing','Excel','Field work']),
      ('tatenda.gumbo',     'Tatenda Gumbo',      'graduate_trainee', 'Great Zimbabwe University',                              'BCom Finance (Honours)',          null, null,       'Masvingo',  'Masvingo',       array['Financial analysis','Excel','Risk management','Communication']),
      ('simbarashe.chuma',  'Simbarashe Chuma',   'graduate_trainee', 'Lupane State University',                                'BSc Mining Engineering',          null, null,       'Lupane',    'Matabeleland North', array['Mine planning','AutoCAD','Safety management','Excel']),
      ('ruvimbo.zhou',      'Ruvimbo Zhou',       'graduate_trainee', 'Africa University',                                      'BSc Information Systems',         null, null,       'Mutare',    'Manicaland',     array['SQL','Power BI','Python','Business analysis','Excel']),
      ('kuda.mhlanga',      'Kudakwashe Mhlanga', 'graduate_trainee', 'Harare Polytechnic',                                     'National Diploma in Electrical Engineering', null, null, 'Harare', 'Harare',       array['Electrical installation','AutoCAD','Maintenance','Safety management'])
    ) as t(handle, name, ctype, institution, programme, lvl, regno, city, province, skills)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', r.handle || '@seed.mukana.test', v_pw, now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('full_name', r.name, 'role', 'candidate', 'candidate_type', r.ctype, 'consent', 'true'), now(), now(), '', '', '', '')
    returning id into v_id;
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text, 'email', jsonb_build_object('sub', v_id::text, 'email', r.handle || '@seed.mukana.test', 'email_verified', true), now(), now(), now());

    update public.profiles set phone = '+26377' || lpad((floor(random() * 9000000) + 1000000)::int::text, 7, '0') where id = v_id;
    if r.ctype = 'attachee' then
      update public.candidate_profiles
         set city = r.city, province = r.province, institution = r.institution, programme = r.programme,
             current_level = r.lvl, registration_number = r.regno,
             attachment_start = date_trunc('month', current_date + interval '2 months')::date,
             attachment_end   = (date_trunc('month', current_date + interval '2 months') + interval '8 months' - interval '1 day')::date,
             skills = r.skills, cv_path = v_id::text || '/cv-demo.pdf',
             bio = 'Motivated ' || r.programme || ' student looking for a hands-on industrial attachment.',
             projects = jsonb_build_array(jsonb_build_object('title', 'Final-year project proposal', 'description', 'Research and prototype for a real-world problem in my field.'))
       where user_id = v_id;
    else
      update public.candidate_profiles
         set city = r.city, province = r.province, institution = r.institution, qualification = r.programme,
             qualification_level = case when r.programme ilike '%diploma%' then 'diploma'::public.qualification_level else 'honours'::public.qualification_level end,
             degree_class = (array['upper_second','lower_second','first','upper_second'])[1 + floor(random() * 4)::int]::public.degree_class,
             graduation_year = extract(year from current_date)::int - 0,
             availability_date = current_date + 30,
             skills = r.skills, cv_path = v_id::text || '/cv-demo.pdf',
             bio = 'Recent graduate ready to start a structured graduate trainee programme.'
       where user_id = v_id;
    end if;
  end loop;

  -- ---------------------------------------------------------------- opportunities (15)
  for r in
    select * from (values
      ('hr@zambezitelecom.seed.mukana.test', 'industrial_attachment', 'Network Operations Attachee',        'Network Operations', 'Support our NOC team monitoring the mobile and broadband network, logging incidents and learning fault escalation.', array['Networking','Excel','Communication'], array['Computer Science','Information Systems','Electrical Engineering'], 2.1, null, 4, 'Harare',   'Harare',            'on_site', 75, 6, 'paid',   120, 'USD', 21),
      ('hr@zambezitelecom.seed.mukana.test', 'industrial_attachment', 'Software Development Attachee',      'Digital Products',   'Join a product squad building customer-facing mobile apps. You will pair with senior developers and ship real features.', array['JavaScript','Git','SQL'], array['Computer Science','Software Engineering'], 2.2, null, 3, 'Harare', 'Harare', 'hybrid', 75, 6, 'paid', 150, 'USD', 24),
      ('hr@zambezitelecom.seed.mukana.test', 'graduate_trainee',      'Data Analytics Graduate Trainee',    'Business Intelligence', 'A 12-month rotational programme across BI, revenue assurance and customer analytics.', array['SQL','Power BI','Python','Excel'], array['Information Systems','Computer Science','Statistics'], null, 'bachelors', 2, 'Harare', 'Harare', 'hybrid', 45, 12, 'paid', 450, 'USD', 30),
      ('talent@kopjeengineering.seed.mukana.test', 'industrial_attachment', 'Civil Engineering Attachee',   'Projects',           'Site-based attachment on road and building projects: surveying, quantity take-offs and site supervision support.', array['AutoCAD','Surveying','Excel'], array['Civil Engineering'], 3.1, null, 3, 'Bulawayo', 'Bulawayo', 'on_site', 60, 6, 'unpaid', null, null, 18),
      ('talent@kopjeengineering.seed.mukana.test', 'industrial_attachment', 'Mechanical Maintenance Attachee','Workshop',         'Learn preventive maintenance and fabrication in our workshop under a registered technician.', array['AutoCAD','Maintenance','Safety management'], array['Mechanical Engineering','Electrical Engineering'], 2.1, null, 2, 'Bulawayo', 'Bulawayo', 'on_site', 60, 4, 'paid', 80, 'USD', 26),
      ('talent@kopjeengineering.seed.mukana.test', 'graduate_trainee',      'Graduate Electrical Engineer Trainee','Electrical',     'A structured 18-month path towards professional registration, rotating through design, installation and commissioning.', array['AutoCAD','Electrical installation','Safety management'], array['Electrical Engineering'], null, 'diploma', 2, 'Bulawayo', 'Bulawayo', 'on_site', 40, 18, 'paid', 500, 'USD', 35),
      ('careers@msasaagro.seed.mukana.test', 'industrial_attachment', 'Agronomy Attachee',                  'Production',         'Hands-on exposure to horticulture production, irrigation scheduling and crop scouting.', array['Agronomy','Irrigation','Data collection'], array['Agriculture','Environmental Science'], 2.1, null, 5, 'Marondera', 'Mashonaland East', 'on_site', 70, 6, 'paid', 90, 'USD', 28),
      ('careers@msasaagro.seed.mukana.test', 'industrial_attachment', 'Agribusiness Attachee',             'Commercial',         'Support export documentation, supply chain planning and cost analysis in our commercial team.', array['Excel','Communication','Report writing'], array['Agriculture','Business Administration','Supply Chain Management'], 2.1, null, 2, 'Marondera', 'Mashonaland East', 'hybrid', 70, 6, 'unpaid', null, null, 22),
      ('careers@msasaagro.seed.mukana.test', 'graduate_trainee',      'Agricultural Extension Trainee',     'Outgrower Programme','Work with outgrower farmers on training, data collection and yield improvement.', array['Agronomy','Data collection','Communication'], array['Agriculture'], null, 'bachelors', 3, 'Marondera', 'Mashonaland East', 'on_site', 40, 12, 'paid', 380, 'USD', 32),
      ('people@dykemining.seed.mukana.test', 'industrial_attachment', 'Geology Attachee',                    'Exploration',        'Field-based exposure to core logging, sampling and geological mapping.', array['GIS','Field work','Report writing'], array['Environmental Science','Mining Engineering'], 3.1, null, 3, 'Kwekwe', 'Midlands', 'on_site', 60, 6, 'paid', 100, 'USD', 20),
      ('people@dykemining.seed.mukana.test', 'graduate_trainee',      'Mining Engineering Graduate Trainee','Operations',         'Rotate through mine planning, production and safety to prepare for a Mine Overseer career path.', array['Mine planning','AutoCAD','Safety management','Excel'], array['Mining Engineering'], null, 'bachelors', 2, 'Kwekwe', 'Midlands', 'on_site', 45, 24, 'paid', 600, 'USD', 38),
      ('people@dykemining.seed.mukana.test', 'industrial_attachment', 'Environmental Compliance Attachee',  'SHEQ',               'Assist with environmental monitoring, EMA reporting and rehabilitation planning.', array['GIS','Report writing','Excel'], array['Environmental Science','Agriculture'], 2.1, null, 2, 'Kwekwe', 'Midlands', 'on_site', 70, 4, 'unpaid', null, null, 17),
      ('graduates@sunrisefinancial.seed.mukana.test', 'graduate_trainee', 'Graduate Trainee: Retail Banking','Retail Banking', 'An 18-month programme with branch, credit and digital banking rotations leading to a permanent role.', array['Communication','Excel','Financial analysis'], array['Finance','Accounting','Economics','Business Administration'], null, 'bachelors', 6, 'Harare', 'Harare', 'on_site', 30, 18, 'paid', 520, 'USD', 40),
      ('graduates@sunrisefinancial.seed.mukana.test', 'industrial_attachment', 'Accounting & Audit Attachee','Finance',            'Assist the finance team with reconciliations, month-end close and internal audit sampling.', array['Excel','Bookkeeping','Pastel'], array['Accounting','Finance','Business Administration'], 2.1, null, 4, 'Harare', 'Harare', 'on_site', 75, 6, 'paid', 110, 'USD', 19),
      ('graduates@sunrisefinancial.seed.mukana.test', 'graduate_trainee', 'Graduate Trainee: Risk & Compliance','Risk',        'Learn enterprise risk, regulatory compliance and fraud analytics in a small expert team.', array['Risk management','Financial analysis','Excel'], array['Finance','Accounting','Law'], null, 'honours', 2, 'Harare', 'Harare', 'hybrid', 40, 12, 'paid', 560, 'USD', 36)
    ) as t(owner_email, otype, title, dept, descr, skills, fields, minlvl, minq, slots, location, province, mode, start_in, months, stype, amount, cur, deadline_in)
  loop
    select c.id into v_company from public.companies c join auth.users u on u.id = c.owner_id where u.email = r.owner_email;
    insert into public.opportunities (company_id, type, title, department, description, requirements, skills, eligible_fields, min_level, min_qualification,
                                      slots, location, province, mode, start_date, duration_months, stipend_type, stipend_amount, stipend_currency, deadline, status)
    values (v_company, r.otype::public.opportunity_type, r.title, r.dept, r.descr,
            'Currently enrolled or recently graduated in a relevant programme. Strong communication skills and a willingness to learn.',
            r.skills, r.fields, r.minlvl, r.minq::public.qualification_level, r.slots, r.location, r.province, r.mode::public.work_mode,
            current_date + r.start_in, r.months, r.stype::public.stipend_type, r.amount, r.cur::public.currency_code, current_date + r.deadline_in, 'published');
  end loop;

  -- ---------------------------------------------------------------- a few applications so dashboards are not empty
  for r in
    select * from (values
      ('tendai.moyo',     'Software Development Attachee',        'shortlisted'),
      ('tendai.moyo',     'Network Operations Attachee',          'submitted'),
      ('tafadzwa.mutasa', 'Software Development Attachee',        'under_review'),
      ('chipo.ncube',     'Civil Engineering Attachee',           'submitted'),
      ('farai.dube',      'Accounting & Audit Attachee',          'submitted'),
      ('nyasha.sibanda',  'Agronomy Attachee',                    'under_review'),
      ('ruvimbo.zhou',    'Data Analytics Graduate Trainee',      'shortlisted'),
      ('tatenda.gumbo',   'Graduate Trainee: Retail Banking',     'submitted')
    ) as t(handle, title, status)
  loop
    select id into v_cand from public.profiles where email = r.handle || '@seed.mukana.test';
    select id into v_opp from public.opportunities where title = r.title limit 1;
    insert into public.applications (opportunity_id, candidate_id, cover_note, match_score, match_breakdown, status)
    values (v_opp, v_cand, 'I am excited about this opportunity and believe my studies prepare me well.',
            (public.match_internal(v_cand, v_opp) ->> 'score')::int, public.match_internal(v_cand, v_opp), 'submitted')
    returning id into v_app;
    insert into public.application_events (application_id, from_status, to_status, actor_id) values (v_app, null, 'submitted', v_cand);
    if r.status in ('under_review', 'shortlisted') then
      update public.applications set status = 'under_review' where id = v_app;
      insert into public.application_events (application_id, from_status, to_status) values (v_app, 'submitted', 'under_review');
    end if;
    if r.status = 'shortlisted' then
      update public.applications set status = 'shortlisted' where id = v_app;
      insert into public.application_events (application_id, from_status, to_status, note)
      values (v_app, 'under_review', 'shortlisted', 'Congratulations, you have been shortlisted. We will be in touch about next steps.');
    end if;
  end loop;

  raise notice 'Mukana demo data created. Sign in with any *@seed.mukana.test account, password Mukana#Demo2026';
end
$seed$;
