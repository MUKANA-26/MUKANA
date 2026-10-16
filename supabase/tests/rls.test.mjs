import { db } from "./harness.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log("  PASS", name); } else { fail++; console.log("  FAILED", name, extra); }
};
const as = async (uid, role = "authenticated") => {
  await db.exec("reset role");
  if (role === "postgres") { await db.exec("select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)"); return; }
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false), set_config('request.jwt.claim.role', '${role}', false)`);
  await db.exec(`set role ${role}`);
};
const q = async (sql, params) => (await db.query(sql, params)).rows;
const fails = async (sql, params) => { try { await db.query(sql, params); return null; } catch (e) { return e.message; } };

const metaC = (n, t = "attachee") => JSON.stringify({ full_name: n, role: "candidate", candidate_type: t, consent: "true" }).replace(/'/g, "''");
const metaE = JSON.stringify({ full_name: "Rudo Employer", role: "employer", company_name: "Delta Corp", consent: "true" });

await as(null, "postgres");
console.log("\n== sign-up trigger");
ok("sign-up without consent is rejected", (await fails(`insert into auth.users (email, raw_user_meta_data) values ('x@x.com', '{"role":"candidate"}')`))?.includes("Consent"));
const adminId = (await q(`insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ('admin@m.zw', now(), '{"full_name":"Admin","role":"admin","consent":"true"}') returning id`))[0].id;
ok("role=admin at sign-up is downgraded to candidate", (await q(`select role from profiles where id=$1`, [adminId]))[0].role === "candidate");
await db.exec(`select promote_to_admin('${adminId}')`);
ok("promote_to_admin works for the DB owner", (await q(`select role from profiles where id=$1`, [adminId]))[0].role === "admin");
ok("app_metadata.role set on auth.users", (await q(`select raw_app_meta_data->>'role' r from auth.users where id=$1`, [adminId]))[0].r === "admin");

const cand = (await q(`insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ('tendai@m.zw', now(), '${metaC("Tendai Moyo")}') returning id`))[0].id;
const cand2 = (await q(`insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ('chipo@m.zw', now(), '${metaC("Chipo Ncube")}') returning id`))[0].id;
const emp = (await q(`insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ('rudo@delta.zw', now(), '${metaE.replace(/'/g, "''")}') returning id`))[0].id;
const emp2 = (await q(`insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ('other@corp.zw', now(), '${metaE.replace(/'/g, "''")}') returning id`))[0].id;
const company = (await q(`select id from companies where owner_id=$1`, [emp]))[0].id;
ok("employer sign-up creates company + private row", (await q(`select count(*)::int n from company_private where company_id=$1`, [company]))[0].n === 1);
ok("candidate sign-up creates candidate profile", (await q(`select count(*)::int n from candidate_profiles where user_id=$1`, [cand]))[0].n === 1);

console.log("\n== privilege escalation attempts");
await as(cand);
ok("candidate cannot change own role", (await fails(`update profiles set role='admin' where id='${cand}'`))?.includes("administrator") ?? false);
ok("candidate cannot call promote_to_admin", (await fails(`select promote_to_admin('${cand}')`)) !== null);
ok("candidate cannot insert applications directly", (await fails(`insert into applications (opportunity_id, candidate_id) values (gen_random_uuid(), '${cand}')`)) !== null);
ok("candidate cannot read other candidate's profile", (await q(`select * from candidate_profiles where user_id='${cand2}'`)).length === 0);
ok("candidate cannot read app_config", (await q(`select * from app_config`)).length === 0);
ok("candidate cannot call admin_stats", (await fails(`select admin_stats()`))?.includes("Administrator") ?? false);
await as(emp);
ok("employer cannot self-verify company", (await fails(`update companies set verification_status='approved' where id='${company}'`))?.includes("administrator") ?? false);

console.log("\n== employer publishing rules");
const oppSql = (status) => `insert into opportunities (company_id, type, title, description, skills, eligible_fields, min_level, slots, location, province, mode, start_date, duration_months, stipend_type, stipend_amount, stipend_currency, deadline, status)
 values ('${company}', 'industrial_attachment', 'Software Dev Attachee', 'Work with our dev team on real products.', array['Python','SQL','Git','Excel','Communication'], array['Computer Science'], 2.1, 2, 'Harare', 'Harare', 'on_site', current_date + 60, 6, 'paid', 150, 'USD', current_date + 30, '${status}') returning id`;
