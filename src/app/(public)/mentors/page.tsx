import type { Metadata } from "next";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { MentorBoard } from "@/features/mentors/mentor-list";

export const metadata: Metadata = { title: "Mentors" };

export default async function MentorsPage() {
  await requireUser();
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Mentors" description="Learn from people who have been where you want to go." />
        <MentorBoard />
      </div>
    </AdaptiveLayout>
  );
}
