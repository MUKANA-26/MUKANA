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
import { moderateOpportunityAction, moderatePostAction, resolveReportAction, setCompanySuspendedAction } from "@/features/admin/actions";

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
  target_type: "opportunity" | "company" | "post";
  reason: string;
  details: string | null;
  status: "open" | "actioned" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  opportunities: { id: string; title: string; status: string; suspended: boolean; company_id: string; companies: { name: string } | null } | null;
  companies: { id: string; name: string; suspended: boolean } | null;
  profiles: { full_name: string } | null;
  posts?: { id: string; body: string; status: string } | null;
}

const BASE_SELECT =
  "id, target_type, reason, details, status, created_at, resolved_at, resolution_note, opportunities(id, title, status, suspended, company_id, companies(name)), companies(id, name, suspended), profiles!reports_reporter_id_fkey(full_name)";

export default async function ReportsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  // Post reports need the community-feed migration; fall back gracefully if it is not applied yet.
  const SELECT = `${BASE_SELECT}, posts(id, body, status)`;
  type Res = { data: unknown; error: unknown };
  let [openRes, doneRes]: Res[] = await Promise.all([
    supabase.from("reports").select(SELECT).eq("status", "open").order("created_at"),
    supabase.from("reports").select(SELECT).neq("status", "open").order("resolved_at", { ascending: false }).limit(15),
  ]);
  if (openRes.error || doneRes.error) {
    [openRes, doneRes] = await Promise.all([
      supabase.from("reports").select(BASE_SELECT).eq("status", "open").order("created_at"),
      supabase.from("reports").select(BASE_SELECT).neq("status", "open").order("resolved_at", { ascending: false }).limit(15),
    ]);
  }
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
                        {r.target_type === "post" ? (
                          <Link href={`/feed/${r.posts?.id ?? ""}`} className="hover:underline" target="_blank">
                            Post: {(r.posts?.body ?? "(photo or video)").replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1").slice(0, 70) || "(photo or video)"}
                          </Link>
                        ) : r.target_type === "opportunity" ? (
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
                      {r.target_type === "opportunity" ? `Opportunity by ${opp?.companies?.name ?? "—"}` : r.target_type === "post" ? "Feed post" : "Company"} · reported by {r.profiles?.full_name ?? "a user"} · {formatDateTime(r.created_at)}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {r.details ? <p className="whitespace-pre-line rounded-lg bg-surface-muted p-3 text-sm">{r.details}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      {r.target_type === "opportunity" && opp ? (
                        <>
                          {opp.suspended ? (
                            <ActionButton label="Restore opportunity" run={moderateOpportunityAction.bind(null, opp.id, "restore")} />
                          ) : (
                            <ReasonButton label="Suspend" title="Suspend this opportunity" description="It is hidden from candidates immediately. The employer is notified." confirmLabel="Suspend" required run={moderateOpportunityAction.bind(null, opp.id, "suspend")} />
                          )}
                          <ReasonButton label="Remove" title="Remove this opportunity" description="Hides and closes it permanently. The employer is notified." confirmLabel="Remove" variant="destructive" required run={moderateOpportunityAction.bind(null, opp.id, "remove")} />
                          <ReasonButton label="Suspend company" title="Suspend the company" description="All of the company's opportunities are hidden." confirmLabel="Suspend company" required run={setCompanySuspendedAction.bind(null, opp.company_id, true)} />
                        </>
                      ) : null}
                      {r.target_type === "post" && r.posts ? (
                        r.posts.status === "removed" ? (
                          <ReasonButton label="Restore post" title="Restore this post" confirmLabel="Restore" variant="success" run={(note) => moderatePostAction(r.posts!.id, "restore", note)} />
                        ) : (
                          <ReasonButton label="Remove post" title="Remove this post" description="It disappears for everyone and the author is told why." confirmLabel="Remove" variant="destructive" required run={(reason) => moderatePostAction(r.posts!.id, "remove", reason)} />
                        )
                      ) : null}
                      {r.target_type === "company" && company ? (
                        company.suspended ? (
                          <ActionButton label="Restore company" run={setCompanySuspendedAction.bind(null, company.id, false)} />
                        ) : (
                          <ReasonButton label="Suspend company" title="Suspend the company" description="The company and all of its opportunities are hidden." confirmLabel="Suspend company" variant="destructive" required run={setCompanySuspendedAction.bind(null, company.id, true)} />
                        )
                      ) : null}
                      <ReasonButton label="Mark as actioned" title="Mark as actioned" confirmLabel="Resolve" variant="success" placeholder="What did you do?" run={resolveReportAction.bind(null, r.id, "actioned")} />
                      <ReasonButton label="Dismiss" title="Dismiss this report" confirmLabel="Dismiss" placeholder="Why is no action needed?" run={resolveReportAction.bind(null, r.id, "dismissed")} />
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
                  <p className="truncate font-semibold">{r.opportunities?.title ?? r.companies?.name ?? "Feed post"}</p>
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
