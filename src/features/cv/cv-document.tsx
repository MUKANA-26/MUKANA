import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CvData } from "./types";

// Brand colours (see globals.css). Built-in Helvetica keeps the PDF small and works offline.
const NAVY = "#032552";
const BLUE = "#034B85";
const ORANGE = "#F8851B";
const GREY = "#4a5a73";

const classic = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1b2433", lineHeight: 1.4 },
  name: { fontSize: 24, fontFamily: "Helvetica-Bold", color: NAVY },
  headline: { fontSize: 12, color: BLUE, marginTop: 2 },
  contact: { fontSize: 9, color: GREY, marginTop: 6 },
  bar: { height: 3, backgroundColor: ORANGE, marginTop: 10, marginBottom: 6, width: 60 },
  h: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: NAVY, textTransform: "uppercase", letterSpacing: 1, marginTop: 14, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: "#c9d4e6" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: GREY },
  item: { marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: { backgroundColor: "#e1edf9", color: BLUE, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, marginRight: 4, marginBottom: 4, fontSize: 9 },
});

const modern = StyleSheet.create({
  page: { flexDirection: "row", fontFamily: "Helvetica", fontSize: 10, color: "#1b2433", lineHeight: 1.4 },
  side: { width: "32%", backgroundColor: NAVY, color: "#ffffff", padding: 24, paddingTop: 36 },
  main: { width: "68%", padding: 30, paddingTop: 36 },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", color: NAVY },
  headline: { fontSize: 11.5, color: BLUE, marginTop: 3 },
  sideH: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: ORANGE, textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 5 },
  sideText: { fontSize: 9, color: "#e6edf7", marginBottom: 3 },
  h: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 6, paddingLeft: 6, borderLeftWidth: 3, borderLeftColor: ORANGE },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: GREY },
  item: { marginBottom: 7 },
});

const has = (s: string | undefined) => Boolean(s && s.trim());

function Bullets({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <View>
      {text
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l, i) => (
          <Text key={i} style={muted ? { color: GREY } : undefined}>
            {l}
          </Text>
        ))}
    </View>
  );
}

