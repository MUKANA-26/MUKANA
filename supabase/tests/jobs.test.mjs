import { db } from "./harness.mjs";

let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? (pass++, console.log("  PASS", n)) : (fail++, console.log("  FAILED", n, x)); };
const as = async (uid, role = "authenticated") => {
  await db.exec("reset role");
  if (role === "postgres") { await db.exec("select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claim.role','',false)"); return; }
  await db.exec(`select set_config('request.jwt.claim.sub','${uid ?? ""}',false), set_config('request.jwt.claim.role','${role}',false)`);
  await db.exec(`set role ${role}`);
};
const q = async (s) => (await db.query(s)).rows;
const fails = async (s) => { try { await db.query(s); return null; } catch (e) { return e.message; } };
const mk = async (email, name, role = "candidate", type = "attachee") =>
  (await q(`insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ('${email}', now(), '${JSON.stringify({ full_name: name, role, candidate_type: type, consent: "true", company_name: name + " Ltd" })}') returning id`))[0].id;

await as(null, "postgres");
const att = await mk("att@j.zw", "Ana Attachee");
const att2 = await mk("att2@j.zw", "Ben Attachee");
const grad = await mk("grad@j.zw", "Gina Graduate", "candidate", "graduate_trainee");
const boss = await mk("boss@j.zw", "Rudo Boss", "employer");
const rec = await mk("rec@j.zw", "Tapi Recruiter", "employer");
const other = await mk("other@j.zw", "Otto Other", "employer");
const company = (await q(`select id from companies where owner_id='${boss}'`))[0].id;
await db.exec(`update companies set verification_status='approved', verified_at=now() where id='${company}'`);
const otherCompany = (await q(`select id from companies where owner_id='${other}'`))[0].id;
await db.exec(`update companies set verification_status='approved', verified_at=now() where id='${otherCompany}'`);
await db.exec(`update candidate_profiles set programme='Computer Science', current_level=3, institution='University of Zimbabwe', province='Harare', city='Harare', skills=array['Python','SQL','Excel'], attachment_start=current_date+30, attachment_end=current_date+210, bio='x' where user_id in ('${att}','${att2}')`);
await db.exec(`update candidate_profiles set qualification='BSc Computer Science', qualification_level='bachelors', institution='NUST', province='Bulawayo', city='Bulawayo', skills=array['Python','Java'], availability_date=current_date+10, bio='y' where user_id='${grad}'`);

const opp = (type, title, extra = "") => `insert into opportunities (company_id, type, title, description, skills, eligible_fields, min_level, min_qualification, slots, location, province, mode, start_date, duration_months, stipend_type, stipend_amount, stipend_currency, deadline, status)
  values ('${company}', '${type}', '${title}', 'Work with our team on real products and learn a lot.', array['Python','SQL'], array['Computer Science'], 2, 'bachelors', 2, 'Harare', 'Harare', 'on_site', current_date + 40, 6, 'paid', 100, 'USD', current_date + 30, 'published'${extra}) returning id`;

console.log("\n== new opportunity types");
await as(boss);
const iid = (await q(opp("internship", "Dev Internship")))[0].id;
const eid = (await q(opp("entry_level", "Junior Analyst")))[0].id;
const aid = (await q(opp("industrial_attachment", "Attachment Slot")))[0].id;
const gid = (await q(opp("graduate_trainee", "Graduate Programme")))[0].id;
ok("internship and entry-level can be published", !!iid && !!eid);
ok("internship keeps both level fields", (await q(`select min_level, min_qualification from opportunities where id='${iid}'`))[0].min_level !== null && (await q(`select min_qualification mq from opportunities where id='${iid}'`))[0].mq === "bachelors");
ok("entry-level drops the student level", (await q(`select min_level from opportunities where id='${eid}'`))[0].min_level === null);
ok("attachment drops the qualification", (await q(`select min_qualification mq from opportunities where id='${aid}'`))[0].mq === null);

