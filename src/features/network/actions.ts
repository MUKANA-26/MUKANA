"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";

const presenceSchema = z.object({
  headline: z.string().trim().max(120).optional().or(z.literal("")),
  open_to_work: z.boolean(),
  searchable: z.boolean(),
  profile_visibility: z.enum(["members", "connections"]),
  messages_from: z.enum(["connections", "anyone"]),
  mentor: z.boolean(),
  mentor_topics: z.string().trim().max(300),
});

/** Headline, open-to-work and who-can-see/message settings for the signed-in member. */
export async function savePresenceAction(input: z.input<typeof presenceSchema>): Promise<ActionResult> {
  const session = await requireUser();
  const parsed = presenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the headline (up to 120 characters)." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      headline: v.headline?.trim() || null,
      open_to_work: session.role === "candidate" ? v.open_to_work : false,
      searchable: v.searchable,
      profile_visibility: v.profile_visibility,
      messages_from: v.messages_from,
      mentor: v.mentor,
      mentor_topics: v.mentor
        ? v.mentor_topics
            .split(",")
            .map((t) => t.trim().slice(0, 40))
            .filter(Boolean)
            .slice(0, 8)
        : [],
    })
    .eq("id", session.id);
  if (error) return { ok: false, error: "Could not save your settings. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile settings saved" };
}
