"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { renderTemplate } from "./templates";

const uuid = z.string().uuid();
const dbMessage = (m: string) => m.replace(/^.*?:\s*/, "");

// ------------------------------------------------------------------ candidate
export async function applyAction(opportunityId: string, coverNote: string): Promise<ActionResult & { applicationId?: string }> {
  await requireRole("candidate");
  if (!uuid.safeParse(opportunityId).success) return { ok: false, error: "Invalid opportunity" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_to_opportunity", {
    p_opportunity: opportunityId,
    p_cover_note: coverNote.trim().slice(0, 2000) || null,
  });
  if (error) {
    const duplicate = error.code === "23505" || /already applied/i.test(error.message);
    return { ok: false, error: duplicate ? "You have already applied to this opportunity." : dbMessage(error.message) };
  }
  revalidatePath("/candidate", "layout");
  revalidatePath(`/opportunities/${opportunityId}`);
  return { ok: true, applicationId: data as string, message: "Application submitted" };
}

export async function candidateApplicationAction(
  applicationId: string,
  action: "withdraw" | "accept" | "decline",
  message?: string,
): Promise<ActionResult> {
  await requireRole("candidate");
  if (!uuid.safeParse(applicationId).success) return { ok: false, error: "Invalid application" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("candidate_application_action", {
    p_application: applicationId,
    p_action: action,
    p_message: message?.trim().slice(0, 1000) || null,
  });
  if (error) return { ok: false, error: dbMessage(error.message) };
  revalidatePath("/candidate", "layout");
  return {
    ok: true,
    message: action === "withdraw" ? "Application withdrawn" : action === "accept" ? "Offer accepted. Congratulations!" : "Offer declined",
  };
}

export async function withdrawOtherAttachmentsAction(acceptedApplicationId: string): Promise<ActionResult & { count?: number }> {
  await requireRole("candidate");
  if (!uuid.safeParse(acceptedApplicationId).success) return { ok: false, error: "Invalid application" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_other_attachment_applications", { p_accepted: acceptedApplicationId });
  if (error) return { ok: false, error: dbMessage(error.message) };
  revalidatePath("/candidate", "layout");
  return { ok: true, count: Number(data ?? 0) };
}

export async function respondToInterviewAction(interviewId: string, accept: boolean): Promise<ActionResult> {
  await requireRole("candidate");
  if (!uuid.safeParse(interviewId).success) return { ok: false, error: "Invalid interview" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_interview", { p_interview: interviewId, p_accept: accept });
  if (error) return { ok: false, error: dbMessage(error.message) };
  revalidatePath("/candidate", "layout");
  return { ok: true, message: accept ? "Interview confirmed" : "Interview declined" };
}

// ------------------------------------------------------------------ report (any signed-in user)
const reportSchema = z.object({
  targetType: z.enum(["opportunity", "company", "post", "user"]),
  targetId: uuid,
  reason: z.enum(["scam_or_fee", "misleading", "discriminatory", "inappropriate", "duplicate", "other"]),
  details: z.string().trim().max(2000).optional(),
});

export async function reportAction(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  const session = await requireUser();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a reason for your report" };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: session.id,
    target_type: v.targetType,
    opportunity_id: v.targetType === "opportunity" ? v.targetId : null,
    company_id: v.targetType === "company" ? v.targetId : null,
    post_id: v.targetType === "post" ? v.targetId : null,
    user_id: v.targetType === "user" ? v.targetId : null,
    reason: v.reason,
    details: v.details || null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You have already reported this. A moderator will review it." };
    return { ok: false, error: "Could not send your report. Please try again." };
  }
  return { ok: true, message: "Thanks. A moderator will review your report." };
}

// ------------------------------------------------------------------ employer
export async function setApplicationStatusAction(
  ids: string[],
  status: "under_review" | "shortlisted" | "offer_made" | "unsuccessful",
  messageTemplate?: string,
): Promise<ActionResult & { updated?: number; skipped?: number }> {
  const session = await requireRole("employer");
  const parsed = z.array(uuid).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Select at least one applicant" };
  const supabase = await createClient();

  // Personalise the message per applicant ({{first_name}}, {{role}}, {{company}}).
  const { data: infoRows } = await supabase
    .from("applications")
    .select("id, opportunities(title, companies(name)), profiles!applications_candidate_id_fkey(full_name)")
    .in("id", parsed.data);
  type Info = { id: string; opportunities: { title: string; companies: { name: string } | null } | null; profiles: { full_name: string } | null };
  const info = new Map(((infoRows ?? []) as unknown as Info[]).map((r) => [r.id, r]));
  const template = messageTemplate?.trim().slice(0, 4000) ?? "";
  void session;

  let updated = 0;
  let skipped = 0;
  for (const id of parsed.data) {
    const row = info.get(id);
    const message = template
      ? renderTemplate(template, {
          candidateName: row?.profiles?.full_name ?? "",
          role: row?.opportunities?.title ?? "the opportunity",
          company: row?.opportunities?.companies?.name ?? "our company",
        })
      : null;
    const { data, error } = await supabase.rpc("employer_set_status", { p_ids: [id], p_status: status, p_message: message });
    if (error) return { ok: false, error: dbMessage(error.message), updated, skipped };
    const r = data as { updated: number; skipped: number };
    updated += r.updated;
    skipped += r.skipped;
  }
  revalidatePath("/employer", "layout");
  if (updated === 0) return { ok: false, error: "That change isn't allowed for the selected applicants' current status.", updated, skipped };
  return {
    ok: true,
    updated,
    skipped,
    message: skipped
      ? `Updated ${updated}. ${skipped} skipped because the change isn't allowed from their current status.`
      : `Updated ${updated} applicant${updated === 1 ? "" : "s"}`,
  };
}
const interviewSchema = z.object({
  applicationId: uuid,
  scheduledAt: z.string().min(10), // ISO string built from the employer's local date/time (Africa/Harare)
  durationMinutes: z.number().int().min(10).max(480),
  mode: z.enum(["physical", "virtual"]),
  location: z.string().trim().min(2, "Enter the address or meeting link").max(500),
  instructions: z.string().trim().max(2000).optional(),
  message: z.string().trim().max(4000).optional(),
});

export async function scheduleInterviewAction(input: z.input<typeof interviewSchema>): Promise<ActionResult> {
  await requireRole("employer");
  const parsed = interviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the interview details" };
  const v = parsed.data;
  if (v.mode === "virtual" && !/^https?:\/\//i.test(v.location)) {
    return { ok: false, error: "For a virtual interview, enter the meeting link starting with https://" };
  }
  const when = new Date(v.scheduledAt);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Choose a valid date and time" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("schedule_interview", {
    p_application: v.applicationId,
    p_scheduled_at: when.toISOString(),
    p_duration: v.durationMinutes,
    p_mode: v.mode,
    p_location: v.location,
    p_instructions: v.instructions || null,
    p_message: v.message || null,
  });
  if (error) return { ok: false, error: dbMessage(error.message) };
  revalidatePath("/employer", "layout");
  return { ok: true, message: "Interview scheduled and the candidate has been notified" };
}