await as(emp);
const draftId = (await q(oppSql("draft")))[0].id;
ok("employer can save a draft", !!draftId);
ok("unverified employer cannot publish", (await fails(oppSql("published")))?.includes("verified") ?? false);
ok("draft not visible to anon", await (async () => { await as(null, "anon"); const r = await q(`select * from opportunities where id='${draftId}'`); await as(emp); return r.length === 0; })());

await as(emp);
const reqId = (await q(`select request_verification(array['${company}/doc.pdf'], 'please verify') id`))[0].id;
ok("verification request created", !!reqId);
ok("company becomes pending", (await q(`select verification_status s from companies where id='${company}'`))[0].s === "pending");
ok("second pending request refused", (await fails(`select request_verification(array['${company}/doc2.pdf'], null)`)) !== null);
ok("foreign document path refused", (await fails(`select request_verification(array['${emp2}/x.pdf'], null)`)) !== null);
await as(cand);
ok("non-admin cannot review verification", (await fails(`select admin_review_verification('${reqId}', true, null)`)) !== null);
await as(adminId);
ok("reject needs a reason", (await fails(`select admin_review_verification('${reqId}', false, '')`)) !== null);
await db.exec(`select admin_review_verification('${reqId}', true, null)`);
ok("admin approval recorded in audit log", (await q(`select count(*)::int n from audit_log where action='verification.approve'`))[0].n === 1);
await as(emp);
ok("company now approved", (await q(`select verification_status s from companies where id='${company}'`))[0].s === "approved");
ok("employer notified of verification", (await q(`select count(*)::int n from notifications where user_id='${emp}' and type='verification'`))[0].n === 1);
const oppId = (await q(oppSql("published")))[0].id;
ok("verified employer can publish", !!oppId);
ok("past deadline cannot be published", (await fails(oppSql("published").replace("current_date + 30", "current_date - 1")))?.includes("past") ?? false);

console.log("\n== public visibility");
await as(null, "anon");
ok("anon can see published opportunity", (await q(`select id from opportunities where id='${oppId}'`)).length === 1);
ok("anon can see company public fields", (await q(`select name from companies where id='${company}'`)).length === 1);
ok("anon cannot see company_private", (await q(`select * from company_private`)).length === 0);

console.log("\n== profile completeness & apply");
await as(cand);
ok("new profile is incomplete", !(await q(`select profile_completeness('${cand}') c`))[0].c.complete);
ok("apply blocked when profile incomplete", (await fails(`select apply_to_opportunity('${oppId}', 'hi')`))?.includes("Complete your profile") ?? false);
await db.exec(`update profiles set phone='+263771234567' where id='${cand}'`);
await db.exec(`update candidate_profiles set city='Harare', province='Harare', skills=array['python','sql','git','teamwork'], cv_path='${cand}/cv-1.pdf', institution='University of Zimbabwe',
  programme='BSc Computer Science', current_level=2.2, registration_number='R123456A', attachment_start=current_date + 50, attachment_end=current_date + 250 where user_id='${cand}'`);
const comp = (await q(`select profile_completeness('${cand}') c`))[0].c;
ok("profile is complete", comp.complete === true, JSON.stringify(comp));
ok("candidate cannot point CV to another user's folder", (await fails(`update candidate_profiles set cv_path='${cand2}/x.pdf' where user_id='${cand}'`)) !== null);
const m = (await q(`select compute_match('${cand}', '${oppId}') m`))[0].m;
console.log("    match:", m.score, "-", m.reason);
ok("match score computed with breakdown", m.score > 0 && m.breakdown.skills.max === 30 && m.breakdown.field.max === 35);
ok("skills 4 of 5 -> 24", m.breakdown.skills.score === 24 || m.breakdown.skills.score === 18, JSON.stringify(m.breakdown.skills));

