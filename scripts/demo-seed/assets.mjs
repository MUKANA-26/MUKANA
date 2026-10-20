// Images and PDFs for the demo data: portraits, photos, generated logos, CVs and letters.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { CACHE, ROOT } from "./config.mjs";

async function cached(url, file, init) {
  const target = path.join(CACHE, file);
  if (existsSync(target)) return readFileSync(target);
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Download failed (${res.status}) ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(target, buf);
  return buf;
}

/** Portrait photo from randomuser.me (free to use for testing). */
export async function portrait(gender, n) {
  const dir = gender === "F" ? "women" : "men";
  return cached(`https://randomuser.me/api/portraits/${dir}/${n}.jpg`, `portrait-${dir}-${n}.jpg`);
}

/** Unsplash photo resized for the feed or as a cover. Returns a JPEG buffer. */
export async function photo(id, { width = 1600, height = null } = {}) {
  const raw = await cached(`https://images.unsplash.com/photo-${id}?w=2000&q=80`, `unsplash-${id}.jpg`);
  let img = sharp(raw).rotate();
  img = height ? img.resize(width, height, { fit: "cover" }) : img.resize({ width, withoutEnlargement: true });
  return img.jpeg({ quality: 82 }).toBuffer();
}

const PALETTE = [
  ["#034B85", "#0a6bbd"], ["#086340", "#34973A"], ["#032552", "#034B85"], ["#b45309", "#F8851B"], ["#6d28d9", "#8b5cf6"],
  ["#0f766e", "#14b8a6"], ["#be123c", "#f43f5e"], ["#1d4ed8", "#3b82f6"], ["#7c2d12", "#ea580c"], ["#334155", "#64748b"],
];

/** A clean initials logo (our own artwork, not the company's trademark). 512x512 PNG. */
export async function logo(name, index) {
  const [a, b] = PALETTE[index % PALETTE.length];
  const initials = name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter((w) => w.length > 1 || /^[A-Z]$/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="512" height="512" rx="96" fill="url(#g)"/>
    <path d="M0 400 L128 330 L256 400 L384 330 L512 400 L512 512 L0 512 Z" fill="#ffffff" fill-opacity="0.12"/>
    <text x="256" y="320" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="200" fill="#ffffff">${initials}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ---------------------------------------------------------------- PDFs
let CvDocument;
/** Uses the app's own CV template (src/features/cv/cv-document.tsx) so demo CVs look exactly like real ones. */
async function cvComponent() {
  if (CvDocument) return CvDocument;
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const src = readFileSync(path.join(ROOT, "src/features/cv/cv-document.tsx"), "utf8");
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const file = path.join(CACHE, "cv-document.mjs");
  writeFileSync(file, out);
  CvDocument = (await import(pathToFileURL(file).href + `?v=${Date.now()}`)).CvDocument;
  return CvDocument;
}

export async function cvPdf(data) {
  const Doc = await cvComponent();
  return renderToBuffer(React.createElement(Doc, { data }));
}

const h = React.createElement;
const letterStyles = StyleSheet.create({
  page: { padding: 56, fontFamily: "Helvetica", fontSize: 11, lineHeight: 1.5, color: "#1b2433" },
  head: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#032552" },
  sub: { fontSize: 9, color: "#4a5a73", marginBottom: 24 },
  p: { marginBottom: 10 },
  b: { fontFamily: "Helvetica-Bold" },
  note: { marginTop: 28, fontSize: 8.5, color: "#8a97ad" },
});

/** Placement letter from the student's institution (fictional signatory). */
export async function placementLetterPdf({ institution, city, studentName, regNumber, programme, level, start, end, signatory }) {
  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: "A4", style: letterStyles.page },
      h(Text, { style: letterStyles.head }, institution),
      h(Text, { style: letterStyles.sub }, `Office of the Dean of Students · ${city}, Zimbabwe`),
      h(Text, { style: letterStyles.p }, `Date: ${new Date().toISOString().slice(0, 10)}`),
      h(Text, { style: letterStyles.p }, "To whom it may concern,"),
      h(Text, { style: [letterStyles.p, letterStyles.b] }, "RE: REQUEST FOR INDUSTRIAL ATTACHMENT PLACEMENT"),
      h(
        Text,
        { style: letterStyles.p },
        `This letter confirms that ${studentName} (registration number ${regNumber}) is a registered student at ${institution}, studying ${programme}, currently at level ${level}.`,
      ),
      h(
        Text,
        { style: letterStyles.p },
        `As part of the programme requirements, the student must complete an industrial attachment from ${start} to ${end}. We kindly request that your organisation consider offering a placement.`,
      ),
      h(Text, { style: letterStyles.p }, "A supervisor from the department will visit the student during the placement and assess the attachment report."),
      h(Text, { style: letterStyles.p }, "Yours faithfully,"),
      h(Text, { style: letterStyles.b }, signatory),
      h(Text, null, "Industrial Attachment Coordinator"),
      h(Text, { style: letterStyles.note }, "DEMO DOCUMENT generated for testing Mukana. Not a real letter."),
    ),
  );
  return renderToBuffer(doc);
}

/** Simple company registration certificate stand-in for the verification queue. */
export async function registrationDocPdf({ company, regNumber }) {
  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: "A4", style: letterStyles.page },
      h(Text, { style: letterStyles.head }, "Certificate of Incorporation"),
      h(Text, { style: letterStyles.sub }, "Registrar of Companies, Zimbabwe"),
      h(Text, { style: letterStyles.p }, `This certifies that ${company} is registered under number ${regNumber}.`),
      h(Text, { style: letterStyles.note }, "DEMO DOCUMENT generated for testing Mukana. Not a real certificate."),
    ),
  );
  return renderToBuffer(doc);
}
