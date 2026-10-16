"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { Select } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";
import { withOfflineFallback } from "@/lib/offline-cache";
import { formatDate, timeAgo } from "@/lib/utils";
import { ScorePill } from "@/features/matching/match-card";
import type { ApplicationStatus, OpportunityType } from "@/types/db";
import { StatusBadge } from "./status-badge";
import { STATUS_LABEL } from "./status";

export interface ApplicationListItem {
  id: string;
  status: ApplicationStatus;
  submitted_at: string;
  status_changed_at: string;
  match_score: number | null;
  opportunities: {
    id: string;
    title: string;
    type: OpportunityType;
    deadline: string;
    location: string;
    companies: { name: string } | null;
  } | null;
}

const PAGE = 20;

export function CandidateApplications({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [filter, setFilter] = React.useState<ApplicationStatus | "all">("all");
  const [page, setPage] = React.useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["applications", userId],
    queryFn: withOfflineFallback<ApplicationListItem[]>(userId, "applications", async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, status, submitted_at, status_changed_at, match_score, opportunities(id, title, type, deadline, location, companies(name))")
        .eq("candidate_id", userId)
        .order("status_changed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ApplicationListItem[];
    }),
  });

  if (isLoading) return <SkeletonList />;
  if (error || !data) return <EmptyState title="Couldn't load your applications" description="Check your connection and try again." />;

  const items = data.data.filter((a) => filter === "all" || a.status === filter);
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const visible = items.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="space-y-4">
      {data.stale ? (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium text-warning-soft-foreground">
          <CloudOff className="size-4" aria-hidden /> Offline: showing your saved copy (read-only).
        </p>
      ) : null}
      <div className="max-w-xs">
        <label className="sr-only" htmlFor="status-filter">
          Filter by status
        </label>
        <Select
          id="status-filter"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as ApplicationStatus | "all");
            setPage(1);
          }}
        >
          <option value="all">All statuses ({data.data.length})</option>
          {(Object.keys(STATUS_LABEL) as ApplicationStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ClipboardList aria-hidden />}
          title={data.data.length === 0 ? "No applications yet" : "Nothing with that status"}
          description={data.data.length === 0 ? "Find an opportunity that fits and apply in one tap." : undefined}
          action={
            data.data.length === 0 ? (
              <Button asChild variant="cta">
                <Link href="/candidate/opportunities">Browse opportunities</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((a) => (
            <li key={a.id} className="relative rounded-xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-heading text-base font-semibold leading-snug">
                    <Link href={`/candidate/applications/${a.id}`} className="after:absolute after:inset-0">
                      {a.opportunities?.title ?? "Opportunity"}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {a.opportunities?.companies?.name} · {a.opportunities?.location}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Applied {formatDate(a.submitted_at)}</span>
                <span>Updated {timeAgo(a.status_changed_at)}</span>
                <ScorePill score={a.match_score} />
              </p>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
