import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "@/features/employer/template-editor";
import { getTemplates } from "@/features/employer/queries";
import { getMyCompany } from "@/features/profile/queries";
import type { TemplateKind } from "@/features/applications/templates";

export const metadata: Metadata = { title: "Message templates" };

export default async function TemplatesPage() {
  const session = await requireRole("employer");
  const data = await getMyCompany(session.id);
  if (!data) return null;
  const supabase = await createClient();
  const [templates, { data: custom }] = await Promise.all([
    getTemplates(data.company.id),
    supabase.from("message_templates").select("kind").eq("company_id", data.company.id),
  ]);
  return (
    <>
      <PageHeader title="Message templates" description="Used when you shortlist, invite, make an offer or reject. Always editable before sending." />
      <TemplateEditor templates={templates} customised={((custom ?? []) as { kind: TemplateKind }[]).map((c) => c.kind)} />
    </>
  );
}
