import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TalentSearch } from "@/features/employer/talent-search";
import { getMyCompany } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Find talent" };

export default async function TalentPage() {
  const session = await requireRole("employer");
  const supabase = await createClient();
  const data = await getMyCompany(session.id);
  const today = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
  const { data: opps } = data
    ? await supabase.from("opportunities").select("id, title").eq("company_id", data.company.id).eq("status", "published").gte("deadline", today).order("published_at", { ascending: false })
    : { data: [] };
  return (
    <>
      <PageHeader title="Find talent" description="Search candidates who chose to be discoverable, keep a shortlist and invite people to apply." />
      {data ? <TalentSearch companyId={data.company.id} opportunities={(opps ?? []) as { id: string; title: string }[]} /> : null}
    </>
  );
}
