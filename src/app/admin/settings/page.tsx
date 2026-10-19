import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { AccountSection } from "@/features/settings/account-section";
import { PreferencesPanel } from "@/features/settings/preferences-panel";
import { TwoFactorPanel } from "@/features/settings/two-factor-panel";
import { PrivacyPanel } from "@/features/settings/privacy-panel";

export const metadata: Metadata = { title: "Account settings" };

export default async function AdminSettingsPage() {
  const session = await requireRole("admin");
  return (
    <>
      <PageHeader title="Account settings" description={session.email} />
      <div className="space-y-5">
        <AccountSection session={session} />
        <PreferencesPanel />
        <TwoFactorPanel />
        <PrivacyPanel canDelete={false} />
      </div>
    </>
  );
}