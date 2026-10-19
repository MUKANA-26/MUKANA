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
const meta = (n) => JSON.stringify({ full_name: n, role: "candidate", consent: "true", candidate_type: "attachee" });
const mk = async (email, name) => (await q(`insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ('${email}', now(), '${meta(name)}') returning id`))[0].id;
const post = async (body, extra = "") => (await q(`select create_post('${body.replace(/'/g, "''")}', '[]'::jsonb${extra}) id`))[0].id;

await as(null, "postgres");
const ana = await mk("ana@f.zw", "Ana Moyo");
const ben = await mk("ben@f.zw", "Ben Ncube");
const cara = await mk("cara@f.zw", "Cara Dube");

console.log("\n== hashtags");
await as(ana);
const p1 = await post("Looking for #Internships in #Harare and #harare again");
const h = (await q(`select hashtags from posts where id='${p1}'`))[0].hashtags;
ok("hashtags extracted, lower-cased, de-duplicated", h.length === 2 && h.includes("internships") && h.includes("harare"), JSON.stringify(h));
const p2 = await post("Plain post with no tags and a#notatag");
ok("no hashtags when there are none", (await q(`select hashtags from posts where id='${p2}'`))[0].hashtags.length === 0);

console.log("\n== editing");
await db.exec(`select edit_post('${p2}', 'Edited with #newtag')`);
const e = (await q(`select body, edited_at, hashtags from posts where id='${p2}'`))[0];
ok("edit changes the text and stamps edited_at", e.body === "Edited with #newtag" && !!e.edited_at);
ok("edit refreshes hashtags", e.hashtags.includes("newtag"));
await as(ben);
ok("others cannot edit my post", (await fails(`select edit_post('${p2}', 'hacked')`)) !== null);
ok("cannot edit a post by direct update", (await q(`update posts set body='hacked' where id='${p2}' returning id`)).length === 0);
await as(ana);
ok("cannot blank a text-only post", (await fails(`select edit_post('${p2}', '   ')`)) !== null);

console.log("\n== bookmarks");
await as(ben);
await db.exec(`insert into post_bookmarks (user_id, post_id) values ('${ben}', '${p1}')`);
ok("saved posts appear in the saved feed", (await q(`select * from home_feed('saved', 0, 10)`)).map((r) => r.id).join() === p1);
await as(ana);
ok("bookmarks are private", (await q(`select * from post_bookmarks`)).length === 0);
ok("cannot bookmark for someone else", (await fails(`insert into post_bookmarks (user_id, post_id) values ('${ben}', '${p2}')`)) !== null);

console.log("\n== reposts");
await as(ben);
const r1 = await post("Worth a look", `, '${p1}'`);
ok("repost created pointing at the original", (await q(`select repost_of from posts where id='${r1}'`))[0].repost_of === p1);
const r2 = await post("Repost of a repost", `, '${r1}'`);
ok("repost of a repost points at the original", (await q(`select repost_of from posts where id='${r2}'`))[0].repost_of === p1);
await as(ana);
ok("author told about the repost", (await q(`select 1 from notifications where user_id='${ana}' and title like '%reposted your post%'`)).length >= 1);
ok("repost without text is allowed", !!(await q(`select create_post('', '[]'::jsonb, '${p1}') id`))[0].id);
ok("empty non-repost refused", (await fails(`select create_post('', '[]'::jsonb)`)) !== null);

console.log("\n== blocking hides content");
await as(cara);
await db.exec(`insert into blocks (blocker_id, blocked_id) values ('${cara}', '${ana}')`);
ok("blocked author is missing from my feed", !(await q(`select * from home_feed('latest', 0, 30)`)).some((r) => r.id === p1));
ok("cannot repost a blocked person's post", (await fails(`select create_post('x', '[]'::jsonb, '${p1}')`)) !== null);
await db.exec(`delete from blocks where blocker_id='${cara}'`);

console.log("\n== feed modes");
await as(ben);
await db.exec(`insert into follows (follower_id, followee_id) values ('${ben}', '${ana}')`);
const fol = (await q(`select * from home_feed('following', 0, 30)`)).map((r) => r.id);
ok("'following' shows people I follow and myself", fol.includes(p1) && fol.includes(r1));
await as(cara);
ok("'following' is empty for someone who follows nobody (own posts only)", (await q(`select * from home_feed('following', 0, 30)`)).length === 0);
await db.exec(`insert into hashtag_follows (user_id, tag) values ('${cara}', 'internships')`);
const fy = (await q(`select * from home_feed('for_you', 0, 30)`)).map((r) => r.id);
ok("'for you' includes the followed topic", fy.includes(p1));
ok("topic feed returns only matching posts", (await q(`select * from home_feed('tag', 0, 30, 'harare')`)).map((r) => r.id).join() === p1);
ok("cannot follow hashtags for someone else", (await fails(`insert into hashtag_follows (user_id, tag) values ('${ana}', 'x1')`)) !== null);
ok("bad tag refused", (await fails(`insert into hashtag_follows (user_id, tag) values ('${cara}', 'Bad Tag!')`)) !== null);
const tr = await q(`select * from trending_hashtags(5)`);
ok("trending counts recent tags", tr.some((t) => t.tag === "harare" && Number(t.uses) >= 1));
await as(null, "anon");
ok("anon cannot read the feed or trending", (await fails(`select * from home_feed('latest')`)) !== null && (await fails(`select * from trending_hashtags()`)) !== null);

console.log("\n== search");
await as(cara);
ok("post search by words (trigram index in place)", (await q(`select id from posts where body ilike '%internships%'`)).length >= 1);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
