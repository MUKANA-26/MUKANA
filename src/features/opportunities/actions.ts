"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { opportunitySchema, type OpportunityValues } from "./schemas";

const nul = (v: string | number | undefined | null) => (v === undefined || v === null || v === "" ? null : v);

function dbMessage(message: string) {
  // Surface the readable text of our own `raise exception` messages.
  return message.replace(/^.*?:\s*/, "");
}

export async function saveOpportunityAction(
  id: string | null,
  values: OpportunityValues,
  intent: "draft" | "publish",
): Promise<ActionResult & { id?: string }> {
  const session = await requireRole("employer");
  const parsed = opportunitySchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const v = parsed.data;
  const supabase = await createClient();

  const { data: company } = await supabase.from("companies").select("id, verification_status").eq("owner_id", session.id).maybeSingle();
  if (!company) return { ok: false, error: "Set up your company profile first" };
  if (intent === "publish" && company.verification_status !== "approved") {
    return { ok: false, error: "Your company must be verified before you can publish. You can save this as a draft." };
  }

  const row = {
    company_id: company.id,
    type: v.type,
    title: v.title,
    department: nul(v.department),
    description: v.description,
    requirements: nul(v.requirements),
    skills: v.skills,
    eligible_fields: v.eligibleFields,
    min_level: v.type === "industrial_attachment" ? nul(v.minLevel) : null,
    min_qualification: v.type === "graduate_trainee" ? nul(v.minQualification) : null,
    slots: Number(v.slots),
    location: v.location,
    province: nul(v.province),
    mode: v.mode,
    start_date: nul(v.startDate),
    duration_months: v.durationMonths ? Number(v.durationMonths) : null,
    stipend_type: v.stipendType,
    stipend_amount: v.stipendType === "paid" && v.stipendAmount ? Number(v.stipendAmount) : null,
    stipend_currency: v.stipendType === "paid" ? nul(v.stipendCurrency) ?? "USD" : null,
    deadline: v.deadline,
    ...(intent === "publish" ? { status: "published" as const } : {}),
  };

  if (id) {
    const { error } = await supabase.from("opportunities").update(row).eq("id", id);
    if (error) return { ok: false, error: dbMessage(error.message) };
    revalidatePath("/employer/opportunities");
    revalidatePath(`/opportunities/${id}`);
    return { ok: true, id, message: intent === "publish" ? "Opportunity published" : "Draft saved" };
  }
  const { data, error } = await supabase.from("opportunities").insert({ ...row, status: intent === "publish" ? "published" : "draft" }).select("id").single();
  if (error) return { ok: false, error: dbMessage(error.message) };
  revalidatePath("/employer/opportunities");
  return { ok: true, id: data.id, message: intent === "publish" ? "Opportunity published" : "Draft saved" };
}

export async function closeOpportunityAction(id: string): Promise<ActionResult> {
  await requireRole("employer");
  const supabase = await createClient();
  const { error } = await supabase.from("opportunities").update({ status: "closed" }).eq("id", id);
  if (error) return { ok: false, error: dbMessage(error.message) };
  revalidatePath("/employer/opportunities");
  revalidatePath(`/opportunities/${id}`);
  return { ok: true, message: "Opportunity closed" };
}

export async function deleteDraftAction(id: string): Promise<ActionResult> {
  await requireRole("employer");
  const supabase = await createClient();
  const { error } = await supabase.from("opportunities").delete().eq("id", id).eq("status", "draft");
  if (error) return { ok: false, error: dbMessage(error.message) };
  revalidatePath("/employer/opportunities");
  return { ok: true, message: "Draft deleted" };
}

export async function toggleSaveAction(opportunityId: string, save: boolean): Promise<ActionResult> {
  const session = await requireRole("candidate");
  const supabase = await createClient();
  if (save) {
    const { error } = await supabase.from("saved_opportunities").upsert({ user_id: session.id, opportunity_id: opportunityId });
    if (error) return { ok: false, error: "Could not save this opportunity" };
  } else {
    const { error } = await supabase.from("saved_opportunities").delete().eq("user_id", session.id).eq("opportunity_id", opportunityId);
    if (error) return { ok: false, error: "Could not remove this opportunity" };
  }
  revalidatePath("/candidate/saved");
  return { ok: true };
}
