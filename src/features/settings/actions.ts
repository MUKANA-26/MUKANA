"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";

/** JSON export of everything Mukana holds about the signed-in user (data access request). */
export async function exportMyDataAction(): Promise<ActionResult & { json?: string; filename?: string }> {
  const session = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_my_data");
  if (error || !data) return { ok: false, error: "Could not prepare your data. Please try again." };
  return { ok: true, json: JSON.stringify(data, null, 2), filename: `mukana-data-${session.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json` };
}

async function purgeFolder(bucket: string, folder: string) {
  const service = createServiceClient();
  for (let i = 0; i < 20; i++) {
    const { data } = await service.storage.from(bucket).list(folder, { limit: 1000 });
    if (!data || data.length === 0) return;
    await service.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`));
    if (data.length < 1000) return;
  }
}

/**
 * Permanently deletes the account: all stored files, then the auth user (the database cascades the
 * profile, applications, notifications, company and everything linked to it).
 */
export async function deleteAccountAction(confirmation: string): Promise<ActionResult> {
  const session = await requireUser();
  if (confirmation.trim() !== "DELETE") return { ok: false, error: 'Type DELETE (in capitals) to confirm.' };
  if (session.role === "admin") return { ok: false, error: "Administrator accounts must be removed by another administrator in the database." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "Account deletion isn't configured on this server. Contact support." };

  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("id").eq("owner_id", session.id).maybeSingle();

  try {
    await Promise.all([
      purgeFolder("cvs", session.id),
      purgeFolder("placement-letters", session.id),
      purgeFolder("avatars", session.id),
      ...(company ? [purgeFolder("company-logos", company.id), purgeFolder("verification-docs", company.id)] : []),
    ]);
    const { error } = await createServiceClient().auth.admin.deleteUser(session.id);
    if (error) return { ok: false, error: "Could not delete your account. Please try again or contact support." };
  } catch {
    return { ok: false, error: "Could not delete your account. Please try again or contact support." };
  }
  await supabase.auth.signOut().catch(() => undefined);
  redirect("/?deleted=1");
}