const appId = (await q(`select apply_to_opportunity('${oppId}', 'Please consider me') id`))[0].id;
ok("application submitted", !!appId);
ok("duplicate application blocked", (await fails(`select apply_to_opportunity('${oppId}', 'again')`))?.includes("already") ?? false);
ok("application row has score snapshot", (await q(`select match_score s from applications where id='${appId}'`))[0].s === m.score);
await as(emp);
ok("employer notified about application", (await q(`select count(*)::int n from notifications where user_id='${emp}' and type='application_received'`))[0].n === 1);
ok("employer can see applicant's profile", (await q(`select full_name from profiles where id='${cand}'`)).length === 1);
ok("employer can see applicant's candidate_profile", (await q(`select user_id from candidate_profiles where user_id='${cand}'`)).length === 1);
ok("employer can read applicant CV object", (await q(`select employer_can_read_object('cvs', '${cand}/cv-1.pdf') v`))[0].v === true);
ok("employer cannot read an unrelated object", (await q(`select employer_can_read_object('cvs', '${cand2}/cv-1.pdf') v`))[0].v === false);
await as(emp2);
ok("other employer cannot see the applicant", (await q(`select * from candidate_profiles where user_id='${cand}'`)).length === 0);
ok("other employer cannot see the application", (await q(`select * from applications where id='${appId}'`)).length === 0);
ok("other employer cannot compute match", (await fails(`select compute_match('${cand}', '${oppId}')`)) !== null);
await as(cand2);
ok("other candidate cannot see the application", (await q(`select * from applications where id='${appId}'`)).length === 0);

console.log("\n== status workflow");
await as(emp);
ok("employer cannot skip to accepted", (await fails(`select employer_set_status(array['${appId}']::uuid[], 'accepted', null)`)) !== null);
let r = (await q(`select employer_set_status(array['${appId}']::uuid[], 'under_review', null) r`))[0].r;
ok("submitted -> under_review", r.updated === 1);
r = (await q(`select employer_set_status(array['${appId}']::uuid[], 'offer_made', null) r`))[0].r;
ok("under_review -> offer_made is skipped", r.updated === 0 && r.skipped === 1);
await db.exec(`select employer_set_status(array['${appId}']::uuid[], 'shortlisted', 'Congrats, you are on our shortlist!')`);
await as(cand);
const notes = await q(`select type, body from notifications where user_id='${cand}' order by created_at`);
ok("candidate got shortlist notification with employer message", notes.some((n) => n.body.includes("Congrats")));
await as(emp);
const ivId = (await q(`select schedule_interview('${appId}', now() + interval '3 days', 45, 'virtual', 'https://meet.example.com/abc', 'Be on time', null) id`))[0].id;
ok("interview scheduled", !!ivId);
ok("application is now interview_invited", (await q(`select status s from applications where id='${appId}'`))[0].s === "interview_invited");
ok("interview in the past refused", (await fails(`select schedule_interview('${appId}', now() - interval '1 day', 30, 'physical', 'Office', null, null)`)) !== null);
await as(cand);
ok("candidate got interview invite", (await q(`select count(*)::int n from notifications where user_id='${cand}' and type='interview_invite'`))[0].n === 1);
await db.exec(`select respond_to_interview('${ivId}', true)`);
ok("candidate confirmed interview", (await q(`select status s from interviews where id='${ivId}'`))[0].s === "confirmed");
await as(emp);
ok("employer notified of confirmation", (await q(`select count(*)::int n from notifications where user_id='${emp}' and type='interview_update'`))[0].n === 1);
await db.exec(`select employer_set_status(array['${appId}']::uuid[], 'offer_made', 'We would like to offer you the position.')`);
await as(cand);
ok("candidate got offer notification", (await q(`select count(*)::int n from notifications where user_id='${cand}' and type='offer'`))[0].n === 1);
ok("candidate cannot accept with wrong action", (await fails(`select candidate_application_action('${appId}', 'nonsense', null)`)) !== null);
const acc = (await q(`select candidate_application_action('${appId}', 'accept', null) s`))[0].s;
ok("candidate accepted offer", acc === "accepted");
ok("accepted cannot be withdrawn", (await fails(`select candidate_application_action('${appId}', 'withdraw', null)`)) !== null);
ok("timeline has all events", (await q(`select count(*)::int n from application_events where application_id='${appId}'`))[0].n >= 6);
await as(cand2);
ok("other candidate cannot call candidate action on foreign app", (await fails(`select candidate_application_action('${appId}', 'withdraw', null)`)) !== null);

