import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };

const PAGE = 30;
interface Entry {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole("admin");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("audit_log")
    .select("id, action, target_type, target_id, details, created_at, profiles!audit_log_admin_id_fkey(full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  const entries = (data ?? []) as unknown as Entry[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  return (
    <>
      <PageHeader title="Audit log" description="Every administrator action, newest first. This log can't be edited." />
      {entries.length === 0 ? (
        <EmptyState icon={<ScrollText aria-hidden />} title="Nothing logged yet" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {entries.map((e) => {
            const reason = (e.details?.reason ?? e.details?.note) as string | undefined;
            return (
              <li key={e.id} className="p-3 text-sm sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs font-semibold">{e.action}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p>
                </div>
                <p className="mt-1">
                  <span className="font-medium">{e.profiles?.full_name ?? "Unknown admin"}</span>
                  <span className="text-muted-foreground"> · {e.target_type}{e.target_id ? ` ${e.target_id.slice(0, 8)}…` : ""}</span>
                </p>
                {reason ? <p className="mt-1 text-muted-foreground">“{reason}”</p> : null}
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-3">
          <Button asChild variant="outline" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={`/admin/audit-log?page=${page - 1}`}>Previous</Link>
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
          <Button asChild variant="outline" className={page >= pages ? "pointer-events-none opacity-50" : ""}>
            <Link href={`/admin/audit-log?page=${page + 1}`}>Next</Link>
          </Button>
        </nav>
      ) : null}
    </>
  );
}
