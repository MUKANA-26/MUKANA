import { db } from "./harness.mjs";

let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? (pass++, console.log("  PASS", n)) : (fail++, console.log("  FAILED", n, x)); };
const as = async (uid, role = "authenticated") => {
  await db.exec("reset role");
  if (role === "postgres") { await db.exec("select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claim.role','',false)"); return; }
  await db.exec(`select set_config('request.jwt.claim.sub','${uid ?? ""}',false), set_config('request.jwt.claim.role','${role}',false)`);
  await db.exec(`set role ${role}`);
};
const q = async (s, p) => (await db.query(s, p)).rows;
const fails = async (s, p) => { try { await db.query(s, p); return null; } catch (e) { return e.message; } };
const meta = (n, role = "candidate") => JSON.stringify({ full_name: n, role, consent: "true", candidate_type: "attachee" });
const mk = async (email, name, role = "candidate", confirmed = true) =>
  (await q(`insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ('${email}', ${confirmed ? "now()" : "null"}, '${meta(name, role)}') returning id`))[0].id;

await as(null, "postgres");
const ana = await mk("ana@f.zw", "Ana Moyo");
const ben = await mk("ben@f.zw", "Ben Ncube");
const cara = await mk("cara@f.zw", "Cara Dube");           // never participates
const emp = await mk("hr@f.zw", "Rudo Employer", "employer");
const unverified = await mk("unv@f.zw", "Una Verified", "candidate", false);
const admin = await mk("adm@f.zw", "Site Admin");
await db.exec(`select promote_to_admin('${admin}')`);
await db.exec(`update profiles set avatar_path='${ana}/avatar-1.png' where id='${ana}'`);
await db.exec(`update profiles set avatar_path='${cara}/avatar-1.png' where id='${cara}'`);
await db.exec(`update candidate_profiles set programme='BSc Computer Science', institution='University of Zimbabwe' where user_id='${ana}'`);

console.log("\n== creating posts");
await as(ana);
const p1 = (await q(`select create_post('Hello Mukana! Excited to start my attachment.') id`))[0].id;
ok("member can create a text post", !!p1);
ok("direct insert into posts is not allowed", (await fails(`insert into posts (author_id, body) values ('${ana}', 'x')`)) !== null);
ok("empty post is rejected", (await fails(`select create_post('', '[]')`))?.includes("Write something") ?? false);
await as(unverified);
ok("unverified email cannot post", (await fails(`select create_post('hi')`))?.includes("Verify") ?? false);
await as(ana);
ok("media path in another user's folder is rejected", (await fails(`select create_post('x', '[{"kind":"image","path":"${ben}/a.png"}]')`))?.includes("Invalid media file") ?? false);
const imgs = (n) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ kind: "image", path: `${ana}/img-${i}.jpg` })));
ok("5 photos rejected", (await fails(`select create_post('x', '${imgs(5)}')`))?.includes("up to 4") ?? false);
ok("video mixed with photos rejected", (await fails(`select create_post('x', '[{"kind":"video","path":"${ana}/v.mp4"},{"kind":"image","path":"${ana}/i.jpg"}]')`))?.includes("either") ?? false);
const p2 = (await q(`select create_post('Photos from my first week', '${imgs(3)}') id`))[0].id;
ok("post with 3 photos", (await q(`select count(*)::int n from post_media where post_id='${p2}'`))[0].n === 3);
const p3 = (await q(`select create_post('Demo video', '[{"kind":"video","path":"${ana}/clip.mp4"}]') id`))[0].id;
ok("post with one video", (await q(`select kind from post_media where post_id='${p3}'`))[0].kind === "video");

console.log("\n== visibility");
await as(null, "anon");
ok("visitors cannot read posts", (await fails(`select * from posts`)) !== null || (await q(`select * from posts`)).length === 0);
await as(ben);
ok("members can read posts", (await q(`select id from posts`)).length === 3);
ok("members see media rows", (await q(`select id from post_media`)).length === 4);
const people = await q(`select id, full_name, headline from feed_people`);
ok("feed_people lists participants only", people.some((p) => p.id === ana) && !people.some((p) => p.id === cara), JSON.stringify(people.map((p) => p.full_name)));
ok("feed_people has a headline for candidates", people.find((p) => p.id === ana)?.headline === "BSc Computer Science · University of Zimbabwe");
ok("feed_people exposes no email/phone", !("email" in (people[0] ?? {})) && !("phone" in (people[0] ?? {})));
ok("profiles of others stay private", (await q(`select * from profiles where id='${ana}'`)).length === 0);
ok("participant avatar visible to members", (await q(`select avatar_in_feed('${ana}/avatar-1.png') v`))[0].v === true);
ok("non-participant avatar stays hidden", (await q(`select avatar_in_feed('${cara}/avatar-1.png') v`))[0].v === false);
await as(null, "anon");
ok("feed_people is not readable by visitors", (await fails(`select * from feed_people`)) !== null);

console.log("\n== tagging and notifications");
await as(ana);
const tagged = (await q(`select create_post('Great chat with @[Ben Ncube](${ben}) and @[Nobody](00000000-0000-0000-0000-000000000000) and me @[Ana](${ana})') id`))[0].id;
await as(ben);
ok("tagged member gets a notification", (await q(`select title, url from notifications where user_id='${ben}' and type::text='feed'`)).some((n) => n.title.includes("tagged you") && n.url === `/feed/${tagged}`));
await as(null, "postgres");
ok("only real, other users are tagged", (await q(`select count(*)::int n from post_mentions where post_id='${tagged}'`))[0].n === 1);
ok("tagged person becomes visible in feed_people", (await q(`select count(*)::int n from feed_people where id='${ben}'`))[0].n === 1);