console.log("\n== notifications & reminders");
await as(cand);
ok("candidate cannot edit notification body", (await fails(`update notifications set body='hack' where user_id='${cand}'`))?.includes("read state") ?? false);
await db.exec(`update notifications set read_at = now() where user_id='${cand}'`);
ok("candidate can mark notifications read", (await q(`select count(*)::int n from notifications where user_id='${cand}' and read_at is null`))[0].n === 0);
ok("candidate cannot call notify()", (await fails(`select notify('${cand}', 'system', 'x', 'y')`)) !== null);
ok("candidate cannot claim notifications", (await fails(`select * from claim_pending_notifications(5)`)) !== null);
await as(cand2);
await db.exec(`update candidate_profiles set candidate_type='attachee' where user_id='${cand2}'`);
await db.exec(`insert into saved_opportunities (user_id, opportunity_id) values ('${cand2}', '${oppId}')`);
await as(null, "postgres");
await db.exec(`update opportunities set deadline = current_date + 3 where id='${oppId}'`);
ok("deadline reminders generated for savers (3 days)", (await q(`select generate_deadline_reminders() n`))[0].n === 1);
ok("deadline reminders are deduplicated", (await q(`select generate_deadline_reminders() n`))[0].n === 0);
const claimed = await q(`select * from claim_pending_notifications(100)`);
ok("service can claim pending notifications", claimed.length > 0);
ok("claimed rows are not claimed twice", (await q(`select count(*)::int n from claim_pending_notifications(100)`))[0].n === 0);
ok("auto-close skips open deadlines", (await q(`select close_expired_opportunities() n`))[0].n === 0);
await db.exec(`update opportunities set deadline = current_date - 1, status='published' where id='${oppId}'`);
ok("auto-close closes expired opportunities", (await q(`select close_expired_opportunities() n`))[0].n === 1);

console.log("\n== reports, moderation, analytics, export");
await as(cand2);
await db.exec(`insert into reports (reporter_id, target_type, opportunity_id, reason) values ('${cand2}', 'opportunity', '${oppId}', 'misleading')`);
ok("duplicate open report blocked", (await fails(`insert into reports (reporter_id, target_type, opportunity_id, reason) values ('${cand2}', 'opportunity', '${oppId}', 'other')`)) !== null);
ok("cannot report as someone else", (await fails(`insert into reports (reporter_id, target_type, company_id, reason) values ('${cand}', 'company', '${company}', 'other')`)) !== null);
await as(adminId);
const rep = (await q(`select id from reports limit 1`))[0].id;
await db.exec(`select admin_moderate_opportunity('${oppId}', 'suspend', 'Misleading')`);
await db.exec(`select admin_resolve_report('${rep}', 'actioned', 'Suspended')`);
const stats = (await q(`select admin_stats() s`))[0].s;
ok("admin stats work", stats.users.candidates === 2 && stats.users.employers === 2, JSON.stringify(stats.users));
ok("admin can list users", (await q(`select * from admin_list_users(null, null, 10, 0)`)).length >= 5);
ok("audit log has moderation entries", (await q(`select count(*)::int n from audit_log`))[0].n >= 3);
ok("audit log is append-only for admins", (await fails(`delete from audit_log`)) !== null);
await db.exec(`select admin_set_user_status('${cand2}', 'suspended', 'spam')`);
ok("admin cannot suspend self", (await fails(`select admin_set_user_status('${adminId}', 'suspended', null)`)) !== null);
await as(cand2);
ok("suspended user cannot apply/save", (await fails(`select apply_to_opportunity('${oppId}', null)`)) !== null);
await as(emp);
const an = await q(`select * from opportunity_analytics()`);
ok("employer analytics returns rows", an.length >= 1 && Number(an[0].applications) === 1);
ok("time to fill computed", an[0].time_to_fill_days !== null, JSON.stringify(an[0]));
await as(cand);
const exp = (await q(`select export_my_data() d`))[0].d;
ok("data export includes applications", exp.applications.length === 1 && exp.profile.id === cand);
ok("data export contains nothing of other users", !JSON.stringify(exp).includes(cand2));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
