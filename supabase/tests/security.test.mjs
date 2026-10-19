import { db } from "./harness.mjs";

let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? (pass++, console.log("  PASS", n)) : (fail++, console.log("  FAILED", n, x)); };
const as = async (uid, aal = "aal1") => {
  await db.exec("reset role");
  if (!uid) { await db.exec("select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claims','',false)"); return; }
  await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false), set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claims','{"sub":"${uid}","aal":"${aal}"}',false)`);
  await db.exec("set role authenticated");
};
const q = async (s) => (await db.query(s)).rows;
const fails = async (s) => { try { await db.query(s); return null; } catch (e) { return e.message; } };
const mk = async (email, name) =>
  (await q(`insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ('${email}', now(), '${JSON.stringify({ full_name: name, role: "candidate", consent: "true" })}') returning id`))[0].id;

await as(null);
await db.exec("reset role");
const secure = await mk("secure@s.zw", "Secure Sam");
const plain = await mk("plain@s.zw", "Plain Pat");
await db.exec(`insert into auth.mfa_factors (user_id, status) values ('${secure}', 'verified')`);

console.log("\n== two-step verification gate");
await as(plain, "aal1");
ok("members without a factor work normally on a password-only session", (await q(`select id from profiles where id='${plain}'`)).length === 1);
ok("is_active_user stays true for them", (await q(`select is_active_user() v`))[0].v === true);

await as(secure, "aal1");
ok("a password-only session cannot read the member's own profile", (await q(`select id from profiles where id='${secure}'`)).length === 0);
ok("is_active_user is false until the second step", (await q(`select is_active_user() v`))[0].v === false);
ok("data functions refuse the session (feed)", (await fails(`select create_post('hello', '[]'::jsonb)`)) !== null);
ok("data functions refuse the session (messages)", (await q(`select * from list_conversations()`)).length === 0);
ok("writes are refused too", (await fails(`update profiles set headline='x' where id='${secure}'`)) === null && (await q(`select headline from profiles where id='${secure}'`)).length === 0);

await as(secure, "aal2");
ok("after the second step the profile is readable", (await q(`select id from profiles where id='${secure}'`)).length === 1);
ok("is_active_user is true again", (await q(`select is_active_user() v`))[0].v === true);
ok("and writes work", (await fails(`update profiles set headline='Student' where id='${secure}'`)) === null && (await q(`select headline from profiles where id='${secure}'`))[0].headline === "Student");

await as(null);
await db.exec("reset role");
await db.exec(`update auth.mfa_factors set status='unverified' where user_id='${secure}'`);
await as(secure, "aal1");
ok("an unfinished enrolment does not lock the member out", (await q(`select id from profiles where id='${secure}'`)).length === 1);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
