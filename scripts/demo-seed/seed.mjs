// Creates the demo data set on the project in .env.local:
//   30 companies (25 verified, 5 not), about 70 opportunities, 40 attachees, 30 graduates, full profiles with photos, CVs and placement
//   letters, about 150 feed posts (about 60 with photos), likes, comments, reposts, connections, chats, endorsements, applications,
//   interviews, groups, events and mentors.
// Every account uses an @demo.mukana.test email and the password in config.mjs. Remove it all with:  node scripts/demo-seed/remove.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { CACHE, DEMO_DOMAIN, DEMO_PASSWORD, ROOT, day, isoDate, log, must, pool, rng, svc } from "./config.mjs";
import * as D from "./data.mjs";
import { cvPdf, logo, photo, placementLetterPdf, portrait, registrationDocPdf } from "./assets.mjs";

const force = process.argv.includes("--force");
const R = rng();
const NOW = Date.now();
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const money = (n) => Math.round(n / 10) * 10;

async function insert(table, rows, { select = null, onConflict = null } = {}) {
  const out = [];
  for (const part of chunk(rows, 200)) {
    let q = svc.from(table).insert(part, onConflict ? { onConflict, ignoreDuplicates: true } : undefined);
    if (select) q = q.select(select);
    const data = must(await q, `insert ${table}`);
    if (select) out.push(...data);
  }
  return out;
}

async function upload(bucket, filePath, buffer, contentType) {
  const { error } = await svc.storage.from(bucket).upload(filePath, buffer, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw new Error(`upload ${bucket}/${filePath}: ${error.message}`);
  return filePath;
}

// ------------------------------------------------------------------------------------------------ guard: existing demo data
async function listDemoUsers() {
  const found = [];
  for (let page = 1; page < 20; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    found.push(...data.users.filter((u) => u.email?.endsWith(`@${DEMO_DOMAIN}`)));
    if (data.users.length < 1000) break;
  }
  return found;
}
const existing = await listDemoUsers();
if (existing.length && !force) {
  log(`Demo data already exists (${existing.length} accounts). Run  node scripts/demo-seed/remove.mjs  first, or add --force to remove it and start again.`);
  process.exit(1);
}
if (existing.length && force) {
  log("Removing the previous demo data first...");
  await import("./remove.mjs");
}

// ------------------------------------------------------------------------------------------------ people plans
const usedNames = new Set();
const portraitPool = { F: R.shuffle(Array.from({ length: 91 }, (_, i) => i)), M: R.shuffle(Array.from({ length: 91 }, (_, i) => i)) };
let phoneCounter = 100;
function person(gender) {
  for (;;) {
    const first = R.pick(gender === "F" ? D.FEMALE : D.MALE);
    const last = R.pick(D.SURNAMES);
    const key = `${first} ${last}`;
    if (usedNames.has(key)) continue;
    usedNames.add(key);
    return { first, last, name: key, gender, portraitN: portraitPool[gender].pop(), phone: `+263770${String(phoneCounter++).padStart(5, "0")}` };
  }
}
const emails = new Set();
const mkEmail = (prefix) => {
  let e = `${prefix}@${DEMO_DOMAIN}`;
  let n = 2;
  while (emails.has(e)) e = `${prefix}${n++}@${DEMO_DOMAIN}`;
  emails.add(e);
  return e;
};

const companies = D.COMPANIES.map(([name, industry, city, province, short], idx) => {
  const owner = person(idx % 3 === 0 ? "M" : R.chance(0.5) ? "F" : "M");
  return { idx, name, display: `${name} (Demo)`, industry, city, province, short, verified: idx < D.UNVERIFIED_FROM, owner, email: mkEmail(`hr.${slug(short)}`) };
});

const candidates = [];
for (let i = 0; i < 70; i++) {
  const type = i < 40 ? "attachee" : "graduate_trainee";
  const p = person(i % 2 === 0 ? "F" : "M");
  candidates.push({ i, type, ...p, email: mkEmail(`${slug(p.first)}.${slug(p.last)}`) });
}

// ------------------------------------------------------------------------------------------------ create accounts
log(`Creating ${companies.length} employer and ${candidates.length} candidate accounts...`);
const create = async (email, meta) => {
  const { data, error } = await svc.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { consent: "true", ...meta } });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
};
await pool(companies, 5, async (c) => {
  c.id = await create(c.email, { full_name: c.owner.name, role: "employer", company_name: c.display, phone: c.owner.phone });
});
await pool(candidates, 5, async (c) => {
  c.id = await create(c.email, { full_name: c.name, role: "candidate", candidate_type: c.type, phone: c.phone });
});
const compRows = must(await svc.from("companies").select("id, owner_id").in("owner_id", companies.map((c) => c.id)), "companies");
for (const c of companies) c.companyId = compRows.find((r) => r.owner_id === c.id).id;

