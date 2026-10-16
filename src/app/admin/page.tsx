import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, ClipboardList, Flag, Send, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL } from "@/features/applications/status";
import type { ApplicationStatus } from "@/types/db";

export const metadata: Metadata = { title: "Admin overview" };

interface Stats {
  users: { candidates: number; employers: number; admins: number; suspended: number; new_30d: number };
  companies: { verified: number; pending: number; suspended: number };
  opportunities: { published: number; closed: number; draft: number; attachments: number; trainee: number };
  applications: { total: number; new_30d: number; accepted: number; by_status: Record<string, number> };
  reports: { open: number };
  signups_by_week: { week: string; count: number }[];
}

export default async function AdminOverview() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_stats");
  const s = data as Stats | null;
  if (!s) return <p className="text-sm text-muted-foreground">Statistics are unavailable right now.</p>;

  const tiles = [
    { label: "Candidates", value: s.users.candidates, sub: `${s.users.new_30d} new in 30 days`, icon: Users, href: "/admin/users" },
    { label: "Employers", value: s.users.employers, sub: `${s.companies.verified} verified`, icon: Building2, href: "/admin/users" },
    { label: "Pending verifications", value: s.companies.pending, sub: "Awaiting review", icon: BadgeCheck, href: "/admin/verifications" },
    { label: "Open reports", value: s.reports.open, sub: "Need a decision", icon: Flag, href: "/admin/reports" },
    { label: "Published opportunities", value: s.opportunities.published, sub: `${s.opportunities.attachments} attachment · ${s.opportunities.trainee} trainee`, icon: ClipboardList, href: "/opportunities" },
    { label: "Applications", value: s.applications.total, sub: `${s.applications.new_30d} in 30 days · ${s.applications.accepted} accepted`, icon: Send, href: "/admin" },
  ];
  const maxWeek = Math.max(1, ...s.signups_by_week.map((w) => w.count));
  const statuses = Object.entries(s.applications.by_status).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader title="Platform overview" description="Live statistics and moderation queues." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="group rounded-xl focus-visible:outline-2">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardContent className="flex items-start gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-info-soft text-info-soft-foreground">
                  <t.icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-2xl font-semibold leading-none">{t.value}</p>
                  <p className="mt-1 text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.sub}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Sign-ups, last 8 weeks</CardTitle>
          </CardHeader>
          <CardContent>
            {s.signups_by_week.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sign-ups yet.</p>
            ) : (
              <ul className="space-y-2">
                {s.signups_by_week.map((w) => (
                  <li key={w.week} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{new Date(w.week).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-cta" style={{ width: `${(w.count / maxWeek) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums font-medium">{w.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Applications by status</CardTitle>
          </CardHeader>
          <CardContent>
            {statuses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              <ul className="space-y-2">
                {statuses.map(([status, n]) => (
                  <li key={status} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-3 text-sm">
                    <span>{STATUS_LABEL[status as ApplicationStatus] ?? status}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-blue" style={{ width: `${(n / Math.max(1, s.applications.total)) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums font-medium">{n}</span>
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
