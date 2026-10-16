import type { Metadata } from "next";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { companyLogoUrl } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { OpportunityDetailView } from "@/features/opportunities/opportunity-detail";
import { TYPE_LABEL } from "@/features/opportunities/opportunity-card";
import { getOpportunity } from "@/features/opportunities/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const o = await getOpportunity(id);
  if (!o) return { title: "Opportunity not found" };
  const company = o.companies?.name ?? "a Zimbabwean employer";
  const title = `${o.title} at ${company}`;
  const description = `${TYPE_LABEL[o.type]} in ${o.location}. Apply by ${formatDate(o.deadline)}. ${o.description.replace(/\s+/g, " ").slice(0, 120)}…`;
  const url = `/opportunities/${o.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", title, description, url, siteName: "Mukana" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdaptiveLayout>
      <OpportunityDetailView id={id} />
    </AdaptiveLayout>
  );
}
