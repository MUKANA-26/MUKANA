"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { passwordSchema } from "@/features/auth/schemas";

const accountSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number, e.g. +263 77 123 4567")
    .optional()
    .or(z.literal("")),
});

export async function updateAccountAction(values: z.input<typeof accountSchema>): Promise<ActionResult> {
  const session = await requireUser();
  const parsed = accountSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq("id", session.id);
  if (error) return { ok: false, error: "Could not save your details" };
  revalidatePath("/", "layout");
  return { ok: true, message: "Account details saved" };
}

export async function changePasswordAction(current: string, next: string): Promise<ActionResult> {
  const session = await requireUser();
  const parsed = passwordSchema.safeParse(next);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Choose a stronger password" };
  if (current === next) return { ok: false, error: "Choose a password that is different from your current one." };
  const supabase = await createClient();
  // Re-check the current password so a stolen session can't silently change it.
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: session.email, password: current });
  if (verifyError) return { ok: false, error: "Your current password is incorrect." };
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { ok: false, error: "Could not change your password. Please try again." };
  return { ok: true, message: "Password changed" };
}