// ------------------------------------------------------------------------------------------------ employer profiles, logos
log("Employer profiles, logos and verification documents...");
await pool(companies, 4, async (c) => {
  const avatar = await upload("avatars", `${c.id}/avatar-demo.jpg`, await portrait(c.owner.gender, c.owner.portraitN), "image/jpeg");
  const logoPath = await upload("company-logos", `${c.companyId}/logo-demo.png`, await logo(c.name, c.idx), "image/png");
  must(
    await svc
      .from("profiles")
      .update({ avatar_path: avatar, headline: `Talent Acquisition at ${c.short} (Demo)`.slice(0, 110), searchable: true, language: "en" })
      .eq("id", c.id),
    "employer profile",
  );
  const status = c.verified ? "approved" : c.idx < D.UNVERIFIED_FROM + 3 ? "pending" : "unverified";
  must(
    await svc
      .from("companies")
      .update({
        name: c.display,
        logo_path: logoPath,
        industry: c.industry,
        location: `${c.city}, Zimbabwe`,
        website: "https://example.com",
        description: `DEMO LISTING, not a real vacancy. ${D.COMPANY_BLURBS[c.industry] ?? "Employer on Mukana."}`.slice(0, 1990),
        verification_status: status,
        verified_at: c.verified ? new Date(NOW - R.int(5, 60) * day).toISOString() : null,
      })
      .eq("id", c.companyId),
    "company",
  );
  if (status === "pending") {
    const doc = await upload("verification-docs", `${c.companyId}/registration-demo.pdf`, await registrationDocPdf({ company: c.display, regNumber: `DEMO-${1000 + c.idx}/2020` }), "application/pdf");
    must(await svc.from("verification_requests").insert({ company_id: c.companyId, status: "pending", document_paths: [doc], note: "Demo verification request." }), "verification request");
  }
});

// ------------------------------------------------------------------------------------------------ candidate profiles, photos, CVs
log("Candidate profiles, photos, CVs and placement letters...");
const today = new Date(NOW);
const thisYear = today.getUTCFullYear();
for (const c of candidates) {
  c.fieldKey = R.pick(D.FIELD_KEYS);
  c.f = D.FIELDS[c.fieldKey];
  c.inst = R.pick(D.INSTITUTIONS);
  c.programme = R.pick(c.f.programmes);
  c.skills = R.sample(c.f.skills, R.int(6, 9));
  c.coursework = R.sample(c.f.coursework, R.int(3, Math.min(5, c.f.coursework.length)));
  c.projects = R.sample(c.f.projects, R.int(1, Math.min(2, c.f.projects.length)));
  c.certs = R.sample(c.f.certs, R.int(1, Math.min(2, c.f.certs.length)));
  c.city = R.chance(0.7) ? c.inst.city : R.pick(["Harare", "Bulawayo", "Gweru", "Mutare", "Masvingo", "Kwekwe"]);
  c.province = c.city === c.inst.city ? c.inst.province : { Harare: "Harare", Bulawayo: "Bulawayo", Gweru: "Midlands", Mutare: "Manicaland", Masvingo: "Masvingo", Kwekwe: "Midlands" }[c.city];
  c.openToWork = R.chance(0.75);
  if (c.type === "attachee") {
    c.level = R.pick([2.1, 2.2, 3.1, 3.2, 3.2, 4.1]);
    c.reg = `${R.pick(["N", "R", "H", "B", "L", "M"])}${R.int(1000000, 2999999)}${R.pick(["A", "B", "C", "J", "K", "M", "P", "R", "S", "T", "W"])}`;
    const start = NOW + R.int(14, 120) * day;
    c.attStart = isoDate(start);
    c.attEnd = isoDate(start + 180 * day);
  } else {
    c.gradYear = R.pick([thisYear - 1, thisYear, thisYear, thisYear + 0]);
    c.degreeClass = R.pick(D.DEGREE_CLASSES);
    c.qualLevel = R.pick(["bachelors", "bachelors", "bachelors", "honours", "masters", "diploma"]);
    c.qualification = c.programme + (c.qualLevel === "honours" ? " (Honours)" : c.qualLevel === "masters" ? " (MSc)" : "");
    c.availability = isoDate(NOW + R.int(7, 90) * day);
  }
  c.bio = `${R.pick(D.BIO_STARTS)} ${c.f.field.toLowerCase()} ${c.type === "attachee" ? "student" : "graduate"} from ${c.inst.name}. ${
    c.type === "attachee" ? `Looking for an industrial attachment placement from ${c.attStart}.` : "Looking for a graduate trainee or entry-level role to grow my career."
  } Interested in ${R.sample(c.skills, 2).join(" and ")}.`;
  c.headline = (c.type === "attachee" ? `${c.programme} student at ${c.inst.name.replace(/ \(NUST\)/, "")}` : `${c.programme} graduate · open to trainee roles`).slice(0, 118);
}

