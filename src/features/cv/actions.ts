"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { cvSchema, type CvData } from "./types";

export async function saveCvDraftAction(data: CvData): Promise<ActionResult> {
  const session = await requireRole("candidate");
  // Drafts may be unfinished, so only the size/shape matters here (not "required" fields).
  const parsed = cvSchema.partial({ fullName: true }).safeParse(data);
  if (!parsed.success) return { ok: false, error: "Some CV fields are too long" };
  const supabase = await createClient();
  const { error } = await supabase.from("cv_drafts").upsert({ user_id: session.id, template: parsed.data.template, data: parsed.data });
  if (error) return { ok: false, error: "Could not save your draft" };
  return { ok: true };
}

export interface BuiltCv {
  path: string;
  name: string;
  createdAt: string | null;
  isMain: boolean;
}

export async function listBuiltCvsAction(): Promise<BuiltCv[]> {
  const session = await requireRole("candidate");
  const supabase = await createClient();
  const [{ data: files }, { data: profile }] = await Promise.all([
    supabase.storage.from("cvs").list(session.id, { limit: 100, sortBy: { column: "created_at", order: "desc" } }),
    supabase.from("candidate_profiles").select("cv_path").eq("user_id", session.id).maybeSingle(),
  ]);
  return (files ?? [])
    .filter((f) => f.name.startsWith("cv_builder-") && f.name.endsWith(".pdf"))
    .map((f) => {
      const path = `${session.id}/${f.name}`;
      return { path, name: f.name, createdAt: f.created_at ?? null, isMain: profile?.cv_path === path };
    });
}

export async function setMainCvAction(path: string): Promise<ActionResult> {
  const session = await requireRole("candidate");
  if (!path.startsWith(`${session.id}/`) || path.includes("..") || !path.endsWith(".pdf")) return { ok: false, error: "Invalid file" };
  const supabase = await createClient();
  const { data: prev } = await supabase.from("candidate_profiles").select("cv_path").eq("user_id", session.id).maybeSingle();
  const { error } = await supabase.from("candidate_profiles").update({ cv_path: path }).eq("user_id", session.id);
  if (error) return { ok: false, error: "Could not set your main CV" };
  // A previously uploaded (non-generated) CV is no longer referenced; remove it to keep storage tidy.
  if (prev?.cv_path && prev.cv_path !== path && !prev.cv_path.split("/").pop()?.startsWith("cv_builder-")) {
    await supabase.storage.from("cvs").remove([prev.cv_path]);
  }
  revalidatePath("/candidate", "layout");
  return { ok: true, message: "This is now your main CV" };
}

export async function deleteBuiltCvAction(path: string): Promise<ActionResult> {
  const session = await requireRole("candidate");
  if (!path.startsWith(`${session.id}/cv_builder-`) || path.includes("..")) return { ok: false, error: "Invalid file" };
  const supabase = await createClient();
  const { data: profile } = await supabase.from("candidate_profiles").select("cv_path").eq("user_id", session.id).maybeSingle();
  if (profile?.cv_path === path) return { ok: false, error: "This is your main CV. Choose another main CV first." };
  const { error } = await supabase.storage.from("cvs").remove([path]);
  if (error) return { ok: false, error: "Could not delete the file" };
  return { ok: true, message: "Deleted" };
}
