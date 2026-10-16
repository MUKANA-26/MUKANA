"use client";

import { createClient } from "@/lib/supabase/client";
import { FILE_RULES, POST_IMAGE_MAX, POST_VIDEO_MAX, sniffMime, type FileKind } from "./constants";
import { finalizeUploadAction } from "./actions";
import { formatBytes } from "@/lib/utils";

export class UploadError extends Error {}

/** Validates a file on the client (size, extension, real type from magic bytes). */
export async function validateFile(kind: FileKind, file: File) {
  const rule = FILE_RULES[kind];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!rule.extensions.includes(ext)) throw new UploadError(`Unsupported file type. Allowed: ${rule.extensions.join(", ").toUpperCase()}.`);
  if (file.size === 0) throw new UploadError("That file is empty.");
  if (file.size > rule.maxBytes) throw new UploadError(`File is too large (${formatBytes(file.size)}). Maximum is ${formatBytes(rule.maxBytes)}.`);
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const real = sniffMime(head);
  if (!real || !rule.mimes.includes(real)) throw new UploadError("The file contents don't match an allowed type.");
  if (kind === "post_media") {
    const isVideo = real.startsWith("video/");
    if (!isVideo && file.size > POST_IMAGE_MAX) throw new UploadError(`Photos can be up to ${formatBytes(POST_IMAGE_MAX)}.`);
    if (isVideo && file.size > POST_VIDEO_MAX) throw new UploadError(`Videos can be up to ${formatBytes(POST_VIDEO_MAX)}.`);
  }
  const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
  return { mime: real, ext: EXT[real] ?? "jpg" };
}

/**
 * Uploads straight to private Supabase Storage (Row Level Security applies), then asks the server to
 * re-verify the stored object (size + magic bytes) and attach it to the right record.
 */
export async function uploadFile(kind: FileKind, file: File, ownerFolderId: string): Promise<string> {
  const rule = FILE_RULES[kind];
  const { mime, ext } = await validateFile(kind, file);
  const path = `${ownerFolderId}/${kind}-${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from(rule.bucket).upload(path, file, {
    contentType: mime,
    cacheControl: "0",
    upsert: false,
  });
  if (error) throw new UploadError(error.message.includes("exceeded") ? "File is too large." : "Upload failed. Please try again.");

  const result = await finalizeUploadAction(kind, path);
  if (!result.ok) throw new UploadError(result.error ?? "The file could not be verified.");
  return path;
}
