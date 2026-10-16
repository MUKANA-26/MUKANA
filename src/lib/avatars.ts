import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Signed URLs (1 hour) for profile photos in the private `avatars` bucket, keyed by storage path.
 * Storage RLS decides what the caller may see: their own photo, or photos of candidates who applied
 * to their opportunities. Anything else is simply left out and the UI shows initials.
 */
export async function signAvatarUrls(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage.from("avatars").createSignedUrls(unique, 3600);
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl;
  }
  return out;
}

export async function signAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  return (await signAvatarUrls([path]))[path] ?? null;
}
