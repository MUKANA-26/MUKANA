import type { Metadata } from "next";
import { Suspense } from "react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { PageHeader, SkeletonList } from "@/components/ui/misc";
import { OpportunityBrowser } from "@/features/opportunities/opportunity-browser";

export const metadata: Metadata = {
  title: "Opportunities",
  description: "Industrial attachments and graduate trainee programmes from verified employers in Zimbabwe.",
};

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <PageHeader title="Opportunities" description="Attachments and graduate trainee programmes across Zimbabwe." />
        <Suspense fallback={<SkeletonList />}>
          <OpportunityBrowser params={params} basePath="/opportunities" detailBase="/opportunities" />
        </Suspense>
      </div>
    </AdaptiveLayout>
  );
}
