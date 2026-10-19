"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LANG_COOKIE, LOWDATA_COOKIE } from "@/lib/i18n";
import type { ActionResult } from "@/features/auth/actions";

const schema = z.object({ lang: z.enum(["en", "sn", "nd"]), lowData: z.boolean() });

/** Saves language and low-data mode in cookies (instant, works for visitors) and on the profile (follows the member across devices). */
export async function savePreferencesAction(input: z.input<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid choice" };
  const jar = await cookies();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
  jar.set(LANG_COOKIE, parsed.data.lang, opts);
  jar.set(LOWDATA_COOKIE, parsed.data.lowData ? "1" : "0", opts);
  const session = await getSession();
  if (session) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ language: parsed.data.lang, low_data: parsed.data.lowData }).eq("id", session.id);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Preferences saved" };
}