await pool(candidates, 4, async (c) => {
  const avatar = await upload("avatars", `${c.id}/avatar-demo.jpg`, await portrait(c.gender, c.portraitN), "image/jpeg");
  let cover = null;
  if (c.i % 3 === 0) cover = await upload("avatars", `${c.id}/cover-demo.jpg`, await photo(D.PHOTOS.covers[c.i % D.PHOTOS.covers.length], { width: 1600, height: 520 }), "image/jpeg");

  const cvData = {
    template: R.pick(["classic", "modern"]),
    fullName: c.name,
    headline: c.headline,
    email: c.email,
    phone: c.phone,
    location: `${c.city}, ${c.province}`,
    summary: c.bio,
    education: [
      c.type === "attachee"
        ? { institution: c.inst.name, qualification: c.programme, period: `${thisYear - Math.floor(c.level) + 1} to present`, details: `Currently at level ${c.level.toFixed(1)}. Coursework: ${c.coursework.join(", ")}.` }
        : { institution: c.inst.name, qualification: c.qualification, period: `${c.gradYear - 4} to ${c.gradYear}`, details: `Degree class: ${c.degreeClass.replace("_", " ")}. Coursework: ${c.coursework.join(", ")}.` },
    ],
    skills: c.skills,
    coursework: c.coursework,
    projects: c.projects.map(([title, description]) => ({ title, description, url: "" })),
    volunteer: R.chance(0.5) ? [{ role: "Class representative", organisation: c.inst.name, description: "Represented classmates in meetings with lecturers and organised study sessions before exams." }] : [],
    certifications: c.certs.map(([name, issuer, year]) => ({ name, issuer, year: String(year) })),
    languages: ["English", R.chance(0.6) ? "Shona" : "Ndebele"],
  };
  const cvPath = await upload("cvs", `${c.id}/cv_builder-demo.pdf`, await cvPdf(cvData), "application/pdf");
  let letterPath = null;
  if (c.type === "attachee") {
    letterPath = await upload(
      "placement-letters",
      `${c.id}/letter-demo.pdf`,
      await placementLetterPdf({ institution: c.inst.name, city: c.inst.city, studentName: c.name, regNumber: c.reg, programme: c.programme, level: c.level.toFixed(1), start: c.attStart, end: c.attEnd, signatory: `Dr ${R.pick(D.SURNAMES)}` }),
      "application/pdf",
    );
  }
  must(await svc.from("profiles").update({ avatar_path: avatar, cover_path: cover, headline: c.headline, open_to_work: c.openToWork, searchable: true, language: "en" }).eq("id", c.id), "profile");
  const cp = {
    city: c.city,
    province: c.province,
    bio: c.bio,
    skills: c.skills,
    certifications: c.certs.map(([name, issuer, year]) => ({ name, issuer, year })),
    projects: c.projects.map(([title, description]) => ({ title, description, url: "" })),
    coursework: c.coursework,
    volunteer: cvData.volunteer,
    cv_path: cvPath,
    institution: c.inst.name,
    programme: c.programme,
  };
  if (c.type === "attachee") Object.assign(cp, { current_level: c.level, registration_number: c.reg, attachment_start: c.attStart, attachment_end: c.attEnd, placement_letter_path: letterPath });
  else Object.assign(cp, { qualification: c.qualification, qualification_level: c.qualLevel, degree_class: c.degreeClass, graduation_year: c.gradYear, availability_date: c.availability });
  must(await svc.from("candidate_profiles").update(cp).eq("user_id", c.id), "candidate profile");
});

