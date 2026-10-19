import { signAvatarUrl } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import type { SessionProfile } from "@/lib/auth";
import { PresencePanel } from "./presence-panel";

/** Loads the member's own presence settings for the settings pages. */
export async function PresenceSection({ session }: { session: SessionProfile }) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("headline, open_to_work, searchable, profile_visibility, messages_from, cover_path").eq("id", session.id).maybeSingle();
  if (!data) return null;
  const coverUrl = await signAvatarUrl(data.cover_path as string | null);
  return (
    <PresencePanel
      userId={session.id}
      role={session.role}
      coverUrl={coverUrl}
      hasCover={Boolean(data.cover_path)}
      initial={{
        headline: (data.headline as string | null) ?? "",
        open_to_work: Boolean(data.open_to_work),
        searchable: data.searchable !== false,
        profile_visibility: data.profile_visibility === "connections" ? "connections" : "members",
        messages_from: data.messages_from === "anyone" ? "anyone" : "connections",
      }}
    />
  );
}
