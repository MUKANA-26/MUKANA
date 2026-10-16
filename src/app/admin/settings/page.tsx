import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { AccountSection } from "@/features/settings/account-section";
import { PrivacyPanel } from "@/features/settings/privacy-panel";

export const metadata: Metadata = { title: "Account settings" };

export default async function AdminSettingsPage() {
  const session = await requireRole("admin");
  return (
    <>
      <PageHeader title="Account settings" description={session.email} />
      <div className="space-y-5">
        <AccountSection session={session} />
        <PrivacyPanel canDelete={false} />
      </div>
    </>
  );
}