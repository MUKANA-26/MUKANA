import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardList, PartyPopper, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { OpportunityCard } from "@/features/opportunities/opportunity-card";
import { getRecommendations } from "@/features/matching/queries";
import { getCompleteness } from "@/features/profile/queries";
import { CompletenessCard } from "@/features/profile/completeness-card";
import { StatusBadge } from "@/features/applications/status-badge";
import { OPEN_STATUSES } from "@/features/applications/status";
import type { ApplicationStatus } from "@/types/db";

export const metadata: Metadata = { title: "Dashboard" };

interface AppRow {
  id: string;
  status: ApplicationStatus;
  opportunities: { title: string; companies: { name: string } | null } | null;
}
interface InterviewRowJoined {
  id: string;
  scheduled_at: string;
  mode: string;
  status: string;
  applications: { id: string; opportunities: { title: string; companies: { name: string } | null } | null } | null;
}

export default async function CandidateDashboard() {
  const session = await requireRole("candidate");
  const supabase = await createClient();
  const [completeness, recs, appsRes, interviewsRes] = await Promise.all([
    getCompleteness(session.id),
    getRecommendations(3),
    supabase
      .from("applications")
      .select("id, status, opportunities(title, companies(name))")
      .eq("candidate_id", session.id)
      .order("status_changed_at", { ascending: false })
      .limit(100),
    supabase
      .from("interviews")
      .select("id, scheduled_at, mode, status, applications!inner(id, candidate_id, opportunities(title, companies(name)))")
      .in("status", ["scheduled", "confirmed"])
      .gt("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(3),
  ]);
  const apps = (appsRes.data ?? []) as unknown as AppRow[];
  const interviews = (interviewsRes.data ?? []) as unknown as InterviewRowJoined[];
  const count = (s: ApplicationStatus) => apps.filter((a) => a.status === s).length;
  const open = apps.filter((a) => OPEN_STATUSES.includes(a.status)).length;
  const offers = apps.filter((a) => a.status === "offer_made");
  const firstName = (session.full_name || "there").split(" ")[0];

  const tiles = [
    { label: "Open applications", value: open, icon: Send },
    { label: "Shortlisted", value: count("shortlisted"), icon: ClipboardList },
    { label: "Interviews", value: interviews.length, icon: CalendarClock },
    { label: "Offers", value: offers.length, icon: PartyPopper },
  ];

  return (
    <>
      <PageHeader title={`Hello, ${firstName}`} description="Here's where things stand." />

      {offers.length > 0 ? (
        <div role="status" className="mb-5 rounded-xl border border-cta bg-warning-soft p-4 text-warning-soft-foreground">
          <p className="flex items-center gap-2 font-heading font-semibold">
            <PartyPopper className="size-5" aria-hidden /> You have {offers.length} offer{offers.length === 1 ? "" : "s"} waiting
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {offers.map((o) => (
              <li key={o.id}>
                <Link href={`/candidate/applications/${o.id}`} className="font-semibold underline">
                  {o.opportunities?.title}
                </Link>{" "}
                · {o.opportunities?.companies?.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="flex items-center gap-3 p-4 sm:p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-info-soft text-info-soft-foreground">
                <t.icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-heading text-2xl font-semibold leading-none">{t.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <CompletenessCard completeness={completeness} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Upcoming interviews</CardTitle>
          </CardHeader>
          <CardContent>
            {interviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No interviews scheduled yet.</p>
            ) : (
              <ul className="space-y-3">
                {interviews.map((i) => (
                  <li key={i.id} className="flex items-start gap-3 rounded-lg bg-surface-muted p-3 text-sm">
                    <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <div className="min-w-0">
                      <Link href={`/candidate/applications/${i.applications?.id}`} className="font-semibold hover:underline">
                        {i.applications?.opportunities?.title}
                      </Link>
                      <p className="text-muted-foreground">
                        {i.applications?.opportunities?.companies?.name} · {formatDateTime(i.scheduled_at)}
                      </p>
                    </div>
                    <StatusBadge status="interview_invited" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="rec">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="rec" className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Sparkles className="size-5 text-cta" aria-hidden /> Recommended for you
          </h2>
          <Button asChild variant="link" size="sm">
            <Link href="/candidate/recommended">
              See all <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        {recs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Complete your profile to get ranked recommendations.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recs.map((r) => (
              <li key={r.opportunity.id} className="relative">
                <OpportunityCard opportunity={r.opportunity} href={`/candidate/opportunities/${r.opportunity.id}`} matchScore={r.score} as="h3" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