// ------------------------------------------------------------------------------------------------ opportunities
log("Opportunities...");
const oppRows = [];
for (const c of companies) {
  const pool_ = D.ROLES[c.industry] ?? D.ROLES["Manufacturing"];
  const roles = c.verified ? R.sample(pool_, R.int(2, Math.min(3, pool_.length))) : R.sample(pool_, 2);
  for (const role of roles) {
    const fieldNames = role.fields.map((k) => D.FIELDS[k].field);
    const extra = role.fields.flatMap((k) => D.FIELDS[k].skills.slice(0, 3));
    const skills = [...new Set([...role.skills, ...R.sample(extra, 2)])];
    const start = NOW + R.int(30, 120) * day;
    const deadline = Math.min(NOW + R.int(7, 45) * day, start - 3 * day);
    const placement = role.type === "industrial_attachment" || role.type === "internship";
    oppRows.push({
      company_id: c.companyId,
      type: role.type,
      title: `[Demo] ${role.title}`,
      department: R.pick(["Operations", "Technology", "Finance", "Engineering", "Human Resources", "Customer Experience"]),
      description: `DEMO LISTING, not a real vacancy.\n\nJoin ${c.short} (demo) for ${placement ? "a hands-on placement" : "a structured early-career role"} in ${c.city}. You will work with experienced colleagues on real tasks, receive regular feedback and learn how a professional team operates.\n\nThis is sample content created to test Mukana.`,
      requirements: `- Studying or graduated in ${fieldNames.join(" or ")}\n- ${role.skills.join(", ")}\n- Good communication and a willingness to learn`,
      skills,
      eligible_fields: fieldNames,
      min_level: role.minLevel && placement ? role.minLevel : null,
      min_qualification: role.qual && (role.type !== "industrial_attachment") ? role.qual : null,
      slots: R.int(1, 5),
      location: c.city,
      province: c.province,
      mode: R.chance(0.7) ? "on_site" : "hybrid",
      start_date: isoDate(start),
      duration_months: placement ? R.pick([3, 4, 6]) : 12,
      stipend_type: role.paid ? "paid" : "unpaid",
      stipend_amount: role.paid ? money(R.int(90, 450)) : null,
      stipend_currency: role.paid ? "USD" : null,
      deadline: isoDate(deadline),
      status: c.verified ? "published" : "draft",
      published_at: c.verified ? new Date(NOW - R.int(0, 20) * day).toISOString() : null,
      _company: c,
      _role: role,
    });
  }
}
const oppInsert = oppRows.map(({ _company, _role, ...row }) => row);
const oppSaved = await insert("opportunities", oppInsert, { select: "id, company_id, type, status, title" });
oppRows.forEach((o, i) => (o.id = oppSaved[i].id));
const published = oppRows.filter((o) => o.status === "published");
log(`  ${oppRows.length} opportunities (${published.length} published)`);

