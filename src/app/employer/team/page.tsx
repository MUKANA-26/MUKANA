import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TeamPanel, type TeamMember } from "@/features/employer/team-panel";
import { getMyCompany } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Hiring team" };

export default async function TeamPage() {
  const session = await requireRole("employer");
  const supabase = await createClient();
  const [{ data }, company] = await Promise.all([supabase.rpc("list_company_team"), getMyCompany(session.id)]);
  const members = ((data ?? []) as TeamMember[]).sort((a, b) => Number(b.is_owner) - Number(a.is_owner));
  return (
    <>
      <PageHeader title="Hiring team" description={company?.company.name || "Your company"} />
      <TeamPanel members={members} me={session.id} isOwner={company?.isOwner ?? true} />
    </>
  );
}
