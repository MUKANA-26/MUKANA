"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";

const uuid = z.string().uuid();
const dbMessage = (m: string) => m.replace(/^.*?:\s*/, "");

async function rpc(name: string, args: Record<string, unknown>, ok: string, paths: string[]): Promise<ActionResult> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc(name, args);
  if (error) return { ok: false, error: dbMessage(error.message) };
  for (const p of paths) revalidatePath(p);
  return { ok: true, message: ok };
}

export async function reviewVerificationAction(requestId: string, approve: boolean, reason?: string): Promise<ActionResult> {
  if (!uuid.safeParse(requestId).success) return { ok: false, error: "Invalid request" };
  if (!approve && !reason?.trim()) return { ok: false, error: "Give the company a reason for the rejection." };
  return rpc(
    "admin_review_verification",
    { p_request: requestId, p_approve: approve, p_reason: reason?.trim() || null },
    approve ? "Company verified" : "Request rejected",
    ["/admin", "/admin/verifications"],
  );
}

export async function moderateOpportunityAction(opportunityId: string, action: "suspend" | "restore" | "remove", reason?: string): Promise<ActionResult> {
  if (!uuid.safeParse(opportunityId).success) return { ok: false, error: "Invalid opportunity" };
  return rpc("admin_moderate_opportunity", { p_opportunity: opportunityId, p_action: action, p_reason: reason?.trim() || null }, `Opportunity ${action === "restore" ? "restored" : action === "remove" ? "removed" : "suspended"}`, ["/admin/reports", "/admin"]);
}

export async function setCompanySuspendedAction(companyId: string, suspended: boolean, reason?: string): Promise<ActionResult> {
  if (!uuid.safeParse(companyId).success) return { ok: false, error: "Invalid company" };
  return rpc("admin_set_company_suspended", { p_company: companyId, p_suspended: suspended, p_reason: reason?.trim() || null }, suspended ? "Company suspended" : "Company restored", ["/admin/reports", "/admin/verifications", "/admin"]);
}

export async function resolveReportAction(reportId: string, status: "actioned" | "dismissed", note?: string): Promise<ActionResult> {
  if (!uuid.safeParse(reportId).success) return { ok: false, error: "Invalid report" };
  return rpc("admin_resolve_report", { p_report: reportId, p_status: status, p_note: note?.trim() || null }, status === "actioned" ? "Report marked as actioned" : "Report dismissed", ["/admin/reports", "/admin"]);
}

export async function setUserStatusAction(userId: string, status: "active" | "suspended", reason?: string): Promise<ActionResult> {
  if (!uuid.safeParse(userId).success) return { ok: false, error: "Invalid user" };
  return rpc("admin_set_user_status", { p_user: userId, p_status: status, p_reason: reason?.trim() || null }, status === "suspended" ? "User suspended" : "User restored", ["/admin/users"]);
}

export async function makeAdminAction(userId: string): Promise<ActionResult> {
  if (!uuid.safeParse(userId).success) return { ok: false, error: "Invalid user" };
  return rpc("admin_create_admin", { p_user: userId }, "User is now an administrator", ["/admin/users"]);
}
