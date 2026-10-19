import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { JobAlerts } from "@/features/opportunities/job-alerts";
import { getCandidateProfile } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Job alerts" };

export default async function AlertsPage() {
  const session = await requireRole("candidate");
  const profile = await getCandidateProfile(session.id);
  return (
    <>
      <PageHeader title="Job alerts" description="Get notified when an opportunity you care about is published." />
      <JobAlerts userId={session.id} candidateType={profile?.candidate_type === "graduate_trainee" ? "graduate_trainee" : "attachee"} />
    </>
  );
}
