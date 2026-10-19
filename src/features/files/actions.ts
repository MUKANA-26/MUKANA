"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FILE_RULES, PDF_MAX, sniffMime, type BucketId, type FileKind } from "./constants";

export interface FileActionResult {
  ok: boolean;
  error?: string;
  url?: string;
}

/**
 * Server-side re-validation of a just-uploaded object: confirms the real file type from its first bytes
 * and the size, deletes the object if it fails, and otherwise attaches it to the owner's record.
 */
export async function finalizeUploadAction(kind: FileKind, path: string): Promise<FileActionResult> {
  const session = await requireUser();
  const rule = FILE_RULES[kind];
  if (!rule) return { ok: false, error: "Unknown file type" };
  const supabase = await createClient();

  let ownerFolder = session.id;
  let companyId: string | null = null;
  if (rule.folder === "company") {
    const { data: company } = await supabase.from("companies").select("id").eq("owner_id", session.id).maybeSingle();
    if (!company) return { ok: false, error: "No company profile" };
    companyId = company.id;
    ownerFolder = company.id;
  }
  if (!path.startsWith(`${ownerFolder}/`) || path.includes("..")) return { ok: false, error: "Invalid file location" };

  const reject = async (error: string): Promise<FileActionResult> => {
    await supabase.storage.from(rule.bucket).remove([path]);
    return { ok: false, error };
  };

  // Public buckets are read through their public address; private ones through a short-lived signed URL.
  let readUrl: string;
  if (rule.bucket === "post-media" || rule.bucket === "company-logos") {
    readUrl = supabase.storage.from(rule.bucket).getPublicUrl(path).data.publicUrl;
  } else {
    const { data: signed, error: signError } = await supabase.storage.from(rule.bucket).createSignedUrl(path, 30);
    if (signError || !signed) return { ok: false, error: "Upload could not be found" };
    readUrl = signed.signedUrl;
  }

  const res = await fetch(readUrl, { headers: { Range: "bytes=0-31" }, cache: "no-store" });
  if (!res.ok && res.status !== 206) return reject("Upload could not be verified");
  const range = res.headers.get("content-range");
  const total = range ? Number(range.split("/")[1]) : Number(res.headers.get("content-length") ?? 0);
  if (!Number.isFinite(total) || total <= 0 || total > rule.maxBytes) return reject("File is too large or empty");
  const head = new Uint8Array((await res.arrayBuffer()).slice(0, 32));
  const real = sniffMime(head);
  if (real === "application/pdf" && total > PDF_MAX) return reject("PDF files can be up to 5MB");
  if (!real || !rule.mimes.includes(real)) return reject("The file contents don't match an allowed type");

  // Attach to the owner's record and clean up the file it replaces.
  const remove = async (old: string | null | undefined) => {
    if (old && old !== path) await supabase.storage.from(rule.bucket).remove([old]);
  };

  if (kind === "cv") {
    const { data: prev } = await supabase.from("candidate_profiles").select("cv_path").eq("user_id", session.id).maybeSingle();
    const { error } = await supabase.from("candidate_profiles").update({ cv_path: path }).eq("user_id", session.id);
    if (error) return reject("Could not save your CV");
    await remove(prev?.cv_path);
  } else if (kind === "placement_letter") {
    const { data: prev } = await supabase.from("candidate_profiles").select("placement_letter_path").eq("user_id", session.id).maybeSingle();
    const { error } = await supabase.from("candidate_profiles").update({ placement_letter_path: path }).eq("user_id", session.id);
    if (error) return reject("Could not save your placement letter");
    await remove(prev?.placement_letter_path);
  } else if (kind === "avatar") {
    const { data: prev } = await supabase.from("profiles").select("avatar_path").eq("id", session.id).maybeSingle();
    const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", session.id);
    if (error) return reject("Could not save your photo");
    await remove(prev?.avatar_path);
  } else if (kind === "cover") {
    const { data: prev } = await supabase.from("profiles").select("cover_path").eq("id", session.id).maybeSingle();
    const { error } = await supabase.from("profiles").update({ cover_path: path }).eq("id", session.id);
    if (error) return reject("Could not save your cover photo");
    await remove(prev?.cover_path);
  } else if (kind === "company_logo" && companyId) {
    const { data: prev } = await supabase.from("companies").select("logo_path").eq("id", companyId).maybeSingle();
    const { error } = await supabase.from("companies").update({ logo_path: path }).eq("id", companyId);
    if (error) return reject("Could not save your logo");
    await remove(prev?.logo_path);
  }
  // cv_builder and verification_doc are attached later by their own flows.
  return { ok: true };
}

/** Removes a candidate document (CV, placement letter or photo) and clears the reference. */
export async function removeFileAction(kind: "cv" | "placement_letter" | "avatar" | "cover"): Promise<FileActionResult> {
  const session = await requireUser();
  const supabase = await createClient();
  const rule = FILE_RULES[kind];
  const column = kind === "cv" ? "cv_path" : kind === "placement_letter" ? "placement_letter_path" : kind === "cover" ? "cover_path" : "avatar_path";
  const onProfile = kind === "avatar" || kind === "cover";
  const table = onProfile ? "profiles" : "candidate_profiles";
  const key = onProfile ? "id" : "user_id";
  const { data } = await supabase.from(table).select(column).eq(key, session.id).maybeSingle();
  const current = (data as Record<string, string | null> | null)?.[column];
  const { error } = await supabase.from(table).update({ [column]: null }).eq(key, session.id);
  if (error) return { ok: false, error: "Could not remove the file" };
  if (current) await supabase.storage.from(rule.bucket).remove([current]);
  return { ok: true };
}

/**
 * A 60-second signed URL for a private file. Authorisation is enforced by Storage RLS: the caller
 * only gets a URL if the storage policies let them read that object (owners, and employers for
 * candidates who applied to their opportunities).
 */
export async function getSignedFileUrlAction(bucket: BucketId, path: string): Promise<FileActionResult> {
  await requireUser();
  if (path.includes("..") || !["cvs", "placement-letters", "avatars", "verification-docs"].includes(bucket)) {
    return { ok: false, error: "Invalid file" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data) return { ok: false, error: "You don't have access to this file, or it no longer exists." };
  return { ok: true, url: data.signedUrl };
}
