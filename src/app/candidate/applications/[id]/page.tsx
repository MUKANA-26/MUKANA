import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { CandidateApplicationDetail } from "@/features/applications/candidate-application-detail";

export const metadata: Metadata = { title: "Application" };

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await requireRole("candidate");
  return (
    <>
      <Link href="/candidate/applications" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> All applications
      </Link>
      <CandidateApplicationDetail userId={session.id} applicationId={id} />
    </>
  );
}
