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
const mk = async (email, name) => (await q(`insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ('${email}', now(), '${JSON.stringify({ full_name: name, role: "candidate", consent: "true", candidate_type: "attachee" })}') returning id`))[0].id;
const page = async (args = "") => (await q(`select feed_page(${args}) p`))[0].p;
const ids = (p) => p.map((x) => x.id);

await as(null, "postgres");
const ana = await mk("ana@r.zw", "Ana Moyo");
const ben = await mk("ben@r.zw", "Ben Ncube");
const cara = await mk("cara@r.zw", "Cara Dube");
await db.exec(`update candidate_profiles set skills=array['Python','SQL','Excel'], programme='Computer Science', institution='UZ' where user_id='${ana}'`);

// 40 posts by ben and cara, a few about python
const posts = [];
for (let i = 0; i < 40; i++) {
  const author = i % 2 ? ben : cara;
  const body = i === 0 ? "Learning python this week #python" : i === 1 ? "Control post about gardening #garden" : `Post number ${i} #topic${i % 5}`;
  posts.push((await q(`insert into posts (author_id, body, created_at) values ('${author}', '${body}', now() - interval '${i} minutes') returning id`))[0].id);
}
const pyPost = posts[0], controlPost = posts[1];

console.log("\n== one-call pages");
await as(ana);
const p1 = await page(`'for_you', 0, 10, null, 1`);
ok("a page returns the requested number of posts", p1.length === 10, String(p1.length));
const first = p1[0];
ok("each post carries media, author and flags", Array.isArray(first.media) && first.author?.full_name && "likedByMe" in first && "savedByMe" in first && Array.isArray(first.hashtags));
ok("pagination continues with new posts", ids(await page(`'for_you', 10, 10, null, 1`)).every((id) => !ids(p1).includes(id)));

console.log("\n== refresh changes the feed");
const orders = new Set();
for (let s = 1; s <= 8; s++) orders.add(ids(await page(`'for_you', 0, 10, null, ${s}`)).join());
ok("different seeds give different first pages", orders.size >= 4, String(orders.size));
ok("same seed is stable (pages do not reshuffle while scrolling)", ids(await page(`'for_you', 0, 10, null, 7`)).join() === ids(await page(`'for_you', 0, 10, null, 7`)).join());

console.log("\n== posts you have seen sink");
const seen = ids(await page(`'for_you', 0, 10, null, 3`));
await db.exec(`select record_impressions(array[${seen.map((i) => `'${i}'::uuid`).join(",")}])`);
const after = ids(await page(`'for_you', 0, 10, null, 3`));
ok("after viewing, a refresh leads with unseen posts", after.filter((id) => seen.includes(id)).length <= 2, `${after.filter((id) => seen.includes(id)).length} repeated`);
ok("impressions are private", (await q(`select count(*)::int n from post_impressions`))[0].n === 10);
await as(ben);
ok("another member's feed is unaffected by Ana's views", (await q(`select count(*)::int n from post_impressions`))[0].n === 0);
await as(null, "postgres");
await db.exec("delete from post_impressions");

console.log("\n== interests lift matching posts");
await as(ana);
await db.exec(`insert into hashtag_follows (user_id, tag) values ('${ana}', 'python')`);
let withInterest = 0, withControl = 0;
for (let s = 1; s <= 60; s++) {
  const top = ids(await page(`'for_you', 0, 10, null, ${s}`));
  if (top.includes(pyPost)) withInterest++;
  if (top.includes(controlPost)) withControl++;
}
ok("a post matching my skills and followed tag shows up more often than a similar one", withInterest > withControl + 5, `${withInterest} vs ${withControl}`);

console.log("\n== other modes and visibility");
ok("latest is newest first", ids(await page(`'latest', 0, 5`))[0] === posts[0]);
await db.exec(`insert into follows (follower_id, followee_id) values ('${ana}', '${ben}')`);
ok("following only shows people I follow", (await page(`'following', 0, 30`)).every((x) => x.author_id === ben || x.author_id === ana));
ok("tag mode filters", (await page(`'for_you', 0, 10, 'python'`)).length === 1);
ok("search finds words", (await page(`'for_you', 0, 10, null, 0, null, null, 'gardening'`)).length === 1);
ok("author view", (await page(`'for_you', 0, 50, null, 0, '${ben}'`)).every((x) => x.author_id === ben));
ok("single post view", (await page(`'for_you', 0, 1, null, 0, null, null, null, '${pyPost}'`))[0]?.id === pyPost);
await db.exec(`insert into blocks (blocker_id, blocked_id) values ('${ana}', '${cara}')`);
ok("blocked authors never appear", (await page(`'latest', 0, 50`)).every((x) => x.author_id !== cara));
await as(null, "anon");
let anonErr = null; try { await db.query(`select feed_page()`); } catch (e) { anonErr = e.message; }
ok("visitors cannot call it", anonErr !== null);

console.log("\n== suggestions");
await as(ana);
const sug = (await q(`select feed_suggestions() s`))[0].s;
ok("suggestions return jobs and people lists", Array.isArray(sug.jobs) && Array.isArray(sug.people));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
