// Live check of the career hub (migration 0019) using demo accounts. Cleans up after itself.
import { createClient } from "@supabase/supabase-js";
import { DEMO_PASSWORD, SUPABASE_URL, svc } from "./config.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./config.mjs";

const env = Object.fromEntries(readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? (pass++, console.log("  PASS", n)) : (fail++, console.log("  FAILED", n, x)); };
const count = async (t, f) => { let q = svc.from(t).select("*", { count: "exact", head: true }); if (f) q = f(q); const { count: c, error } = await q; return error ? `ERR ${error.message}` : c; };

console.log("\n== content in the live database");
ok("interview questions", (await count("interview_questions")) >= 61, String(await count("interview_questions")));
ok("lessons", (await count("lessons")) === 20);
ok("careers", (await count("careers")) === 29);
ok("categories", (await count("content_categories")) >= 24);
ok("no-experience listings", (await count("opportunities", (q) => q.eq("no_experience", true))) > 40, String(await count("opportunities", (q) => q.eq("no_experience", true))));

const anon = createClient(SUPABASE_URL, ANON);
console.log("\n== public (signed-out) access");
const dir = await anon.rpc("list_companies", { p_limit: 60 });
ok("company directory works for visitors", !dir.error && dir.data.length >= 25, dir.error?.message ?? String(dir.data?.length));
const first = dir.data?.[0];
const page = await anon.rpc("company_page_data", { p_id: first.id });
ok("company page data works for visitors", !page.error && page.data?.company?.name === first.name, page.error?.message);
ok("careers readable by visitors", ((await anon.from("careers").select("slug")).data ?? []).length === 29);
ok("interview questions readable by visitors", ((await anon.from("interview_questions").select("id")).data ?? []).length >= 61);
ok("reviews table is private", ((await anon.from("company_reviews").select("id")).data ?? []).length === 0);

console.log("\n== a demo candidate and a demo employer");
const login = async (email) => { const c = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } }); const { error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD }); if (error) throw error; return c; };
// find a candidate with an accepted application and its company
const { data: acc } = await svc.from("applications").select("candidate_id, opportunity_id, opportunities(company_id, companies(name, owner_id)), profiles!applications_candidate_id_fkey(email)").eq("status", "accepted").limit(50);
const demo = (acc ?? []).find((a) => a.profiles?.email?.endsWith("@demo.mukana.test"));
if (!demo) throw new Error("no demo accepted application found");
const companyId = demo.opportunities.company_id;
const cand = await login(demo.profiles.email);
const ownerEmail = (await svc.from("profiles").select("email").eq("id", demo.opportunities.companies.owner_id).single()).data.email;
const emp = await login(ownerEmail);

ok("candidate with an accepted placement can review", (await cand.rpc("can_review_company", { p_company: companyId })).data === true);
const other = (dir.data ?? []).find((c) => c.id !== companyId);
ok("but not a company they never dealt with", (await cand.rpc("can_review_company", { p_company: other.id })).data === false);
const w = await cand.rpc("write_company_review", { p_company: companyId, p_rating: 4, p_title: "TEST REVIEW (will be deleted)", p_pros: "x", p_cons: "y", p_advice: "z", p_relationship: "attachee", p_anonymous: true });
ok("review is written", !w.error, w.error?.message);
const list = await anon.rpc("company_reviews_list", { p_company: companyId });
ok("visitors see it anonymously", list.data?.length === 1 && list.data[0].author_name === null);
const rep = await emp.rpc("reply_to_review", { p_review: w.data, p_reply: "Thanks for the feedback" });
ok("the company owner can reply", !rep.error, rep.error?.message);
const summary = await anon.rpc("company_rating_summary", { p_company: companyId });
ok("rating summary shows it", summary.data?.count === 1 && Number(summary.data?.avg) === 4);

const qid = (await anon.from("interview_questions").select("id").limit(1)).data[0].id;
const sv = await cand.from("interview_practice").upsert({ user_id: demo.candidate_id, question_id: qid, saved: true, confidence: 2 });
ok("a candidate can save a question and rate confidence", !sv.error, sv.error?.message);
const lid = (await anon.from("lessons").select("id").limit(1)).data[0].id;
const lp = await cand.from("lesson_progress").upsert({ user_id: demo.candidate_id, lesson_id: lid, quiz_score: 100 });
ok("lesson progress is saved", !lp.error, lp.error?.message);
const cid = (await anon.from("careers").select("id").limit(1)).data[0].id;
const sc = await cand.from("saved_careers").upsert({ user_id: demo.candidate_id, career_id: cid });
ok("a career can be saved", !sc.error, sc.error?.message);
const fl = await cand.from("company_follows").upsert({ user_id: demo.candidate_id, company_id: companyId });
ok("a company can be followed", !fl.error, fl.error?.message);
const o = await emp.from("opportunities").update({ no_experience: true }).eq("company_id", companyId).select("id").limit(1);
ok("an employer can set the no-experience flag", !o.error, o.error?.message);

// clean up everything the test created
await svc.from("company_reviews").delete().eq("id", w.data);
await svc.from("interview_practice").delete().eq("user_id", demo.candidate_id);
await svc.from("lesson_progress").delete().eq("user_id", demo.candidate_id);
await svc.from("saved_careers").delete().eq("user_id", demo.candidate_id);
await svc.from("company_follows").delete().eq("user_id", demo.candidate_id);
console.log(`\nRESULT: ${pass} passed, ${fail} failed (test rows removed)`);
