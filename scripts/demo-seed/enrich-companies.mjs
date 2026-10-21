// Adds the richer profile fields (tagline, benefits, culture, photos...) to the demo companies.
// Run AFTER supabase/RUN-ME-v2.2-career-hub.sql:  node scripts/demo-seed/enrich-companies.mjs
// Facts such as founding year and size are left empty on purpose: these are real brand names and the content is sample text only.
import { DEMO_DOMAIN, log, pool, rng, svc } from "./config.mjs";
import { PHOTOS } from "./data.mjs";
import { photo } from "./assets.mjs";

const R = rng(77);
const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
const owners = users.users.filter((u) => u.email?.endsWith(`@${DEMO_DOMAIN}`) && u.email.startsWith("hr."));
const { data: companies, error } = await svc.from("companies").select("id, name, owner_id, location, industry").in("owner_id", owners.map((o) => o.id));
if (error) throw error;

const BENEFITS = ["Allowance", "Transport", "Lunch", "Mentorship", "Training", "Certificate of attachment", "Medical aid", "Laptop provided", "Flexible hours"];
const CULTURE = [
  "Sample culture text for testing: we value safety, honesty and learning. Attachees sit with the team and get real tasks and regular feedback.",
  "Sample culture text for testing: collaborative, friendly and focused on results. Everyone is encouraged to ask questions and share ideas.",
  "Sample culture text for testing: structured on-the-job learning with a named supervisor for every trainee.",
];
const LOOKING = [
  "Sample text for testing: curious, reliable students and graduates who communicate clearly and take feedback well.",
  "Sample text for testing: people who are eager to learn, work in a team and care about quality.",
];

await pool(companies, 4, async (c, i) => {
  const photos = R.sample([...PHOTOS.team, ...PHOTOS.office], R.int(2, 3));
  const paths = [];
  for (const [k, id] of photos.entries()) {
    const path = `${c.id}/gallery-demo-${k}.jpg`;
    const { error: upErr } = await svc.storage.from("company-logos").upload(path, await photo(id, { width: 1400 }), { contentType: "image/jpeg", upsert: true });
    if (upErr) throw upErr;
    paths.push(path);
  }
  const { error: e } = await svc
    .from("companies")
    .update({
      tagline: "Demo profile: sample content for testing Mukana",
      locations: [c.location?.split(",")[0] ?? "Harare"],
      benefits: R.sample(BENEFITS, R.int(3, 6)),
      culture: R.pick(CULTURE),
      looking_for: R.pick(LOOKING),
      gallery_paths: paths,
    })
    .eq("id", c.id);
  if (e) throw e;
});
log(`Enriched ${companies.length} demo companies.`);
