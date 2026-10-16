import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { CompanyProfileForm } from "@/features/profile/company-profile-form";
import { VerificationPanel } from "@/features/profile/verification-panel";
import { getMyCompany } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Company profile" };

export default async function CompanyPage() {
  const session = await requireRole("employer");
  const data = await getMyCompany(session.id);
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Company profile" description="Your company details and verification." />
      <div className="space-y-5">
        <VerificationPanel company={data.company} requests={data.requests} />
        <CompanyProfileForm company={data.company} priv={data.priv} />
      </div>
    </>
  );
}
