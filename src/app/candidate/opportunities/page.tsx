import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, SkeletonList } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { typesForCandidate } from "@/lib/opportunity-types";
import { OpportunityBrowser } from "@/features/opportunities/opportunity-browser";
import { getCandidateProfile } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Browse opportunities" };

export default async function CandidateBrowsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireRole("candidate");
  const [params, profile] = await Promise.all([searchParams, getCandidateProfile(session.id)]);
  const candidateType = profile?.candidate_type === "graduate_trainee" ? "graduate_trainee" : "attachee";
  const lockedTypes = typesForCandidate(candidateType);
  return (
    <>
      <PageHeader
        title="Browse opportunities"
        description={candidateType === "graduate_trainee" ? "Graduate programmes, entry-level jobs and internships open for applications." : "Industrial attachments and internships open for applications."}
      />
      <Suspense fallback={<SkeletonList />}>
        <OpportunityBrowser params={params} basePath="/candidate/opportunities" detailBase="/candidate/opportunities" lockedTypes={lockedTypes} myProvince={profile?.province ?? null} />
      </Suspense>
    </>
  );
}
