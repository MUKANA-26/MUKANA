import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { companyLogoUrl } from "@/lib/storage";
import { Avatar } from "@/components/ui/avatar";
import type { EventRow } from "@/features/events/event-list";
import { EventDetailClient } from "@/features/events/event-detail-client";

export const metadata: Metadata = { title: "Event" };

interface Exhibitor {
  company_id: string;
  name: string;
  logo_path: string | null;
  open_roles: number | string;
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const supabase = await createClient();
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const [upcoming, past] = valid
    ? await Promise.all([supabase.rpc("list_events", { p_kind: null, p_past: false }), supabase.rpc("list_events", { p_kind: null, p_past: true })])
    : [{ data: [] }, { data: [] }];
  const event = [...((upcoming.data ?? []) as EventRow[]), ...((past.data ?? []) as EventRow[])].find((e) => e.id === id);
  const exhibitors = event && event.kind === "career_fair" ? (((await supabase.rpc("event_exhibitor_list", { p_event: id })).data ?? []) as Exhibitor[]) : [];

  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <Link href="/events" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> All events
        </Link>
        {!event ? (
          <EmptyState title="Event not found" description="It may have been cancelled or removed." action={<Button asChild variant="outline"><Link href="/events">See events</Link></Button>} />
        ) : (
          <div className="space-y-5">
            <EventDetailClient event={event} signedIn={Boolean(session)} />
            {event.description ? <p className="whitespace-pre-line rounded-xl border border-border bg-surface p-4 text-sm leading-6">{event.description}</p> : null}
            {event.host_name ? <p className="text-sm text-muted-foreground">Hosted by {event.company_name || event.host_name}</p> : null}
            {event.kind === "career_fair" ? (
              <section aria-labelledby="exh-h" className="rounded-xl border border-border bg-surface p-4">
                <h2 id="exh-h" className="font-heading text-lg font-semibold">Exhibitors</h2>
                {exhibitors.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No companies have joined yet.</p>
                ) : (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {exhibitors.map((x) => (
                      <li key={x.company_id}>
                        <Link href={`/companies/${x.company_id}`} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-surface-muted">
                          <Avatar url={companyLogoUrl(x.logo_path)} name={x.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{x.name}</span>
                            <span className="block text-xs text-muted-foreground">{Number(x.open_roles)} open role{Number(x.open_roles) === 1 ? "" : "s"}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
          </div>
        )}
      </div>
    </AdaptiveLayout>
  );
}