console.log("\n== likes and comments");
await as(ben);
await db.exec(`insert into post_likes (post_id, user_id) values ('${p1}', '${ben}')`);
ok("like increments counter", (await q(`select like_count from posts where id='${p1}'`))[0].like_count === 1);
ok("duplicate like blocked", (await fails(`insert into post_likes (post_id, user_id) values ('${p1}', '${ben}')`)) !== null);
ok("cannot like as someone else", (await fails(`insert into post_likes (post_id, user_id) values ('${p1}', '${ana}')`)) !== null);
await as(ana);
ok("author notified of the like", (await q(`select title from notifications where user_id='${ana}' and title like '%liked%'`)).length === 1);
await db.exec(`insert into post_likes (post_id, user_id) values ('${p1}', '${ana}')`);
ok("liking own post sends no notification", (await q(`select count(*)::int n from notifications where user_id='${ana}' and title like '%liked%'`))[0].n === 1);
await as(ben);
await db.exec(`delete from post_likes where post_id='${p1}' and user_id='${ben}'`);
ok("unlike decrements counter", (await q(`select like_count from posts where id='${p1}'`))[0].like_count === 1);
const c1 = (await q(`select add_comment('${p1}', 'Congrats Ana! cc @[Rudo Employer](${emp})') id`))[0].id;
ok("comment created and counted", (await q(`select comment_count from posts where id='${p1}'`))[0].comment_count === 1);
await as(ana);
ok("post author notified of comment", (await q(`select title from notifications where user_id='${ana}' and title like '%commented%'`)).length === 1);
await as(emp);
ok("member mentioned in a comment is notified", (await q(`select title from notifications where user_id='${emp}' and title like '%mentioned you%'`)).length === 1);
ok("empty comment rejected", (await fails(`select add_comment('${p1}', '   ')`))?.includes("Write a comment") ?? false);
await as(cara);
ok("comment authors cannot be impersonated (no direct insert)", (await fails(`insert into post_comments (post_id, author_id, body) values ('${p1}', '${ben}', 'fake')`)) !== null);
ok("cannot delete other people's comments", ((await q(`delete from post_comments where id='${c1}' returning id`)).length) === 0);
await as(ana);
await db.exec(`delete from post_comments where id='${c1}'`);
ok("post author can delete comments on their post", (await q(`select comment_count from posts where id='${p1}'`))[0].comment_count === 0);

console.log("\n== search, rate limit, suspension");
await as(ben);
const found = await q(`select * from search_people('an')`);
ok("search finds members by name", found.some((f) => f.id === ana));
ok("search excludes admins and self", !found.some((f) => f.id === admin || f.id === ben));
ok("search needs 2+ characters", (await q(`select * from search_people('a')`)).length === 0);
ok("search never returns emails", !("email" in (found[0] ?? {})));
await as(ana);
for (let i = 0; i < 16; i++) await db.exec(`select create_post('spam ${i}')`); // 4 posts exist already -> total 20
ok("21st post within an hour is rate limited", (await fails(`select create_post('one too many')`))?.includes("too fast") ?? false);
await as(null, "postgres");
await db.exec(`update profiles set status='suspended' where id='${ben}'`);
await as(ben);
ok("suspended member cannot post", (await fails(`select create_post('hi')`)) !== null);
ok("suspended member cannot read posts", (await q(`select id from posts`)).length === 0);
await as(null, "postgres");
await db.exec(`update profiles set status='active' where id='${ben}'`);

console.log("\n== reports and moderation");
await as(ben);
await db.exec(`insert into reports (reporter_id, target_type, post_id, reason) values ('${ben}', 'post', '${p2}', 'inappropriate')`);
ok("member can report a post", (await q(`select count(*)::int n from reports where post_id='${p2}'`))[0].n === 1);
ok("duplicate open report blocked", (await fails(`insert into reports (reporter_id, target_type, post_id, reason) values ('${ben}', 'post', '${p2}', 'other')`)) !== null);
ok("report with two targets rejected", (await fails(`insert into reports (reporter_id, target_type, post_id, company_id, reason) values ('${ben}', 'post', '${p3}', gen_random_uuid(), 'other')`)) !== null);
ok("non-admin cannot moderate", (await fails(`select admin_moderate_post('${p2}', 'remove', 'x')`)) !== null);
await as(admin);
await db.exec(`select admin_moderate_post('${p2}', 'remove', 'Not appropriate')`);
await as(cara);
ok("removed post disappears for others", (await q(`select id from posts where id='${p2}'`)).length === 0);
await as(ana);
ok("author still sees their removed post", (await q(`select status from posts where id='${p2}'`))[0]?.status === "removed");
ok("author is told it was removed", (await q(`select title from notifications where user_id='${ana}' and title like '%removed%'`)).length === 1);
await as(admin);
ok("moderation is audited", (await q(`select count(*)::int n from audit_log where action='post.remove'`))[0].n === 1);
await db.exec(`select admin_moderate_post('${p2}', 'restore', null)`);
ok("admin can restore a post", (await q(`select status from posts where id='${p2}'`))[0].status === "published");

console.log("\n== deleting and export");
await as(ana);
ok("author can delete own post", (await q(`delete from posts where id='${p3}' returning id`)).length === 1);
ok("cannot delete someone else's post", (await (async () => { await as(ben); return (await q(`delete from posts where id='${p1}' returning id`)).length; })()) === 0);
await as(ana);
const exp = (await q(`select export_my_data() d`))[0].d;
ok("data export includes feed content", exp.posts.length >= 3 && Array.isArray(exp.comments) && Array.isArray(exp.likes));

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
