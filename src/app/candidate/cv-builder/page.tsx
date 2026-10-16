import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { listBuiltCvsAction } from "@/features/cv/actions";
import { CvBuilderLoader } from "@/features/cv/cv-builder-loader";
import { getCvInitial } from "@/features/cv/prefill";
import { getCandidateProfile } from "@/features/profile/queries";

export const metadata: Metadata = { title: "CV builder" };

export default async function CvBuilderPage() {
  const session = await requireRole("candidate");
  const profile = await getCandidateProfile(session.id);
  const [initial, built] = await Promise.all([getCvInitial(session, profile), listBuiltCvsAction()]);
  return (
    <>
      <PageHeader title="CV builder" description="No work experience? Build a clean CV from your studies, projects, volunteering and skills." />
      <CvBuilderLoader userId={session.id} initial={initial} built={built} />
    </>
  );
}
