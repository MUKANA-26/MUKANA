import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { CandidateProfileForm } from "@/features/profile/candidate-profile-form";
import { CompletenessCard } from "@/features/profile/completeness-card";
import { getCandidateProfile, getCompleteness } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Edit profile" };

export default async function CandidateProfilePage() {
  const session = await requireRole("candidate");
  const [profile, completeness] = await Promise.all([getCandidateProfile(session.id), getCompleteness(session.id)]);
  if (!profile) notFound();
  return (
    <>
      <Link href="/candidate/profile" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> Back to my profile
      </Link>
      <PageHeader title="Edit profile" description="Keep this up to date. Employers see it when you apply." />
      <div className="space-y-5">
        <CompletenessCard completeness={completeness} showAction={false} />
        <CandidateProfileForm
          initial={{ userId: session.id, fullName: session.full_name, email: session.email, phone: session.phone ?? "", profile }}
        />
      </div>
    </>
  );
}
