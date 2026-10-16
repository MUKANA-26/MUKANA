import { AppShell } from "@/components/layout/app-shell";
import { PublicLayout } from "@/components/layout/public-layout";
import { getSession } from "@/lib/auth";
import { shellAvatarUrl } from "@/components/layout/role-layout";

/**
 * For pages that are public but should feel native once you're signed in
 * (browse, opportunity pages): visitors get the public header, members get their app shell.
 */
export async function AdaptiveLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.status === "suspended") return <PublicLayout>{children}</PublicLayout>;
  const avatarUrl = await shellAvatarUrl(session.id, session.role, session.avatar_path);
  return (
    <AppShell role={session.role} userId={session.id} userName={session.full_name || session.email} userEmail={session.email} avatarUrl={avatarUrl}>
      {children}
    </AppShell>
  );
}
