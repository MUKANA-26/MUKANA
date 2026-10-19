import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  if (!data.isOwner) {
    return (
      <>
        <PageHeader title={data.company.name || "Company"} description="You are part of this company's hiring team." actions={<Button asChild variant="outline"><Link href={`/companies/${data.company.id}`}>View public page</Link></Button>} />
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          Only the company owner can edit the company profile and verification. You can manage opportunities, applicants and interviews, and see your <Link href="/employer/team" className="font-semibold text-link underline">hiring team</Link>.
        </p>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Company profile"
        description="Your company details and verification."
        actions={
          <Button asChild variant="outline">
            <Link href={`/companies/${data.company.id}`}>View public page</Link>
          </Button>
        }
      />
      <div className="space-y-5">
        <VerificationPanel company={data.company} requests={data.requests} />
        <CompanyProfileForm company={data.company} priv={data.priv} />
        <Link href="/employer/team" className="block rounded-xl border border-border bg-surface p-4 text-sm font-semibold text-link hover:bg-surface-muted">
          Manage your hiring team →
        </Link>
      </div>
    </>
  );
}
