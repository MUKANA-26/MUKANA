import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, SkeletonList } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { OpportunityBrowser } from "@/features/opportunities/opportunity-browser";
import { getCandidateProfile } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Browse opportunities" };

export default async function CandidateBrowsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireRole("candidate");
  const [params, profile] = await Promise.all([searchParams, getCandidateProfile(session.id)]);
  const lockedType = profile?.candidate_type === "graduate_trainee" ? "graduate_trainee" : "industrial_attachment";
  return (
    <>
      <PageHeader
        title="Browse opportunities"
        description={lockedType === "graduate_trainee" ? "Graduate trainee programmes open for applications." : "Industrial attachments open for applications."}
      />
      <Suspense fallback={<SkeletonList />}>
        <OpportunityBrowser params={params} basePath="/candidate/opportunities" detailBase="/candidate/opportunities" lockedType={lockedType} />
      </Suspense>
    </>
  );
}
