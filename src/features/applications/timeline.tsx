import { Check, X } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import type { ApplicationEventRow, ApplicationStatus } from "@/types/db";
import { STATUS_LABEL, TIMELINE_STEPS } from "./status";

/** Progress stepper: Submitted → Under review → Shortlisted → Interview invited → Offer made → Accepted. */
export function StatusStepper({ status, events }: { status: ApplicationStatus; events: ApplicationEventRow[] }) {
  const reached = new Set(events.map((e) => e.to_status));
  const terminalBad = status === "unsuccessful" || status === "withdrawn";
  const currentIndex = TIMELINE_STEPS.indexOf(status);
  // For a failed application, the last reached happy-path step marks where it stopped.
  const lastReached = terminalBad ? Math.max(...TIMELINE_STEPS.map((s, i) => (reached.has(s) ? i : -1))) : currentIndex;

  return (
    <div>
      <ol className="grid grid-cols-6 gap-1" aria-label="Application progress">
        {TIMELINE_STEPS.map((step, i) => {
          const done = i < lastReached || (i === lastReached && (status === "accepted" || terminalBad));
          const current = i === lastReached && !terminalBad && status !== "accepted";
          return (
            <li key={step} className="flex flex-col items-center gap-1.5 text-center" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full border-2 text-xs font-bold",
                  done && "border-success bg-success text-success-foreground",
                  current && "border-cta bg-cta text-cta-foreground",
                  !done && !current && "border-border bg-surface text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("text-[10px] font-medium leading-tight sm:text-xs", current || done ? "text-foreground" : "text-muted-foreground")}>
                {STATUS_LABEL[step]}
              </span>
            </li>
          );
        })}
      </ol>
      {terminalBad ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          <X className="size-4" aria-hidden /> {STATUS_LABEL[status]}
        </p>
      ) : null}
    </div>
  );
}

export function EventLog({ events }: { events: ApplicationEventRow[] }) {
  if (events.length === 0) return null;
  return (
    <ol className="space-y-3 border-l-2 border-border pl-4">
      {[...events]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[1.4rem] top-1 size-2.5 rounded-full bg-cta ring-4 ring-background" aria-hidden />
            <p className="text-sm font-semibold">{STATUS_LABEL[e.to_status]}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p>
            {e.note ? <p className="mt-1 whitespace-pre-line rounded-lg bg-surface-muted p-2.5 text-sm">{e.note}</p> : null}
          </li>
        ))}
    </ol>
  );
}