// ------------------------------------------------------------------------------------------------ applications
log("Applications, interviews, saved jobs and alerts...");
const fits = (cType, oType) => (cType === "attachee" ? ["industrial_attachment", "internship"] : ["graduate_trainee", "entry_level", "internship"]).includes(oType);
const STATUS_PLAN = ["submitted", "submitted", "submitted", "under_review", "under_review", "shortlisted", "shortlisted", "interview_invited", "offer_made", "unsuccessful", "accepted"];
const chains = {
  submitted: [],
  under_review: ["under_review"],
  shortlisted: ["under_review", "shortlisted"],
  interview_invited: ["under_review", "shortlisted", "interview_invited"],
  offer_made: ["under_review", "shortlisted", "interview_invited", "offer_made"],
  accepted: ["under_review", "shortlisted", "interview_invited", "offer_made", "accepted"],
  unsuccessful: ["under_review", "unsuccessful"],
};
const apps = [];
const saved = [];
for (const c of candidates) {
  const fitting = published.filter((o) => fits(c.type, o.type));
  const ranked = [...fitting].sort((a, b) => Number(b._role.fields.includes(c.fieldKey)) - Number(a._role.fields.includes(c.fieldKey)) || R.next() - 0.5);
  const count = R.pick([0, 1, 2, 2, 3, 4]);
  const picked = ranked.slice(0, count);
  for (const o of picked) apps.push({ c, o, status: R.pick(STATUS_PLAN) });
  for (const o of R.sample(fitting, R.int(0, 4))) saved.push({ user_id: c.id, opportunity_id: o.id });
}
const matches = await pool(apps, 6, async ({ c, o }) => {
  const res = await svc.rpc("match_internal", { p_candidate: c.id, p_opportunity: o.id });
  return res.error ? null : res.data;
});
const appRows = apps.map((a, i) => ({
  opportunity_id: a.o.id,
  candidate_id: a.c.id,
  status: a.status,
  cover_note: R.chance(0.6) ? `Good day. I am a ${a.c.f.field.toLowerCase()} ${a.c.type === "attachee" ? "student" : "graduate"} and I would like to be considered for this opportunity. My CV is attached to my profile. Thank you.` : null,
  match_score: matches[i]?.score ?? null,
  match_breakdown: matches[i] ?? null,
  submitted_at: new Date(NOW - R.int(1, 25) * day).toISOString(),
  status_changed_at: new Date(NOW - R.int(0, 10) * day).toISOString(),
}));
const appSaved = await insert("applications", appRows, { select: "id, opportunity_id, candidate_id" });
appSaved.forEach((r, i) => (apps[i].id = r.id));
const evRows = [];
for (const a of apps) {
  let prev = null;
  evRows.push({ application_id: a.id, from_status: null, to_status: "submitted", actor_id: a.c.id });
  prev = "submitted";
  for (const s of chains[a.status] ?? []) {
    evRows.push({ application_id: a.id, from_status: prev, to_status: s, actor_id: s === "accepted" ? a.c.id : a.o._company.id, note: s === "unsuccessful" ? "Thank you for applying. We have chosen to continue with other candidates for now." : null });
    prev = s;
  }
}
await insert("application_events", evRows);
const interviews = apps
  .filter((a) => ["interview_invited", "offer_made", "accepted"].includes(a.status))
  .map((a, i) => ({
    application_id: a.id,
    scheduled_at: new Date(NOW + (2 + i) * day + 9 * 3600_000).toISOString(),
    duration_minutes: R.pick([30, 45, 60]),
    mode: R.chance(0.5) ? "virtual" : "physical",
    location: R.chance(0.5) ? "https://meet.example.com/demo-interview" : `${a.o._company.short} head office, ${a.o._company.city}`,
    instructions: "Please bring your national ID and arrive 10 minutes early. This is a demo interview.",
    status: a.status === "interview_invited" ? R.pick(["scheduled", "confirmed"]) : "completed",
    created_by: a.o._company.id,
  }));
await insert("interviews", interviews);
await insert("saved_opportunities", saved, { onConflict: "user_id,opportunity_id" });
await insert(
  "job_alerts",
  candidates.filter((c) => c.i % 7 === 0).map((c) => ({ user_id: c.id, label: `${c.f.field} opportunities`, keyword: c.f.field.split(" ")[0], types: [], province: c.province, paid_only: R.chance(0.3) })),
);
log(`  ${apps.length} applications, ${interviews.length} interviews, ${saved.length} saved jobs`);

// ------------------------------------------------------------------------------------------------ network
log("Connections, chats, endorsements, recommendations and mentors...");
const people = [...candidates, ...companies.map((c) => ({ id: c.id, name: c.owner.name, isOwner: true, company: c }))];
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const connected = new Set();
const connRows = [];
const addConn = (a, b, status) => {
  const k = pairKey(a, b);
  if (a === b || connected.has(k)) return false;
  connected.add(k);
  connRows.push({ requester_id: a, addressee_id: b, status, created_at: new Date(NOW - R.int(1, 40) * day).toISOString(), responded_at: status === "accepted" ? new Date(NOW - R.int(0, 30) * day).toISOString() : null });
  return true;
};
for (const c of candidates) {
  const same = candidates.filter((o) => o.id !== c.id && (o.inst.name === c.inst.name || o.fieldKey === c.fieldKey));
  for (const o of R.sample(same, R.int(3, 6))) addConn(c.id, o.id, "accepted");
  for (const o of R.sample(candidates, 2)) addConn(c.id, o.id, "accepted");
  if (R.chance(0.3)) addConn(c.id, R.pick(companies).id, "accepted");
}
for (let i = 0; i < 30; i++) addConn(R.pick(candidates).id, R.pick(people).id, "pending");
await insert("connections", connRows);
const acceptedPairs = connRows.filter((r) => r.status === "accepted");

