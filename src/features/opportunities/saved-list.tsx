"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { withOfflineFallback } from "@/lib/offline-cache";
import type { OpportunityWithCompany } from "@/types/db";
import { OpportunityCard } from "./opportunity-card";

const PAGE = 20;

export function SavedList({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [page, setPage] = React.useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["saved", userId],
    queryFn: withOfflineFallback<OpportunityWithCompany[]>(userId, "saved", async () => {
      const { data, error } = await supabase
        .from("saved_opportunities")
        .select("created_at, opportunities(*, companies(id, name, logo_path, verification_status, industry, location))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as unknown as { opportunities: OpportunityWithCompany | null }[])
        .map((r) => r.opportunities)
        .filter((o): o is OpportunityWithCompany => Boolean(o));
    }),
  });

  if (isLoading) return <SkeletonList />;
  if (error || !data) return <EmptyState title="Couldn't load your saved opportunities" description="Check your connection and try again." />;

  const items = data.data;
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const visible = items.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="space-y-4">
      {data.stale ? (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium text-warning-soft-foreground">
          <CloudOff className="size-4" aria-hidden /> Offline: showing your saved copy (read-only).
        </p>
      ) : null}
      {visible.length === 0 ? (
        <EmptyState
          icon={<Bookmark aria-hidden />}
          title="No saved opportunities"
          description="Tap Save on an opportunity and we'll remind you 3 days and 1 day before the deadline."
          action={
            <Button asChild variant="cta">
              <Link href="/candidate/opportunities">Browse opportunities</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((o) => (
            <li key={o.id} className="relative">
              <OpportunityCard opportunity={o} href={`/candidate/opportunities/${o.id}`} />
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
