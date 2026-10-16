import { AppShell } from "@/components/layout/app-shell";
import { PublicLayout } from "@/components/layout/public-layout";
import { getSession } from "@/lib/auth";

/**
 * For pages that are public but should feel native once you're signed in
 * (browse, opportunity pages): visitors get the public header, members get their app shell.
 */
export async function AdaptiveLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.status === "suspended") return <PublicLayout>{children}</PublicLayout>;
  return (
    <AppShell role={session.role} userId={session.id} userName={session.full_name || session.email}>
      {children}
    </AppShell>
  );
}
