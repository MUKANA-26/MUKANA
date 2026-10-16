import { OpportunityDetailView } from "@/features/opportunities/opportunity-detail";

export default async function CandidateOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OpportunityDetailView id={id} />;
}