export async function cancelInterviewAction(interviewId: string): Promise<ActionResult> {
  await requireRole("employer");
  if (!uuid.safeParse(interviewId).success) return { ok: false, error: "Invalid interview" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_interview", { p_interview: interviewId });
  if (error) return { ok: false, error: dbMessage(error.message) };
  revalidatePath("/employer", "layout");
  return { ok: true, message: "Interview cancelled" };
}

const templateSchema = z.object({
  kind: z.enum(["shortlist", "interview", "offer", "rejection"]),
  subject: z.string().trim().min(1, "Add a subject").max(160),
  body: z.string().trim().min(1, "Write a message").max(4000),
});

export async function saveTemplateAction(input: z.input<typeof templateSchema>): Promise<ActionResult> {
  const session = await requireRole("employer");
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the template" };
  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("id").eq("owner_id", session.id).maybeSingle();
  if (!company) return { ok: false, error: "Company not found" };
  const { error } = await supabase
    .from("message_templates")
    .upsert({ company_id: company.id, ...parsed.data }, { onConflict: "company_id,kind" });
  if (error) return { ok: false, error: "Could not save the template" };
  revalidatePath("/employer/templates");
  return { ok: true, message: "Template saved" };
}

export async function resetTemplateAction(kind: "shortlist" | "interview" | "offer" | "rejection"): Promise<ActionResult> {
  const session = await requireRole("employer");
  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("id").eq("owner_id", session.id).maybeSingle();
  if (!company) return { ok: false, error: "Company not found" };
  await supabase.from("message_templates").delete().eq("company_id", company.id).eq("kind", kind);
  revalidatePath("/employer/templates");
  return { ok: true, message: "Template reset to the default" };
}
