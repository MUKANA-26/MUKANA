import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { CandidateApplications } from "@/features/applications/candidate-applications";

export const metadata: Metadata = { title: "My applications" };

export default async function ApplicationsPage() {
  const session = await requireRole("candidate");
  return (
    <>
      <PageHeader title="My applications" description="Track every application from submitted to accepted." />
      <CandidateApplications userId={session.id} />
    </>
  );
}
