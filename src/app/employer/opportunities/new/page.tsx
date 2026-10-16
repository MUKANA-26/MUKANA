import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { getMyCompany } from "@/features/profile/queries";
import { OpportunityForm } from "@/features/opportunities/opportunity-form";

export const metadata: Metadata = { title: "New opportunity" };

export default async function NewOpportunityPage() {
  const session = await requireRole("employer");
  const data = await getMyCompany(session.id);
  return (
    <>
      <PageHeader title="New opportunity" description="Save a draft any time. Verified companies can publish." />
      <OpportunityForm opportunity={null} verified={data?.company.verification_status === "approved" && session.emailVerified} />
    </>
  );
}
