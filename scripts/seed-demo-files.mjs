// Uploads a small demo CV PDF for every seeded candidate (@seed.mukana.test) so the in-app PDF
// viewer has something to open. DEVELOPMENT / STAGING ONLY.
//
//   node --env-file=.env.local scripts/seed-demo-files.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The service role key stays on your machine.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

/** Builds a valid one-page PDF by hand (no dependencies). */
function demoPdf(name, lines) {
  const esc = (s) => s.replace(/[\\()]/g, "\\$&");
  let y = 780;
  const content = [
    "BT /F1 22 Tf 50 800 Td (" + esc(name) + ") Tj ET",
    ...lines.map((l) => {
      y -= 22;
      return `BT /F1 12 Tf 50 ${y} Td (${esc(l)}) Tj ET`;
    }),
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (pdf += String(o).padStart(10, "0") + " 00000 n \n"));
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

const { data: candidates, error } = await db
  .from("profiles")
  .select("id, full_name, email, candidate_profiles(institution, programme, qualification)")
  .like("email", "%@seed.mukana.test")
  .eq("role", "candidate");
if (error) throw error;

for (const c of candidates ?? []) {
  const cp = Array.isArray(c.candidate_profiles) ? c.candidate_profiles[0] : c.candidate_profiles;
  const bytes = demoPdf(c.full_name, [
    "Curriculum Vitae (demo document)",
    `${cp?.programme ?? cp?.qualification ?? ""}`,
    `${cp?.institution ?? ""}`,
    "",
    "This is generated sample data for testing Mukana.",
  ]);
  const path = `${c.id}/cv-demo.pdf`;
  const { error: upErr } = await db.storage.from("cvs").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  console.log(upErr ? `FAILED ${c.email}: ${upErr.message}` : `uploaded ${path}`);
}
