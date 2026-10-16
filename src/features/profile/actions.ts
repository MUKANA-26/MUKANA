"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import {
  candidateProfileSchema,
  companyProfileSchema,
  type CandidateProfileValues,
  type CompanyProfileValues,
} from "./schemas";

const nul = (v: string | undefined | null) => (v && v.trim() !== "" ? v.trim() : null);

export async function saveCandidateProfileAction(values: CandidateProfileValues): Promise<ActionResult> {
  const session = await requireRole("candidate");
  const parsed = candidateProfileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details" };
  const v = parsed.data;
  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: v.fullName, phone: nul(v.phone) })
    .eq("id", session.id);
  if (profileError) return { ok: false, error: "Could not save your details. Check your phone number format." };

  const isAttachee = v.candidateType === "attachee";
  const { error } = await supabase
    .from("candidate_profiles")
    .update({
      candidate_type: v.candidateType,
      city: nul(v.city),
      province: nul(v.province),
      bio: nul(v.bio),
      institution: nul(v.institution),
      skills: v.skills,
      certifications: v.certifications.map((c) => ({ name: c.name, issuer: nul(c.issuer), year: c.year ? Number(c.year) : null })),
      projects: v.projects.map((p) => ({ title: p.title, description: nul(p.description), url: nul(p.url) })),
      // attachee fields
      programme: isAttachee ? nul(v.programme) : null,
      current_level: isAttachee && v.currentLevel ? Number(v.currentLevel) : null,
      registration_number: isAttachee ? nul(v.registrationNumber) : null,
      attachment_start: isAttachee ? nul(v.attachmentStart) : null,
      attachment_end: isAttachee ? nul(v.attachmentEnd) : null,
      // trainee fields
      qualification: !isAttachee ? nul(v.qualification) : null,
      qualification_level: !isAttachee ? nul(v.qualificationLevel) : null,
      degree_class: !isAttachee ? nul(v.degreeClass) : null,
      graduation_year: !isAttachee && v.graduationYear ? Number(v.graduationYear) : null,
      availability_date: !isAttachee ? nul(v.availabilityDate) : null,
    })
    .eq("user_id", session.id);
  if (error) return { ok: false, error: "Could not save your profile. Please try again." };

  revalidatePath("/candidate", "layout");
  return { ok: true, message: "Profile saved" };
}

export async function saveCompanyProfileAction(values: CompanyProfileValues): Promise<ActionResult> {
  const session = await requireRole("employer");
  const parsed = companyProfileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details" };
  const v = parsed.data;
  const supabase = await createClient();

  const { data: company } = await supabase.from("companies").select("id").eq("owner_id", session.id).maybeSingle();
  if (!company) return { ok: false, error: "Company profile not found" };

  const { error } = await supabase
    .from("companies")
    .update({
      name: v.name,
      industry: nul(v.industry),
      location: nul(v.location),
      website: nul(v.website),
      description: nul(v.description),
    })
    .eq("id", company.id);
  if (error) return { ok: false, error: "Could not save the company details." };

  const { error: privateError } = await supabase
    .from("company_private")
    .update({
      registration_number: nul(v.registrationNumber),
      registration_details: nul(v.registrationDetails),
      rep_name: nul(v.repName),
      rep_title: nul(v.repTitle),
      rep_phone: nul(v.repPhone),
      rep_email: nul(v.repEmail),
    })
    .eq("company_id", company.id);
  if (privateError) return { ok: false, error: "Could not save the registration details." };

  revalidatePath("/employer", "layout");
  return { ok: true, message: "Company profile saved" };
}

export async function requestVerificationAction(paths: string[], note: string): Promise<ActionResult> {
  await requireRole("employer");
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 6) return { ok: false, error: "Upload 1 to 6 supporting documents." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_verification", { p_document_paths: paths, p_note: note.slice(0, 1000) || null });
  if (error) return { ok: false, error: error.message.replace(/^.*?:\s*/, "") };
  revalidatePath("/employer", "layout");
  return { ok: true, message: "Verification request sent. An admin will review it shortly." };
}