const followRows = new Map();
for (let i = 0; i < 260; i++) {
  const a = R.pick(candidates).id;
  const b = R.chance(0.5) ? R.pick(companies).id : R.pick(candidates).id;
  if (a !== b) followRows.set(`${a}|${b}`, { follower_id: a, followee_id: b });
}
await insert("follows", [...followRows.values()]);

// chats
const convPairs = R.sample(acceptedPairs, 28);
const convRows = convPairs.map((p) => ({ is_group: false, direct_key: `${[p.requester_id, p.addressee_id].sort().join(":")}`, created_by: p.requester_id }));
const convSaved = await insert("conversations", convRows, { select: "id, direct_key" });
const memberRows = [];
const msgRows = [];
convPairs.forEach((p, i) => {
  const conv = convSaved[i];
  const script = R.pick(D.MESSAGES);
  const unreadFor = R.chance(0.35) ? p.addressee_id : null;
  memberRows.push({ conversation_id: conv.id, user_id: p.requester_id, last_read_at: new Date(NOW).toISOString() });
  memberRows.push({ conversation_id: conv.id, user_id: p.addressee_id, last_read_at: unreadFor ? new Date(NOW - 5 * day).toISOString() : new Date(NOW).toISOString() });
  const base = NOW - R.int(1, 6) * day;
  script.forEach((body, k) => msgRows.push({ conversation_id: conv.id, sender_id: k % 2 === 0 ? p.requester_id : p.addressee_id, body, created_at: new Date(base + k * 3_600_000).toISOString() }));
});
await insert("conversation_members", memberRows);
await insert("messages", msgRows);
for (const [i, p] of convPairs.entries()) {
  const last = msgRows.filter((m) => m.conversation_id === convSaved[i].id).at(-1);
  await svc.from("conversations").update({ last_message_at: last.created_at }).eq("id", convSaved[i].id);
}

// endorsements and recommendations (between connected candidates)
const byId = new Map(candidates.map((c) => [c.id, c]));
const endorse = new Map();
for (const p of acceptedPairs) {
  const a = byId.get(p.requester_id);
  const b = byId.get(p.addressee_id);
  if (!a || !b) continue;
  for (const [from, to] of [[a, b], [b, a]]) {
    if (!R.chance(0.45)) continue;
    for (const skill of R.sample(to.skills, R.int(1, 2))) endorse.set(`${to.id}|${skill.toLowerCase()}|${from.id}`, { profile_id: to.id, skill, endorser_id: from.id });
  }
}
await insert("skill_endorsements", [...endorse.values()]);
const recs = new Map();
for (const p of R.sample(acceptedPairs.filter((p) => byId.has(p.requester_id) && byId.has(p.addressee_id)), 26)) recs.set(`${p.requester_id}|${p.addressee_id}`, { author_id: p.requester_id, recipient_id: p.addressee_id, body: R.pick(D.RECOMMENDATIONS), status: "visible" });
await insert("recommendations", [...recs.values()]);

// mentors
const mentors = [...R.sample(candidates.filter((c) => c.type === "graduate_trainee"), 12), ...R.sample(companies, 5).map((c) => ({ id: c.id }))];
for (const [i, m] of mentors.entries()) await svc.from("profiles").update({ mentor: true, mentor_topics: D.MENTOR_TOPICS[i % D.MENTOR_TOPICS.length] }).eq("id", m.id);
const mentees = R.sample(candidates.filter((c) => c.type === "attachee"), 8);
await insert(
  "mentorship_requests",
  mentees.map((m, i) => ({ mentee_id: m.id, mentor_id: mentors[i % mentors.length].id, message: "Hello, I would love your advice on getting started in my field.", status: i % 3 === 0 ? "accepted" : "pending", responded_at: i % 3 === 0 ? new Date(NOW - day).toISOString() : null })),
);

// profile views
const views = new Map();
for (let i = 0; i < 140; i++) {
  const viewer = R.pick(people).id;
  const viewed = R.pick(candidates).id;
  const dayStr = isoDate(NOW - R.int(0, 20) * day);
  if (viewer !== viewed) views.set(`${viewer}|${viewed}|${dayStr}`, { viewer_id: viewer, viewed_id: viewed, day: dayStr, created_at: new Date(NOW - R.int(0, 20) * day).toISOString() });
}
await insert("profile_views", [...views.values()]);

