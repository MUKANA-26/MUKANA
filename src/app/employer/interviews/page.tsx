import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Link2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { getInterviews, type UpcomingInterview } from "@/features/employer/queries";

export const metadata: Metadata = { title: "Interviews" };

const variant = { scheduled: "warning", confirmed: "success", declined: "danger", completed: "neutral", cancelled: "neutral" } as const;

function InterviewList({ items }: { items: UpcomingInterview[] }) {
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-heading font-semibold">
                <CalendarClock className="size-4" aria-hidden /> {formatDateTime(i.scheduled_at)}
                <span className="text-sm font-normal text-muted-foreground">· {i.duration_minutes} min</span>
              </p>
              <p className="mt-1 text-sm">
                <Link href={`/employer/applicants/${i.applications?.id}`} className="font-semibold text-link hover:underline">
                  {i.applications?.profiles?.full_name ?? "Candidate"}
                </Link>{" "}
                · {i.applications?.opportunities?.title}
              </p>
            </div>
            <Badge variant={variant[i.status]}>{i.status[0]!.toUpperCase() + i.status.slice(1)}</Badge>
          </div>
          <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
            {i.mode === "virtual" ? <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span className="break-all">{i.location}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

export default async function EmployerInterviewsPage() {
  await requireRole("employer");
  const [upcoming, past] = await Promise.all([getInterviews("upcoming"), getInterviews("past", 20)]);
  return (
    <>
      <PageHeader title="Interviews" description="Candidates and you are reminded 24 hours before each interview." />
      <h2 className="mb-3 font-heading text-lg font-semibold">Upcoming</h2>
      {upcoming.length === 0 ? (
        <EmptyState icon={<CalendarClock aria-hidden />} title="No upcoming interviews" description="Shortlist a candidate, then choose Invite to interview on their page." />
      ) : (
        <InterviewList items={upcoming} />
      )}
      {past.length > 0 ? (
        <>
          <h2 className="mb-3 mt-8 font-heading text-lg font-semibold">Past</h2>
          <InterviewList items={past} />
        </>
      ) : null}
    </>
  );
}