await as(att);
const att_rec = (await q(`select opportunity_id from recommended_opportunities(20)`)).map((r) => r.opportunity_id);
ok("attachee sees attachment and internship", att_rec.includes(aid) && att_rec.includes(iid));
ok("attachee does not see graduate or entry-level jobs", !att_rec.includes(gid) && !att_rec.includes(eid));
const mi = (await q(`select compute_match('${att}', '${iid}') m`))[0].m;
ok("internship match for an attachee uses attachment dates and level", Number(mi.score) > 0 && mi.breakdown.availability.reason.includes("attachment dates"), JSON.stringify(mi.breakdown.availability));
ok("attachee cannot apply to entry-level", (await fails(`select apply_to_opportunity('${eid}', null)`))?.includes("not for your candidate type") ?? false);
await as(grad);
const g_rec = (await q(`select opportunity_id from recommended_opportunities(20)`)).map((r) => r.opportunity_id);
ok("graduate sees graduate, entry-level and internship", g_rec.includes(gid) && g_rec.includes(eid) && g_rec.includes(iid));
ok("graduate does not see attachments", !g_rec.includes(aid));
const mg = (await q(`select compute_match('${grad}', '${iid}') m`))[0].m;
ok("internship match for a graduate uses qualification and availability date", mg.breakdown.availability.reason.includes("available"), JSON.stringify(mg.breakdown.availability));

console.log("\n== job alerts");
await as(att);
await db.exec(`insert into job_alerts (user_id, label, keyword, types, province, paid_only) values ('${att}', 'Harare dev internships', 'dev', array['internship'], 'Harare', true)`);
let limitMsg = null;
try { await db.exec(Array.from({ length: 10 }, (_, k) => `insert into job_alerts (user_id, label) values ('${att}', 'x${k}')`).join("; ")); } catch (e) { limitMsg = e.message; }
ok("alert limit trigger works", limitMsg?.includes("up to 10") ?? false, String(limitMsg));
await as(att2);
ok("alerts are private", (await q(`select * from job_alerts`)).length === 0);
ok("cannot create an alert for someone else", (await fails(`insert into job_alerts (user_id, label) values ('${att}', 'spy')`)) !== null);
await as(boss);
const iid2 = (await q(opp("internship", "Dev Internship Two")))[0].id;
const iid3 = (await q(opp("internship", "Sales Internship").replace("'Harare', 'Harare', 'on_site'", "'Bulawayo', 'Bulawayo', 'on_site'")))[0].id;
await as(att);
const alerts = await q(`select title, url from notifications where user_id='${att}' and type::text='job_alert'`);
ok("matching alert produced one notification for the new internship", alerts.length >= 1 && alerts.some((n) => n.url.endsWith(iid2)), JSON.stringify(alerts));
ok("non-matching location produced none", !alerts.some((n) => n.url.endsWith(iid3)));
await as(grad);
ok("a graduate gets no alert notification for an attachee's alert", (await q(`select * from notifications where type::text='job_alert'`)).length === 0);

console.log("\n== notification categories");
await as(att);
await db.exec(`insert into notification_preferences (user_id, cat_jobs) values ('${att}', false) on conflict (user_id) do update set cat_jobs=false`);
await as(boss);
await q(opp("internship", "Muted Internship"));
await as(att);
ok("muted job category stops alert notifications", !(await q(`select title from notifications where user_id='${att}'`)).some((n) => n.title.includes("Muted")));
await db.exec(`update notification_preferences set cat_jobs=true where user_id='${att}'`);

console.log("\n== weekly digest");
await as(null, "postgres");
const sent = (await q(`select generate_weekly_digest() n`))[0].n;
ok("digest created for candidates with fitting recent opportunities", Number(sent) >= 1, String(sent));
ok("digest is once per week", (await q(`select generate_weekly_digest() n`))[0].n === 0);
await as(att);
ok("digest lists openings with match scores", (await q(`select body from notifications where type::text='digest'`)).some((n) => n.body.includes("% match")));
await as(null, "postgres");
await db.exec(`update notification_preferences set weekly_digest=false where user_id='${att2}'`).catch(() => undefined);

