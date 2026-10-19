"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";

const schema = z.object({
  kind: z.enum(["career_guidance", "interview_prep", "cv_and_applications", "workplace_skills", "digital_skills"]),
  title: z.string().trim().min(3, "Add a title").max(160),
  summary: z.string().trim().max(300).optional().or(z.literal("")),
  body: z.string().trim().min(10, "Write the guide text").max(20000),
  audience: z.enum(["all", "attachee", "graduate_trainee"]),
  language: z.enum(["en", "sn", "nd"]),
  published: z.boolean(),
});

export async function saveResourceAction(id: string | null, input: z.input<typeof schema>): Promise<ActionResult> {
  await requireRole("admin");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const row = { ...parsed.data, summary: parsed.data.summary || null };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("resources").update(row).eq("id", id) : await supabase.from("resources").insert(row);
  if (error) return { ok: false, error: "Could not save the guide" };
  revalidatePath("/learn");
  revalidatePath("/admin/resources");
  return { ok: true, message: "Guide saved" };
}

export async function deleteResourceAction(id: string): Promise<ActionResult> {
  await requireRole("admin");
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid guide" };
  const supabase = await createClient();
  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the guide" };
  revalidatePath("/learn");
  revalidatePath("/admin/resources");
  return { ok: true, message: "Guide deleted" };
}
