import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SessionProfile } from "@/lib/auth";
import { DEGREE_CLASSES, QUALIFICATION_LEVELS, labelOf } from "@/lib/zimbabwe";
import type { CandidateProfileRow } from "@/types/db";
import { EMPTY_CV, type CvData } from "./types";

const year = (d: string | null) => (d ? new Date(d).getFullYear().toString() : "");

/** Builds the starting CV from the candidate's profile, then lays any saved draft on top. */
export async function getCvInitial(session: SessionProfile, profile: CandidateProfileRow | null): Promise<CvData> {
  const supabase = await createClient();
  const { data: draft } = await supabase.from("cv_drafts").select("template, data").eq("user_id", session.id).maybeSingle();

  const p = profile;
  const isAttachee = p?.candidate_type === "attachee";
  const education: CvData["education"] = p?.institution
    ? [
        {
          institution: p.institution,
          qualification: isAttachee
            ? [p.programme, p.current_level != null ? `Level ${Number(p.current_level).toFixed(1)}` : ""].filter(Boolean).join(", ")
            : [p.qualification, p.degree_class ? labelOf(DEGREE_CLASSES, p.degree_class) : "", p.qualification_level ? labelOf(QUALIFICATION_LEVELS, p.qualification_level) : ""].filter(Boolean).join(", "),
          period: isAttachee ? (p.attachment_start ? `Industrial attachment ${year(p.attachment_start)}` : "In progress") : p.graduation_year ? `Graduated ${p.graduation_year}` : "",
          details: "",
        },
      ]
    : [];

  const base: CvData = {
    ...EMPTY_CV,
    fullName: session.full_name,
    email: session.email,
    phone: session.phone ?? "",
    location: [p?.city, p?.province].filter(Boolean).join(", "),
    summary: p?.bio ?? "",
    education,
    skills: p?.skills ?? [],
    coursework: p?.coursework ?? [],
    projects: (p?.projects ?? []).map((x) => ({ title: x.title, description: x.description ?? "", url: x.url ?? "" })),
    volunteer: (p?.volunteer ?? []).map((v) => ({ role: v.role, organisation: v.organisation ?? "", description: v.description ?? "" })),
    certifications: (p?.certifications ?? []).map((c) => ({ name: c.name, issuer: c.issuer ?? "", year: c.year ? String(c.year) : "" })),
    languages: ["English"],
  };

  if (draft?.data && typeof draft.data === "object") {
    return { ...base, ...(draft.data as Partial<CvData>), template: (draft.template as CvData["template"]) ?? "classic" };
  }
  return base;
}
