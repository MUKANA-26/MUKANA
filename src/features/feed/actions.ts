"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { POST_IMAGE_MAX, POST_VIDEO_MAX, sniffMime } from "@/features/files/constants";

const uuid = z.string().uuid();
const dbMessage = (m: string) => m.replace(/^.*?:\s*/, "");

const mediaSchema = z.array(z.object({ kind: z.enum(["image", "video"]), path: z.string().min(10).max(300) })).max(4);

/** Re-checks an uploaded post file server-side: it must exist, be a real image/video and within size limits. */
async function verifyMedia(userId: string, item: { kind: "image" | "video"; path: string }): Promise<string | null> {
  if (!item.path.startsWith(`${userId}/`) || item.path.includes("..")) return "Invalid file";
  const supabase = await createClient();
  const { data: signed } = await supabase.storage.from("post-media").createSignedUrl(item.path, 30);
  if (!signed) return "An uploaded file could not be found";
  const res = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-31" }, cache: "no-store" });
  if (!res.ok && res.status !== 206) return "An uploaded file could not be verified";
  const range = res.headers.get("content-range");
  const total = range ? Number(range.split("/")[1]) : Number(res.headers.get("content-length") ?? 0);
  const real = sniffMime(new Uint8Array((await res.arrayBuffer()).slice(0, 32)));
  const isVideo = Boolean(real?.startsWith("video/"));
  const isImage = Boolean(real?.startsWith("image/"));
  if ((item.kind === "video" && !isVideo) || (item.kind === "image" && !isImage)) return "A file isn't the type it claims to be";
  if (!total || total > (isVideo ? POST_VIDEO_MAX : POST_IMAGE_MAX)) return isVideo ? "Videos can be up to 30MB" : "Photos can be up to 5MB";
  return null;
}

export async function createPostAction(body: string, media: { kind: "image" | "video"; path: string }[]): Promise<ActionResult & { postId?: string }> {
  const session = await requireUser();
  const parsed = mediaSchema.safeParse(media);
  if (!parsed.success) return { ok: false, error: "Too many files" };
  const supabase = await createClient();

  const cleanup = async () => {
    if (parsed.data.length) await supabase.storage.from("post-media").remove(parsed.data.map((m) => m.path));
  };
  for (const item of parsed.data) {
    const problem = await verifyMedia(session.id, item);
    if (problem) {
      await cleanup();
      return { ok: false, error: problem };
    }
  }
  const { data, error } = await supabase.rpc("create_post", { p_body: body.slice(0, 3000), p_media: parsed.data });
  if (error) {
    await cleanup();
    return { ok: false, error: dbMessage(error.message) };
  }
  revalidatePath("/feed");
  return { ok: true, postId: data as string, message: "Posted" };
}

export async function addCommentAction(postId: string, body: string): Promise<ActionResult & { commentId?: string }> {
  await requireUser();
  if (!uuid.safeParse(postId).success) return { ok: false, error: "Invalid post" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_comment", { p_post: postId, p_body: body.slice(0, 1000) });
  if (error) return { ok: false, error: dbMessage(error.message) };
  return { ok: true, commentId: data as string };
}

export async function deletePostAction(postId: string): Promise<ActionResult> {
  const session = await requireUser();
  if (!uuid.safeParse(postId).success) return { ok: false, error: "Invalid post" };
  const supabase = await createClient();
  const { data: media } = await supabase.from("post_media").select("path").eq("post_id", postId);
  const { data: deleted, error } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", session.id).select("id");
  if (error || !deleted?.length) return { ok: false, error: "You can only delete your own posts." };
  if (media?.length) await supabase.storage.from("post-media").remove(media.map((m) => m.path));
  revalidatePath("/feed");
  return { ok: true, message: "Post deleted" };
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult> {
  await requireUser();
  if (!uuid.safeParse(commentId).success) return { ok: false, error: "Invalid comment" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("post_comments").delete().eq("id", commentId).select("id");
  if (error || !data?.length) return { ok: false, error: "You can't delete this comment." };
  return { ok: true, message: "Comment deleted" };
}
