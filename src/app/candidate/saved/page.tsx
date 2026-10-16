import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { SavedList } from "@/features/opportunities/saved-list";

export const metadata: Metadata = { title: "Saved opportunities" };

export default async function SavedPage() {
  const session = await requireRole("candidate");
  return (
    <>
      <PageHeader title="Saved opportunities" description="We'll remind you 3 days and 1 day before each deadline." />
      <SavedList userId={session.id} />
    </>
  );
}
