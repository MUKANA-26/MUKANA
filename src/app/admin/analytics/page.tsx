import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Platform analytics" };

interface Point {
  day: string;
  count: number;
}
interface Named {
  name: string;
  count: number;
}
interface Analytics {
  totals: Record<string, number>;
  series: { signups: Point[]; applications: Point[]; posts: Point[] };
  top_skills: Named[];
  top_institutions: Named[];
  opportunity_types: Named[];
  application_funnel: Named[];
}

const TOTAL_LABELS: [string, string][] = [
  ["members", "Members"],
  ["candidates", "Candidates"],
  ["employers", "Employers"],
  ["opportunities_open", "Open opportunities"],
  ["applications", "Applications"],
  ["connections", "Connections"],
  ["posts", "Feed posts"],
  ["messages", "Messages"],
  ["badges", "Skill badges"],
];

function Bars({ points, label }: { points: Point[]; label: string }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const total = points.reduce((s, p) => s + p.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <p className="text-sm text-muted-foreground">{total} in the last 30 days</p>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="flex h-24 items-end gap-0.5" role="img" aria-label={`${label}: ${total} in the last 30 days`}>
            {points.map((p) => (
              <div key={p.day} title={`${p.day}: ${p.count}`} className="min-w-1 flex-1 rounded-t bg-link" style={{ height: `${Math.max(6, (p.count / max) * 100)}%` }} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Ranked({ title, items }: { title: string; items: Named[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.name} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate capitalize">{i.name.replace(/_/g, " ")}</span>
                  <span className="font-semibold">{i.count}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full bg-cta" style={{ width: `${(i.count / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AnalyticsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_analytics", { p_days: 30 });
  const a = data as Analytics | null;
  return (
    <>
      <PageHeader title="Platform analytics" description="How Mukana is growing and what members are doing." />
      {!a ? (
        <p className="text-sm text-muted-foreground">Analytics are unavailable right now.</p>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {TOTAL_LABELS.map(([key, label]) => (
              <div key={key} className="rounded-xl border border-border bg-surface p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-heading text-2xl font-semibold">{Number(a.totals[key] ?? 0).toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-4 md:grid-cols-3">
            <Bars points={a.series.signups} label="New members" />
            <Bars points={a.series.applications} label="Applications" />
            <Bars points={a.series.posts} label="Feed posts" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Ranked title="Top candidate skills" items={a.top_skills} />
            <Ranked title="Top institutions" items={a.top_institutions} />
            <Ranked title="Open opportunities by type" items={a.opportunity_types} />
            <Ranked title="Application stages" items={a.application_funnel} />
          </div>
        </div>
      )}
    </>
  );
}