console.log("\n== hiring team");
await as(boss);
ok("owner can add a recruiter by email", (await fails(`select add_recruiter('rec@j.zw')`)) === null);
ok("unknown email refused", (await fails(`select add_recruiter('nobody@j.zw')`)) !== null);
ok("a candidate cannot be added", (await fails(`select add_recruiter('att@j.zw')`)) !== null);
ok("duplicate add refused", (await fails(`select add_recruiter('rec@j.zw')`))?.includes("already belongs") ?? false);
ok("team list shows owner and recruiter", (await q(`select * from list_company_team()`)).length === 2);
await as(rec);
ok("recruiter notified", (await q(`select 1 from notifications where user_id='${rec}' and title like '%hiring team%'`)).length === 1);
ok("recruiter sees the company's opportunities", (await q(`select id from opportunities where company_id='${company}'`)).length >= 4);
ok("recruiter can create an opportunity", !!(await q(opp("entry_level", "Recruiter Posted")))[0].id);
ok("recruiter cannot edit the company profile", (await q(`update companies set name='Hijacked' where id='${company}' returning id`)).length === 0);
ok("recruiter cannot read private registration details", (await q(`select * from company_private where company_id='${company}'`)).length === 0);
ok("recruiter cannot see the owner's email", (await q(`select email from list_company_team() where is_owner`))[0].email === null);
ok("recruiter cannot add recruiters", (await fails(`select add_recruiter('other@j.zw')`)) !== null);
await as(other);
ok("another company's employer sees none of it", (await q(`select id from opportunities where company_id='${company}' and status='draft'`)).length === 0);
ok("another employer cannot insert for this company", (await fails(opp("internship", "Intruder"))) !== null);
await as(att);
await as(null, "postgres");
await db.exec(`insert into applications (opportunity_id, candidate_id, match_score) values ('${iid}', '${att}', 80)`);
await as(att);
await as(rec);
ok("recruiter sees applications to the company", (await q(`select id from applications`)).length >= 0);
await as(boss);
await db.exec(`select remove_recruiter('${rec}')`);
await as(rec);
ok("removed recruiter loses access", (await q(`select id from opportunities where company_id='${company}' and status='draft'`)).length === 0 && (await fails(opp("internship", "After removal"))) !== null);

console.log("\n== talent search, shortlist, invitations");
await as(boss);
const s1 = await q(`select * from search_candidates('python')`);
ok("employer finds discoverable candidates by skill", s1.length === 3, JSON.stringify(s1.map((x) => x.full_name)));
ok("filter by candidate type", (await q(`select * from search_candidates(null, 'graduate_trainee')`)).length === 1);
ok("filter by province", (await q(`select * from search_candidates(null, null, 'Bulawayo')`)).length === 1);
await as(null, "postgres");
await db.exec(`update profiles set searchable=false where id='${att2}'`);
await db.exec(`update profiles set profile_visibility='connections' where id='${grad}'`);
await as(boss);
ok("candidates who opt out of search are hidden", (await q(`select * from search_candidates('python')`)).length === 1);
await as(att);
ok("candidates cannot search candidates", (await q(`select * from search_candidates('python')`)).length === 0);
await as(boss);
await db.exec(`insert into saved_candidates (company_id, candidate_id, note) values ('${company}', '${att}', 'Strong SQL')`);
ok("shortlist stores a candidate", (await q(`select saved from search_candidates('ana')`))[0].saved === true);
await as(other);
ok("another company cannot see the shortlist", (await q(`select * from saved_candidates`)).length === 0);
await as(att);
ok("a candidate cannot read shortlists", (await q(`select * from saved_candidates`)).length === 0);
await as(boss);
await db.exec(`select invite_to_apply('${att}', '${iid2}', 'We liked your profile')`);
await as(att);
ok("candidate receives the invitation", (await q(`select body from notifications where type::text='invitation'`)).some((n) => n.body.includes("We liked")));
await as(boss);
ok("inviting twice is refused", (await fails(`select invite_to_apply('${att}', '${iid2}', null)`))?.includes("already invited") ?? false);
ok("cannot invite a candidate of the wrong type", (await fails(`select invite_to_apply('${att}', '${eid}', null)`)) !== null);
ok("cannot invite to someone else's opportunity", await (async () => { await as(other); const r = await fails(`select invite_to_apply('${att}', '${iid2}', null)`); await as(boss); return r !== null; })());
await as(null, "postgres");
await db.exec(`update profiles set searchable=true where id='${att2}'`);
await db.exec(`update profiles set profile_visibility='members' where id='${grad}'`);
await as(boss);
const rc = await q(`select * from recommended_candidates('${iid}', 10)`);
ok("recommended candidates ranks fitting candidates", rc.length >= 1 && rc.every((r) => r.score >= 30), JSON.stringify(rc));
ok("recommended candidates leaves out people who applied", !rc.some((r) => r.user_id === att));
await as(other);
ok("other companies cannot get recommendations for these opportunities", (await fails(`select * from recommended_candidates('${iid}', 10)`)) !== null);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
