import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Badge, VerifiedBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/utils";
import { VerificationDecision, VerificationDocs } from "@/features/admin/verification-review";
import type { CompanyPrivateRow, CompanyRow } from "@/types/db";

export const metadata: Metadata = { title: "Verifications" };

interface Row {
  id: string;
  status: "pending" | "approved" | "rejected";
  document_paths: string[];
  note: string | null;
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  companies: (CompanyRow & { company_private: CompanyPrivateRow | CompanyPrivateRow[] | null; profiles: { full_name: string; email: string } | null }) | null;
}

const SELECT = "id, status, document_paths, note, reason, created_at, reviewed_at, companies(*, company_private(*), profiles!companies_owner_id_fkey(full_name, email))";

export default async function VerificationsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [pendingRes, doneRes] = await Promise.all([
    supabase.from("verification_requests").select(SELECT).eq("status", "pending").order("created_at"),
    supabase.from("verification_requests").select(SELECT).neq("status", "pending").order("reviewed_at", { ascending: false }).limit(15),
  ]);
  const pending = (pendingRes.data ?? []) as unknown as Row[];
  const done = (doneRes.data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Verification requests" description="Check the documents, then approve or reject with a reason. Every decision is logged." />
      {pending.length === 0 ? (
        <EmptyState icon={<ShieldCheck aria-hidden />} title="Nothing waiting" description="New verification requests from employers will appear here." />
      ) : (
        <ul className="space-y-4">
          {pending.map((r) => {
            const c = r.companies;
            const priv = Array.isArray(c?.company_private) ? c?.company_private[0] : c?.company_private;
            return (
              <li key={r.id}>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle>{c?.name}</CardTitle>
                      <Badge variant="warning">Requested {formatDateTime(r.created_at)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[c?.industry, c?.location].filter(Boolean).join(" · ")}
                      {c?.website ? (
                        <>
                          {" · "}
                          <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="text-link underline">
                            {c.website}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <div><dt className="text-muted-foreground">Account owner</dt><dd className="font-medium">{c?.profiles?.full_name} · {c?.profiles?.email}</dd></div>
                      <div><dt className="text-muted-foreground">Registration number</dt><dd className="font-medium">{priv?.registration_number || "Not provided"}</dd></div>
                      <div><dt className="text-muted-foreground">Registration details</dt><dd className="font-medium">{priv?.registration_details || "Not provided"}</dd></div>
                      <div><dt className="text-muted-foreground">Authorised representative</dt><dd className="font-medium">{[priv?.rep_name, priv?.rep_title].filter(Boolean).join(", ") || "Not provided"}{priv?.rep_phone ? ` · ${priv.rep_phone}` : ""}</dd></div>
                    </dl>
                    {c?.description ? <p className="rounded-lg bg-surface-muted p-3 text-sm">{c.description}</p> : null}
                    {r.note ? <p className="rounded-lg bg-info-soft p-3 text-sm text-info-soft-foreground"><strong>Note from employer:</strong> {r.note}</p> : null}
                    <div>
                      <p className="mb-2 text-sm font-semibold">Documents</p>
                      <VerificationDocs paths={r.document_paths} />
                    </div>
                    <VerificationDecision requestId={r.id} />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 ? (
        <>
          <h2 className="mb-3 mt-8 font-heading text-lg font-semibold">Recently reviewed</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">{r.companies?.name}</p>
                  <p className="text-xs text-muted-foreground">Reviewed {formatDate(r.reviewed_at)}{r.reason ? ` · ${r.reason}` : ""}</p>
                </div>
                {r.status === "approved" ? <VerifiedBadge /> : <Badge variant="danger">Rejected</Badge>}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
