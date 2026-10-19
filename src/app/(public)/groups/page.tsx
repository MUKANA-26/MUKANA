import type { Metadata } from "next";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { GroupBrowser } from "@/features/groups/group-list";

export const metadata: Metadata = { title: "Groups" };

export default async function GroupsPage() {
  await requireUser();
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Groups" description="Talk with people who share your school, skills or industry." />
        <GroupBrowser />
      </div>
    </AdaptiveLayout>
  );
}
