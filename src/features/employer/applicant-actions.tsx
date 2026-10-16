"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, FileText, Gavel, ThumbsDown, ThumbsUp, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PdfViewerDialog, type PdfTarget } from "@/features/files/pdf-viewer-dialog";
import { cancelInterviewAction, scheduleInterviewAction } from "@/features/applications/actions";
import { EMPLOYER_NEXT } from "@/features/applications/status";
import { renderTemplate, type MessageTemplate, type TemplateContext, type TemplateKind } from "@/features/applications/templates";
import type { ApplicationStatus, InterviewRow } from "@/types/db";
import { StatusChangeDialog, type ChangeableStatus } from "./status-dialog";

/** Local `YYYY-MM-DDTHH:mm` for a datetime-local input, defaulting to tomorrow 10:00. */
function defaultWhen() {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ApplicantActions({
  applicationId,
  status,
  templates,
  context,
  cvPath,
  placementPath,
  candidateName,
  openInterview,
}: {
  applicationId: string;
  status: ApplicationStatus;
  templates: Record<TemplateKind, MessageTemplate>;
  context: TemplateContext;
  cvPath: string | null;
  placementPath: string | null;
  candidateName: string;
  openInterview: InterviewRow | null;
}) {
  const router = useRouter();
  const [viewer, setViewer] = React.useState<PdfTarget | null>(null);
  const [target, setTarget] = React.useState<ChangeableStatus | null>(null);
  const [scheduling, setScheduling] = React.useState(false);
  const next = EMPLOYER_NEXT[status];
  const canSchedule = ["under_review", "shortlisted", "interview_invited"].includes(status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!cvPath} onClick={() => cvPath && setViewer({ bucket: "cvs", path: cvPath, title: `${candidateName} — CV` })}>
          <FileText aria-hidden /> View CV
        </Button>
        {placementPath ? (
          <Button variant="outline" onClick={() => setViewer({ bucket: "placement-letters", path: placementPath, title: `${candidateName} — Placement letter` })}>
            <FileText aria-hidden /> Placement letter
          </Button>
        ) : null}
      </div>

      {next.length > 0 || canSchedule ? (
        <div className="flex flex-wrap gap-2">
          {next.includes("under_review") ? (
            <Button variant="secondary" onClick={() => setTarget("under_review")}>
              <UserCheck aria-hidden /> Under review
            </Button>
          ) : null}
          {next.includes("shortlisted") ? (
            <Button variant="secondary" onClick={() => setTarget("shortlisted")}>
              <ThumbsUp aria-hidden /> Shortlist
            </Button>
          ) : null}
          {canSchedule ? (
            <Button variant="default" onClick={() => setScheduling(true)}>
              <CalendarPlus aria-hidden /> {status === "interview_invited" ? "Reschedule interview" : "Invite to interview"}
            </Button>
          ) : null}
          {next.includes("offer_made") ? (
            <Button variant="cta" onClick={() => setTarget("offer_made")}>
              <Gavel aria-hidden /> Make offer
            </Button>
          ) : null}
          {next.includes("unsuccessful") ? (
            <Button variant="outline" onClick={() => setTarget("unsuccessful")}>
              <ThumbsDown aria-hidden /> {status === "offer_made" ? "Rescind offer" : "Reject"}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No further actions: this application is {status.replace("_", " ")}.</p>
      )}

      {openInterview ? <CancelInterview id={openInterview.id} onDone={() => router.refresh()} /> : null}

      <StatusChangeDialog open={target !== null} onClose={() => setTarget(null)} ids={[applicationId]} status={target} templates={templates} preview={context} />
      <ScheduleInterviewDialog open={scheduling} onClose={() => setScheduling(false)} applicationId={applicationId} template={templates.interview} context={context} />
      <PdfViewerDialog target={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

function CancelInterview({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await cancelInterviewAction(id);
          if (r.ok) {
            toast.success(r.message ?? "Cancelled");
            onDone();
          } else toast.error(r.error ?? "Could not cancel");
        })
      }
    >
      Cancel the scheduled interview
    </Button>
  );
}

function ScheduleInterviewDialog({
  open,
  onClose,
  applicationId,
  template,
  context,
}: {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  template: MessageTemplate;
  context: TemplateContext;
}) {
  const router = useRouter();
  const [when, setWhen] = React.useState(defaultWhen);
  const [duration, setDuration] = React.useState("45");
  const [mode, setMode] = React.useState<"physical" | "virtual">("physical");
  const [location, setLocation] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setMessage(renderTemplate(template.body, context));
      setWhen(defaultWhen());
      setError(null);
    }
  }, [open, template, context]);

  return (
    <Dialog open={open} onClose={onClose} title="Schedule interview" description="The candidate is notified immediately and reminded 24 hours before." className="max-w-lg">
      <div className="max-h-[70dvh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date and time" htmlFor="iv-when" required>
            <Input id="iv-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field label="Duration" htmlFor="iv-duration">
            <Select id="iv-duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Format" htmlFor="iv-mode">
          <Select id="iv-mode" value={mode} onChange={(e) => setMode(e.target.value as "physical" | "virtual")}>
            <option value="physical">Physical (in person)</option>
            <option value="virtual">Virtual (online)</option>
          </Select>
        </Field>
        <Field label={mode === "virtual" ? "Meeting link" : "Address"} htmlFor="iv-location" required hint={mode === "virtual" ? "Zoom, Google Meet, Teams… starting with https://" : undefined}>
          <Input id="iv-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={mode === "virtual" ? "https://meet.google.com/…" : "Building, street, city"} />
        </Field>
        <Field label="Instructions (optional)" htmlFor="iv-instructions" hint="What to bring, who to ask for, dress code…">
          <Textarea id="iv-instructions" rows={2} value={instructions} maxLength={2000} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
        <Field label="Message to the candidate" htmlFor="iv-message">
          <Textarea id="iv-message" rows={6} value={message} maxLength={4000} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        {error ? (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="cta"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const date = new Date(when);
                if (Number.isNaN(date.getTime())) return setError("Choose a valid date and time");
                const r = await scheduleInterviewAction({
                  applicationId,
                  scheduledAt: date.toISOString(),
                  durationMinutes: Number(duration),
                  mode,
                  location,
                  instructions,
                  message,
                });
                if (!r.ok) return setError(r.error ?? "Could not schedule");
                toast.success(r.message ?? "Scheduled");
                onClose();
                router.refresh();
              })
            }
          >
            Send invitation
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
