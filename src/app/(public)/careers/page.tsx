import type { Metadata } from "next";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { PageHeader } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";
import { CareerExplorer, type CareerCard, type FieldOption } from "@/features/careers/career-explorer";

export const metadata: Metadata = {
  title: "Career path explorer",
  description: "Explore careers in Zimbabwe: the qualifications, subjects, skills and steps to get there.",
};

export default async function CareersPage() {
  const supabase = await createClient();
  const [{ data: careers }, { data: fields }] = await Promise.all([
    supabase.from("careers").select("slug, field, title, summary, entry_roles, pay").eq("published", true).order("position"),
    supabase.from("content_categories").select("slug, label").eq("kind", "career").order("position"),
  ]);
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Career path explorer" description="See what each career needs: qualifications, subjects, skills and how to start." />
        <CareerExplorer careers={(careers ?? []) as CareerCard[]} fields={(fields ?? []) as FieldOption[]} />
      </div>
    </AdaptiveLayout>
  );
}
