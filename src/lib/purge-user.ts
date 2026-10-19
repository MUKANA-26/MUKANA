import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

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
 * Permanently deletes a user: every stored file (CV, placement letter, photo, post media, and for
 * employers the company logo and verification documents), then the auth user. The database cascades the
 * profile, company, opportunities, applications, posts, comments, notifications and everything linked.
 * SERVER ONLY (uses the service role): callers must authorise first.
 */
export async function deleteUserCompletely(userId: string): Promise<{ ok: boolean; error?: string }> {
  const service = createServiceClient();
  try {
    const { data: company } = await service.from("companies").select("id").eq("owner_id", userId).maybeSingle();
    await Promise.all([
      purgeFolder("cvs", userId),
      purgeFolder("placement-letters", userId),
      purgeFolder("avatars", userId),
      purgeFolder("post-media", userId),
      ...(company ? [purgeFolder("company-logos", company.id), purgeFolder("verification-docs", company.id)] : []),
    ]);
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unexpected error" };
  }
}