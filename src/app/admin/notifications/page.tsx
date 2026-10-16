import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { NotificationCenter } from "@/features/notifications/notification-center";
import { NotificationSettings } from "@/features/notifications/notification-settings";

export const metadata: Metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  const session = await requireRole("admin");
  return (
    <>
      <PageHeader title="Notifications" />
      <div className="space-y-6">
        <NotificationCenter userId={session.id} />
        <NotificationSettings userId={session.id} />
      </div>
    </>
  );
}
