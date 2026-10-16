import { db } from "./harness.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const seedPath = fileURLToPath(new URL("../seed.sql", import.meta.url));

try {
  await db.exec(readFileSync(seedPath, "utf8"));
  console.log("SEED OK");
} catch (e) {
  console.log("SEED FAIL", e.message, e.where ?? "");
  process.exit(1);
}
const q = async (s) => (await db.query(s)).rows;
console.log("admins", (await q("select count(*)::int n from profiles where role='admin'"))[0].n);
console.log("employers", (await q("select count(*)::int n from profiles where role='employer'"))[0].n);
console.log("verified companies", (await q("select count(*)::int n from companies where verification_status='approved'"))[0].n);
console.log("candidates", (await q("select count(*)::int n from profiles where role='candidate'"))[0].n);
console.log("opps", (await q("select count(*)::int n from opportunities where status='published'"))[0].n);
console.log("apps", (await q("select count(*)::int n from applications"))[0].n);
console.log("complete profiles", (await q("select count(*)::int n from candidate_profiles cp, lateral (select profile_completeness(cp.user_id) c) x where (x.c->>'complete')::boolean"))[0].n);
console.log("institutions", (await q("select count(distinct institution)::int n from candidate_profiles"))[0].n);
console.log("seed twice is a no-op:");
await db.exec(readFileSync(seedPath, "utf8"));
console.log("users still", (await q("select count(*)::int n from auth.users"))[0].n);

const tendai = (await q("select id from profiles where email='tendai.moyo@seed.mukana.test'"))[0].id;
await db.exec(`select set_config('request.jwt.claim.sub','${tendai}',false), set_config('request.jwt.claim.role','authenticated',false)`);
await db.exec("set role authenticated");
const recs = await q("select r.score, o.title from recommended_opportunities(5) r join opportunities o on o.id=r.opportunity_id");
console.log("recommended for Tendai: " + recs.map((r) => `${r.score}% ${r.title}`).join(" | "));
