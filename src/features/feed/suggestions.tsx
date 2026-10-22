"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, BriefcaseBusiness, MapPin, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAvatarUrls } from "@/lib/avatars-client";
import { createClient } from "@/lib/supabase/client";
import { TYPE_LABEL, type OpportunityType } from "@/lib/opportunity-types";
import { useNetworkActions } from "@/features/network/use-network-actions";

interface Job {
  id: string;
  title: string;
  location: string;
  type: OpportunityType;
  company: string;
  score: number;
  reason: string | null;
}
interface Person {
  id: string;
  full_name: string;
  headline: string | null;
  company_name: string | null;
  verified_badge: boolean | null;
  avatar_path: string | null;
  reason: string | null;
}

/** "Jobs for you" and "People you may know", fetched in one call and shown above the For-you feed. */
export function FeedSuggestions({ role }: { role: "candidate" | "employer" | "admin" }) {
  const supabase = React.useMemo(() => createClient(), []);
  const actions = useNetworkActions();
  const [sent, setSent] = React.useState<Set<string>>(new Set());
  const { data } = useQuery({
    queryKey: ["feed", "suggestions"],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc("feed_suggestions");
      if (error) throw error;
      return d as { jobs: Job[]; people: Person[] };
    },
  });
  const avatars = useAvatarUrls((data?.people ?? []).map((p) => p.avatar_path));
  if (!data || (data.jobs.length === 0 && data.people.length === 0)) return null;

  return (
    <aside aria-label="Suggested for you" className="space-y-4 border-b border-border px-4 py-4">
      {data.jobs.length > 0 && role === "candidate" ? (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BriefcaseBusiness className="size-4 text-link" aria-hidden /> Opportunities picked for you
          </h2>
          <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
            {data.jobs.map((j) => (
              <li key={j.id} className="w-60 shrink-0 snap-start">
                <Link href={`/candidate/opportunities/${j.id}`} className="block h-full rounded-2xl border border-border p-3 hover:bg-surface-muted/60">
                  <p className="flex items-center justify-between gap-2">
                    <Badge variant="info">{TYPE_LABEL[j.type] ?? "Opportunity"}</Badge>
                    <span className="text-sm font-bold text-success">{j.score}%</span>
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold">{j.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{j.company}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" aria-hidden /> {j.location}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.people.length > 0 ? (
        <section>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="size-4 text-link" aria-hidden /> People you may know
          </h2>
          <ul className="divide-y divide-border">
            {data.people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <Link href={`/people/${p.id}`} aria-label={`View ${p.full_name}`}>
                  <Avatar url={p.avatar_path ? (avatars[p.avatar_path] ?? null) : null} name={p.full_name} size="sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/people/${p.id}`} className="flex items-center gap-1 text-sm font-semibold hover:underline">
                    <span className="truncate">{p.full_name}</span>
                    {p.verified_badge ? <BadgeCheck className="size-4 shrink-0 text-link" aria-label="Verified" /> : null}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{p.headline ?? p.company_name ?? p.reason}</p>
                </div>
                {sent.has(p.id) ? (
                  <span className="text-xs text-muted-foreground">Sent</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={actions.busy === `connect:${p.id}`}
                    onClick={async () => {
                      if (await actions.connect(p.id)) setSent((s) => new Set(s).add(p.id));
                    }}
                  >
                    Connect
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
