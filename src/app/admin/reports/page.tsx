import type { Metadata } from "next";
import Link from "next/link";
import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { ActionButton, ReasonButton } from "@/features/admin/reason-dialog";
import { moderateOpportunityAction, resolveReportAction, setCompanySuspendedAction } from "@/features/admin/actions";

export const metadata: Metadata = { title: "Reports" };

const REASON_LABEL: Record<string, string> = {
  scam_or_fee: "Scam or asks for payment",
  misleading: "Misleading information",
  discriminatory: "Discriminatory",
  inappropriate: "Inappropriate content",
  duplicate: "Duplicate or spam",
  other: "Other",
};

interface Report {
  id: string;
  target_type: "opportunity" | "company";
  reason: string;
  details: string | null;
  status: "open" | "actioned" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  opportunities: { id: string; title: string; status: string; suspended: boolean; company_id: string; companies: { name: string } | null } | null;
  companies: { id: string; name: string; suspended: boolean } | null;
  profiles: { full_name: string } | null;
}

const SELECT =
  "id, target_type, reason, details, status, created_at, resolved_at, resolution_note, opportunities(id, title, status, suspended, company_id, companies(name)), companies(id, name, suspended), profiles!reports_reporter_id_fkey(full_name)";

export default async function ReportsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [openRes, doneRes] = await Promise.all([
    supabase.from("reports").select(SELECT).eq("status", "open").order("created_at"),
    supabase.from("reports").select(SELECT).neq("status", "open").order("resolved_at", { ascending: false }).limit(15),
  ]);
  const open = (openRes.data ?? []) as unknown as Report[];
  const done = (doneRes.data ?? []) as unknown as Report[];

  return (
    <>
      <PageHeader title="Reports" description="Reviewed opportunities and companies reported by users. Suspending or removing content is logged in the audit log." />
      {open.length === 0 ? (
        <EmptyState icon={<Flag aria-hidden />} title="No open reports" description="Reports from candidates and employers will show up here." />
      ) : (
        <ul className="space-y-4">
          {open.map((r) => {
            const opp = r.opportunities;
            const company = r.companies;
            return (
              <li key={r.id}>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">
                        {r.target_type === "opportunity" ? (
                          <Link href={`/opportunities/${opp?.id}`} className="hover:underline" target="_blank">
                            {opp?.title ?? "Opportunity"}
                          </Link>
                        ) : (
                          company?.name ?? "Company"
                        )}
                      </CardTitle>
                      <Badge variant="danger">{REASON_LABEL[r.reason] ?? r.reason}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.target_type === "opportunity" ? `Opportunity by ${opp?.companies?.name ?? "—"}` : "Company"} · reported by {r.profiles?.full_name ?? "a user"} · {formatDateTime(r.created_at)}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {r.details ? <p className="whitespace-pre-line rounded-lg bg-surface-muted p-3 text-sm">{r.details}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      {r.target_type === "opportunity" && opp ? (
                        <>
                          {opp.suspended ? (
                            <ActionButton label="Restore opportunity" run={() => moderateOpportunityAction(opp.id, "restore")} />
                          ) : (
                            <ReasonButton label="Suspend" title="Suspend this opportunity" description="It is hidden from candidates immediately. The employer is notified." confirmLabel="Suspend" required run={(reason) => moderateOpportunityAction(opp.id, "suspend", reason)} />
                          )}
                          <ReasonButton label="Remove" title="Remove this opportunity" description="Hides and closes it permanently. The employer is notified." confirmLabel="Remove" variant="destructive" required run={(reason) => moderateOpportunityAction(opp.id, "remove", reason)} />
                          <ReasonButton label="Suspend company" title="Suspend the company" description="All of the company's opportunities are hidden." confirmLabel="Suspend company" required run={(reason) => setCompanySuspendedAction(opp.company_id, true, reason)} />
                        </>
                      ) : null}
                      {r.target_type === "company" && company ? (
                        company.suspended ? (
                          <ActionButton label="Restore company" run={() => setCompanySuspendedAction(company.id, false)} />
                        ) : (
                          <ReasonButton label="Suspend company" title="Suspend the company" description="The company and all of its opportunities are hidden." confirmLabel="Suspend company" variant="destructive" required run={(reason) => setCompanySuspendedAction(company.id, true, reason)} />
                        )
                      ) : null}
                      <ReasonButton label="Mark as actioned" title="Mark as actioned" confirmLabel="Resolve" variant="success" placeholder="What did you do?" run={(note) => resolveReportAction(r.id, "actioned", note)} />
                      <ReasonButton label="Dismiss" title="Dismiss this report" confirmLabel="Dismiss" placeholder="Why is no action needed?" run={(note) => resolveReportAction(r.id, "dismissed", note)} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 ? (
        <>
          <h2 className="mb-3 mt-8 font-heading text-lg font-semibold">Recently resolved</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.opportunities?.title ?? r.companies?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {REASON_LABEL[r.reason]} · {formatDateTime(r.resolved_at)}
                    {r.resolution_note ? ` · ${r.resolution_note}` : ""}
                  </p>
                </div>
                <Badge variant={r.status === "actioned" ? "success" : "neutral"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
