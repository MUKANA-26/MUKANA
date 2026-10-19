import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { InstallButton } from "@/components/pwa/pwa-provider";
import { NotificationSettings } from "@/features/notifications/notification-settings";
import { AccountSection } from "@/features/settings/account-section";
import { PresenceSection } from "@/features/network/presence-section";
import { PrivacyPanel } from "@/features/settings/privacy-panel";

export const metadata: Metadata = { title: "Settings" };

export default async function CandidateSettingsPage() {
  const session = await requireRole("candidate");
  return (
    <>
      <PageHeader title="Settings" description={session.email} />
      <div className="space-y-5">
        <AccountSection session={session} />
        <PresenceSection session={session} />
        <NotificationSettings userId={session.id} />
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="flex-1 text-sm">Add Mukana to your phone or computer for a faster, app-like experience.</p>
          <InstallButton />
        </div>
        <PrivacyPanel />
        <p className="text-sm text-muted-foreground">
          <Link href="/privacy" className="text-link underline">Privacy Policy</Link> · <Link href="/terms" className="text-link underline">Terms of Use</Link>
        </p>
      </div>
    </>
  );
}
