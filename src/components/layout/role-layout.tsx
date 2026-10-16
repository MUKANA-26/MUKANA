import { MailWarning } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ResendVerification } from "@/features/auth/password-forms";
import { requireRole } from "@/lib/auth";
import type { Role } from "@/lib/roles";

/** Shared layout for the three role areas: guards the route and renders the app shell. */
export async function RoleLayout({ role, children }: { role: Role; children: React.ReactNode }) {
  const session = await requireRole(role);
  return (
    <AppShell role={role} userId={session.id} userName={session.full_name || session.email}>
      {!session.emailVerified ? (
        <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-warning bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          <MailWarning className="size-5 shrink-0" aria-hidden />
          <p className="flex-1">
            Please verify your email address. You can&apos;t {role === "employer" ? "publish opportunities" : "apply"} until you do.
          </p>
          <ResendVerification email={session.email} />
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