// ------------------------------------------------------------------------------------------------ feed
log("Feed posts and photos...");
const authorsCand = candidates;
const authorsComp = companies;
const postPlans = [];
for (let i = 0; i < 150; i++) {
  const comp = i % 4 === 3;
  const author = comp ? R.pick(authorsComp) : R.pick(authorsCand);
  const templates = comp ? D.POSTS_COMPANY : D.POSTS_CAND;
  const tags = (comp ? ["Hiring", "Attachment", "GraduateTrainee", "Careers", "Zimbabwe", author.city ?? "Harare"] : D.TAGS_CAND).map((t) => `#${t}`);
  let body = R.pick(templates).replace(/\{t\}/g, () => R.pick(tags));
  const withPhoto = i % 5 < 2 && i < 150;
  postPlans.push({ i, author, comp, body, withPhoto, createdAt: NOW - R.next() * 28 * day });
}
// tag a few other people
const tagTargets = R.sample(candidates, 20);
const mentionRows = [];
postPlans.forEach((p, k) => {
  if (k % 9 === 0 && !p.comp) {
    const t = tagTargets[k % tagTargets.length];
    if (t.id !== p.author.id) {
      p.body += ` Thanks to @[${t.name}](${t.id}) for the help!`;
      p.mention = t.id;
    }
  }
});
postPlans.sort((a, b) => a.createdAt - b.createdAt);
const postIns = postPlans.map((p) => ({ author_id: p.author.id, body: p.body.slice(0, 2900), created_at: new Date(p.createdAt).toISOString() }));
const postSaved = await insert("posts", postIns, { select: "id" });
postPlans.forEach((p, i) => (p.id = postSaved[i].id));

// photos
const withPhotos = postPlans.filter((p) => p.withPhoto);
const mediaRows = [];
let photoN = 0;
const categoryFor = (p) => {
  if (p.comp) return R.pick(["team", "office", "careers"]);
  const c = p.author;
  if (["civil", "elec", "mech", "mine"].includes(c.fieldKey)) return R.pick(["engineering", "study", "tech"]);
  if (["cs", "stat"].includes(c.fieldKey)) return R.pick(["tech", "study"]);
  if (c.type === "graduate_trainee" && R.chance(0.3)) return "graduation";
  return R.pick(["study", "careers", "team"]);
};
await pool(withPhotos, 4, async (p) => {
  const n = R.chance(0.25) ? 2 : 1;
  const ids = R.sample(D.PHOTOS[categoryFor(p)], n);
  for (const [pos, id] of ids.entries()) {
    const file = `${p.author.id}/post-demo-${p.i}-${pos}.jpg`;
    await upload("post-media", file, await photo(id, { width: 1600 }), "image/jpeg");
    mediaRows.push({ post_id: p.id, kind: "image", path: file, position: pos });
    photoN++;
  }
});
await insert("post_media", mediaRows);
log(`  ${postPlans.length} posts, ${withPhotos.length} with photos (${photoN} images)`);

// mentions, likes, comments, reposts
const allUsers = [...candidates.map((c) => c.id), ...companies.map((c) => c.id)];
await insert("post_mentions", postPlans.filter((p) => p.mention).map((p) => ({ post_id: p.id, user_id: p.mention })));
const likes = new Map();
const commentRows = [];
for (const p of postPlans) {
  const likers = R.sample(allUsers, R.int(0, 14));
  for (const u of likers) if (u !== p.author.id) likes.set(`${p.id}|${u}`, { post_id: p.id, user_id: u, created_at: new Date(p.createdAt + R.int(1, 900) * 60_000).toISOString() });
  for (const u of R.sample(allUsers, R.int(0, 4))) if (u !== p.author.id) commentRows.push({ post_id: p.id, author_id: u, body: R.pick(D.COMMENTS), created_at: new Date(p.createdAt + R.int(5, 1500) * 60_000).toISOString() });
}
await insert("post_likes", [...likes.values()]);
await insert("post_comments", commentRows);
// reposts
const repostSources = R.sample(postPlans.filter((p) => !p.comp), 12);
await insert(
  "posts",
  repostSources.map((p) => ({ author_id: R.pick(candidates.filter((c) => c.id !== p.author.id)).id, body: R.pick(["Worth a read.", "Sharing this for my classmates.", "Good advice, repost.", ""]), repost_of: p.id, created_at: new Date(Math.min(NOW - 3_600_000, p.createdAt + R.int(1, 3) * day)).toISOString() })),
);

