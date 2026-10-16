import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { NotificationCenter } from "@/features/notifications/notification-center";

export const metadata: Metadata = { title: "Notifications" };

export default async function EmployerNotificationsPage() {
  const session = await requireRole("employer");
  return (
    <>
      <PageHeader title="Notifications" />
      <NotificationCenter userId={session.id} />
    </>
  );
}
