import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { InstallButton } from "@/components/pwa/pwa-provider";
import { NotificationSettings } from "@/features/notifications/notification-settings";
import { PrivacyPanel } from "@/features/settings/privacy-panel";

export const metadata: Metadata = { title: "Settings" };

export default async function EmployerSettingsPage() {
  const session = await requireRole("employer");
  return (
    <>
      <PageHeader title="Settings" description={session.email} />
      <div className="space-y-5">
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
