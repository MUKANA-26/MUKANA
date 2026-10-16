import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { STATUS_LABEL } from "@/features/applications/status";
import { getAnalytics } from "@/features/employer/queries";
import type { ApplicationStatus } from "@/types/db";

export const metadata: Metadata = { title: "Analytics" };

const ORDER: ApplicationStatus[] = ["submitted", "under_review", "shortlisted", "interview_invited", "offer_made", "accepted", "unsuccessful", "withdrawn"];
const COLOR: Record<ApplicationStatus, string> = {
  submitted: "bg-muted-foreground/60",
  under_review: "bg-blue",
  shortlisted: "bg-blue",
  interview_invited: "bg-amber",
  offer_made: "bg-orange",
  accepted: "bg-green",
  unsuccessful: "bg-danger",
  withdrawn: "bg-muted-foreground/40",
};

export default async function AnalyticsPage() {
  await requireRole("employer");
  const rows = await getAnalytics();
  const total = rows.reduce((n, r) => n + r.applications, 0);
  const accepted = rows.reduce((n, r) => n + (r.by_status.accepted ?? 0), 0);
  const filled = rows.filter((r) => r.time_to_fill_days != null);
  const avgFill = filled.length ? filled.reduce((n, r) => n + (r.time_to_fill_days ?? 0), 0) / filled.length : null;

  return (
    <>
      <PageHeader title="Analytics" description="Applications, pipeline and time to fill for each opportunity." />
      {rows.length === 0 ? (
        <EmptyState icon={<BarChart3 aria-hidden />} title="No data yet" description="Publish an opportunity to start collecting applications." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Opportunities", value: rows.length },
              { label: "Applications", value: total },
              { label: "Accepted offers", value: accepted },
              { label: "Avg. time to fill", value: avgFill != null ? `${avgFill.toFixed(1)} days` : "—" },
            ].map((t) => (
              <Card key={t.label}>
                <CardContent className="p-4">
                  <p className="font-heading text-2xl font-semibold">{t.value}</p>
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {rows.map((r) => (
              <Card key={r.opportunity_id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>{r.title}</CardTitle>
                    <Badge variant={r.status === "published" ? "success" : r.status === "closed" ? "warning" : "neutral"}>{r.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Applications</dt>
                      <dd className="font-heading text-lg font-semibold">{r.applications}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Avg. match</dt>
                      <dd className="font-heading text-lg font-semibold">{r.avg_match != null ? `${r.avg_match}%` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Time to fill</dt>
                      <dd className="font-heading text-lg font-semibold">{r.time_to_fill_days != null ? `${r.time_to_fill_days}d` : "—"}</dd>
                    </div>
                  </dl>
                  {r.applications > 0 ? (
                    <>
                      <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label="Applications by status">
                        {ORDER.filter((s) => (r.by_status[s] ?? 0) > 0).map((s) => (
                          <div key={s} className={COLOR[s]} style={{ width: `${((r.by_status[s] ?? 0) / r.applications) * 100}%` }} title={`${STATUS_LABEL[s]}: ${r.by_status[s]}`} />
                        ))}
                      </div>
                      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {ORDER.filter((s) => (r.by_status[s] ?? 0) > 0).map((s) => (
                          <li key={s} className="flex items-center gap-1.5">
                            <span className={`size-2.5 rounded-full ${COLOR[s]}`} aria-hidden /> {STATUS_LABEL[s]} <strong className="text-foreground">{r.by_status[s]}</strong>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No applications yet.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
