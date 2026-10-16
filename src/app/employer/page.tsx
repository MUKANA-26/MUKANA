import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, ClipboardList, Plus, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { StatusBadge } from "@/features/applications/status-badge";
import { getApplicants, getInterviews } from "@/features/employer/queries";
import { ScorePill } from "@/features/matching/match-card";
import { getMyCompany } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function EmployerDashboard() {
  const session = await requireRole("employer");
  const supabase = await createClient();
  const [data, applicants, interviews, { count: published }] = await Promise.all([
    getMyCompany(session.id),
    getApplicants(),
    getInterviews("upcoming", 5),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "published"),
  ]);
  const company = data?.company;
  const fresh = applicants.filter((a) => a.status === "submitted").length;
  const shortlisted = applicants.filter((a) => a.status === "shortlisted").length;

  const tiles = [
    { label: "Published", value: published ?? 0, icon: ClipboardList },
    { label: "New applicants", value: fresh, icon: Users },
    { label: "Shortlisted", value: shortlisted, icon: BadgeCheck },
    { label: "Upcoming interviews", value: interviews.length, icon: CalendarClock },
  ];

  return (
    <>
      <PageHeader
        title={company?.name || "Dashboard"}
        description="Your hiring at a glance."
        actions={
          <Button asChild variant="cta">
            <Link href="/employer/opportunities/new">
              <Plus aria-hidden /> New opportunity
            </Link>
          </Button>
        }
      />

      {company && company.verification_status !== "approved" ? (
        <div role="note" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-warning bg-warning-soft p-4 text-warning-soft-foreground">
          <ShieldAlert className="size-6 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-heading font-semibold">
              {company.verification_status === "pending" ? "Verification under review" : company.verification_status === "rejected" ? "Verification not approved" : "Get your company verified"}
            </p>
            <p>
              {company.verification_status === "pending"
                ? "An admin is reviewing your documents. You can keep drafting opportunities meanwhile."
                : "Verified companies get a green badge and can publish opportunities."}
            </p>
          </div>
          <Button asChild variant="default" size="sm">
            <Link href="/employer/company">{company.verification_status === "pending" ? "View status" : "Verify now"}</Link>
          </Button>
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
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle>Recent applicants</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link href="/employer/applicants">
                All <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {applicants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet. Publish an opportunity and share its link on WhatsApp.</p>
            ) : (
              <ul className="divide-y divide-border">
                {applicants.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/employer/applicants/${a.id}`} className="block truncate text-sm font-semibold hover:underline">
                        {a.candidate.full_name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.opportunity?.title} · {timeAgo(a.submitted_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ScorePill score={a.match_score} />
                      <StatusBadge status={a.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle>Upcoming interviews</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link href="/employer/interviews">
                All <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {interviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <ul className="space-y-3">
                {interviews.map((i) => (
                  <li key={i.id} className="flex items-start gap-3 rounded-lg bg-surface-muted p-3 text-sm">
                    <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <div className="min-w-0">
                      <p className="font-semibold">{i.applications?.profiles?.full_name}</p>
                      <p className="text-muted-foreground">
                        {i.applications?.opportunities?.title} · {formatDateTime(i.scheduled_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
