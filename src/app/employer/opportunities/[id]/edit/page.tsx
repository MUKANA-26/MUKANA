import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyCompany } from "@/features/profile/queries";
import { OpportunityForm } from "@/features/opportunities/opportunity-form";
import type { OpportunityRow } from "@/types/db";

export const metadata: Metadata = { title: "Edit opportunity" };

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("employer");
  const [data, supabase] = await Promise.all([getMyCompany(session.id), createClient()]);
  if (!data || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: opportunity } = await supabase.from("opportunities").select("*").eq("id", id).eq("company_id", data.company.id).maybeSingle();
  if (!opportunity) notFound();
  return (
    <>
      <PageHeader title="Edit opportunity" />
      <OpportunityForm opportunity={opportunity as OpportunityRow} verified={data.company.verification_status === "approved" && session.emailVerified} />
    </>
  );
}