// ------------------------------------------------------------------------------------------------ groups and events
log("Groups and events...");
const groupSaved = await insert(
  "groups",
  D.GROUPS.map(([name, description], i) => ({ name: `${name} (Demo)`, description, created_by: candidates[i * 7].id })),
  { select: "id, created_by" },
);
const gmRows = [];
const gPosts = [];
groupSaved.forEach((g, gi) => {
  const members = new Set([g.created_by, ...R.sample(candidates, R.int(10, 24)).map((c) => c.id)]);
  for (const u of members) gmRows.push({ group_id: g.id, user_id: u, role: u === g.created_by ? "owner" : "member" });
  const memberList = [...members];
  D.GROUP_POSTS.slice(0, R.int(3, 5)).forEach((body, k) => gPosts.push({ author_id: k === 0 ? g.created_by : R.pick(memberList), body, group_id: g.id, created_at: new Date(NOW - (6 - k) * day).toISOString() }));
});
await insert("group_members", gmRows);
await insert("posts", gPosts);

const hosts = companies.filter((c) => c.verified);
const ev = (kind, title, description, daysAhead, hour, host, extra = {}) => ({
  kind,
  title: `${title} (Demo)`,
  description,
  starts_at: new Date(new Date(NOW + daysAhead * day).setUTCHours(hour, 0, 0, 0)).toISOString(),
  ends_at: new Date(new Date(NOW + daysAhead * day).setUTCHours(hour + 2, 0, 0, 0)).toISOString(),
  host_id: host.id,
  company_id: host.companyId,
  ...extra,
});
const evSaved = await insert(
  "events",
  [
    ev("webinar", "CV writing clinic", "Learn how to write a one-page CV that gets read, with live feedback. Sample event for testing Mukana.", 6, 14, hosts[0], { online_url: "https://meet.example.com/cv-clinic" }),
    ev("webinar", "Interview preparation masterclass", "Common questions, the SAR method and how to follow up. Sample event for testing Mukana.", 12, 15, hosts[2], { online_url: "https://meet.example.com/interviews", capacity: 150 }),
    ev("event", "Graduate meet-up: Harare", "Meet other graduates and recruiters over tea. Sample event for testing Mukana.", 18, 10, hosts[1], { location: "Harare, venue to be confirmed" }),
    ev("career_fair", "Harare Careers Fair", "Meet employers offering attachments, internships and graduate programmes. Sample career fair for testing Mukana.", 25, 8, hosts[3], { location: "Harare International Conference Centre" }),
  ],
  { select: "id, kind" },
);
const fair = evSaved.find((e) => e.kind === "career_fair");
await insert("event_exhibitors", R.sample(hosts, 9).map((h) => ({ event_id: fair.id, company_id: h.companyId })), { onConflict: "event_id,company_id" });
const rsvps = new Map();
for (const e of evSaved) for (const c of R.sample(candidates, R.int(12, 30))) rsvps.set(`${e.id}|${c.id}`, { event_id: e.id, user_id: c.id });
await insert("event_rsvps", [...rsvps.values()]);

// ------------------------------------------------------------------------------------------------ outputs
const csv = ["role,name,email,company_or_institution,candidate_type"];
for (const c of companies) csv.push(`employer,"${c.owner.name}",${c.email},"${c.display}",${c.verified ? "verified" : "not verified"}`);
for (const c of candidates) csv.push(`candidate,"${c.name}",${c.email},"${c.inst.name}",${c.type}`);
writeFileSync(path.join(ROOT, "scripts/demo-seed/demo-accounts.csv"), csv.join("\n"), "utf8");
writeFileSync(
  path.join(CACHE, "manifest.json"),
  JSON.stringify({ createdAt: new Date().toISOString(), counts: { companies: companies.length, candidates: candidates.length, opportunities: oppRows.length, posts: postPlans.length, applications: apps.length } }, null, 2),
);
log("\nDone. Password for every demo account:", DEMO_PASSWORD);
log("Account list: scripts/demo-seed/demo-accounts.csv");
