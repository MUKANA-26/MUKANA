import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ResourceManager, type ResourceRow } from "@/features/admin/resource-manager";

export const metadata: Metadata = { title: "Learning guides" };

export default async function AdminResourcesPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("resources").select("id, kind, title, summary, body, audience, language, published").order("position").order("title");
  return (
    <>
      <PageHeader title="Learning guides" description="Career guidance, interview preparation and workplace tips shown on the Learn page." />
      <ResourceManager resources={(data ?? []) as ResourceRow[]} />
    </>
  );
}
