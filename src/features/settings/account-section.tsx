import type { SessionProfile } from "@/lib/auth";
import { signAvatarUrl } from "@/lib/avatars";
import { AccountPanel } from "./account-panel";

/** Photo, name, phone and password for any signed-in role. */
export async function AccountSection({ session }: { session: SessionProfile }) {
  const avatarUrl = await signAvatarUrl(session.avatar_path);
  return (
    <AccountPanel
      userId={session.id}
      fullName={session.full_name}
      phone={session.phone ?? ""}
      email={session.email}
      avatarUrl={avatarUrl}
      hasPhoto={Boolean(session.avatar_path)}
    />
  );
}