function ClassicCv({ d }: { d: CvData }) {
  const s = classic;
  const contact = [d.email, d.phone, d.location].filter(has).join("  |  ");
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.name}>{d.fullName || "Your Name"}</Text>
      {has(d.headline) ? <Text style={s.headline}>{d.headline}</Text> : null}
      {contact ? <Text style={s.contact}>{contact}</Text> : null}
      <View style={s.bar} />

      {has(d.summary) ? (
        <View>
          <Text style={s.h}>Profile</Text>
          <Text>{d.summary}</Text>
        </View>
      ) : null}

      {d.education.length ? (
        <View>
          <Text style={s.h}>Education</Text>
          {d.education.map((e, i) => (
            <View key={i} style={s.item} wrap={false}>
              <View style={s.row}>
                <Text style={s.bold}>{e.institution}</Text>
                {has(e.period) ? <Text style={s.muted}>{e.period}</Text> : null}
              </View>
              {has(e.qualification) ? <Text>{e.qualification}</Text> : null}
              {has(e.details) ? <Bullets text={e.details} muted /> : null}
            </View>
          ))}
        </View>
      ) : null}

      {d.coursework.length ? (
        <View>
          <Text style={s.h}>Relevant coursework</Text>
          <Text>{d.coursework.join("  •  ")}</Text>
        </View>
      ) : null}

      {d.projects.length ? (
        <View>
          <Text style={s.h}>Projects</Text>
          {d.projects.map((p, i) => (
            <View key={i} style={s.item} wrap={false}>
              <Text style={s.bold}>{p.title}</Text>
              {has(p.description) ? <Text>{p.description}</Text> : null}
              {has(p.url) ? (
                <Link src={p.url} style={{ color: BLUE, fontSize: 9 }}>
                  {p.url}
                </Link>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {d.volunteer.length ? (
        <View>
          <Text style={s.h}>Volunteer work and activities</Text>
          {d.volunteer.map((v, i) => (
            <View key={i} style={s.item} wrap={false}>
              <Text>
                <Text style={s.bold}>{v.role}</Text>
                {has(v.organisation) ? <Text style={s.muted}>{`  ·  ${v.organisation}`}</Text> : null}
              </Text>
              {has(v.description) ? <Text>{v.description}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {d.skills.length ? (
        <View>
          <Text style={s.h}>Skills</Text>
          <View style={s.chips}>
            {d.skills.map((k) => (
              <Text key={k} style={s.chip}>
                {k}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {d.certifications.length ? (
        <View>
          <Text style={s.h}>Certifications</Text>
          {d.certifications.map((c, i) => (
            <Text key={i} style={{ marginBottom: 2 }}>
              <Text style={s.bold}>{c.name}</Text>
              {has(c.issuer) ? <Text style={s.muted}>{`  ·  ${c.issuer}`}</Text> : null}
              {has(c.year) ? <Text style={s.muted}>{`  ·  ${c.year}`}</Text> : null}
            </Text>
          ))}
        </View>
      ) : null}

      {d.languages.length ? (
        <View>
          <Text style={s.h}>Languages</Text>
          <Text>{d.languages.join("  •  ")}</Text>
        </View>
      ) : null}
    </Page>
  );
}

function ModernCv({ d }: { d: CvData }) {
  const s = modern;
  return (
    <Page size="A4" style={s.page}>
      <View style={s.side} fixed>
        <Text style={s.sideH}>Contact</Text>
        {has(d.email) ? <Text style={s.sideText}>{d.email}</Text> : null}
        {has(d.phone) ? <Text style={s.sideText}>{d.phone}</Text> : null}
        {has(d.location) ? <Text style={s.sideText}>{d.location}</Text> : null}

        {d.skills.length ? (
          <View>
            <Text style={s.sideH}>Skills</Text>
            {d.skills.map((k) => (
              <Text key={k} style={s.sideText}>
                {`•  ${k}`}
              </Text>
            ))}
          </View>
        ) : null}
        {d.languages.length ? (
          <View>
            <Text style={s.sideH}>Languages</Text>
            {d.languages.map((k) => (
              <Text key={k} style={s.sideText}>
                {k}
              </Text>
            ))}
          </View>
        ) : null}
        {d.certifications.length ? (
          <View>
            <Text style={s.sideH}>Certifications</Text>
            {d.certifications.map((c, i) => (
              <Text key={i} style={s.sideText}>
                {c.name}
                {has(c.issuer) ? `, ${c.issuer}` : ""}
                {has(c.year) ? ` (${c.year})` : ""}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={s.main}>
        <Text style={s.name}>{d.fullName || "Your Name"}</Text>
        {has(d.headline) ? <Text style={s.headline}>{d.headline}</Text> : null}

        {has(d.summary) ? (
          <View>
            <Text style={s.h}>Profile</Text>
            <Text>{d.summary}</Text>
          </View>
        ) : null}

        {d.education.length ? (
          <View>
            <Text style={s.h}>Education</Text>
            {d.education.map((e, i) => (
              <View key={i} style={s.item} wrap={false}>
                <Text style={s.bold}>{e.institution}</Text>
                <Text style={s.muted}>{[e.qualification, e.period].filter(has).join("  ·  ")}</Text>
                {has(e.details) ? <Bullets text={e.details} /> : null}
              </View>
            ))}
          </View>
        ) : null}

        {d.coursework.length ? (
          <View>
            <Text style={s.h}>Relevant coursework</Text>
            <Text>{d.coursework.join("  •  ")}</Text>
          </View>
        ) : null}

        {d.projects.length ? (
          <View>
            <Text style={s.h}>Projects</Text>
            {d.projects.map((p, i) => (
              <View key={i} style={s.item} wrap={false}>
                <Text style={s.bold}>{p.title}</Text>
                {has(p.description) ? <Text>{p.description}</Text> : null}
                {has(p.url) ? (
                  <Link src={p.url} style={{ color: BLUE, fontSize: 9 }}>
                    {p.url}
                  </Link>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {d.volunteer.length ? (
          <View>
            <Text style={s.h}>Volunteer work and activities</Text>
            {d.volunteer.map((v, i) => (
              <View key={i} style={s.item} wrap={false}>
                <Text style={s.bold}>{v.role}</Text>
                {has(v.organisation) ? <Text style={s.muted}>{v.organisation}</Text> : null}
                {has(v.description) ? <Text>{v.description}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Page>
  );
}

export function CvDocument({ data }: { data: CvData }) {
  return <Document title={`${data.fullName || "CV"} — CV`} author={data.fullName} creator="Mukana CV builder">{data.template === "modern" ? <ModernCv d={data} /> : <ClassicCv d={data} />}</Document>;
}
