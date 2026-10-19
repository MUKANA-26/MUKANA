import type { Metadata } from "next";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { PageHeader } from "@/components/ui/misc";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EventBrowser } from "@/features/events/event-list";

export const metadata: Metadata = { title: "Events", description: "Webinars, meet-ups and career fairs on Mukana." };

export default async function EventsPage() {
  const session = await getSession();
  let verifiedCompany = false;
  if (session?.role === "employer") {
    const supabase = await createClient();
    const { data: id } = await supabase.rpc("acting_company_id");
    if (id) {
      const { data } = await supabase.from("companies").select("verification_status").eq("id", id as string).maybeSingle();
      verifiedCompany = data?.verification_status === "approved";
    }
  }
  const isAdmin = session?.role === "admin";
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Events" description="Webinars, meet-ups and career fairs." />
        <EventBrowser signedIn={Boolean(session)} canHost={isAdmin || verifiedCompany} isAdmin={isAdmin} canExhibit={verifiedCompany} />
      </div>
    </AdaptiveLayout>
  );
}
