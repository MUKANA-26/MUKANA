"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, CloudOff, ExternalLink, Link2, MapPin, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { withOfflineFallback } from "@/lib/offline-cache";
import { formatDate, formatDateTime } from "@/lib/utils";
import { MatchCard } from "@/features/matching/match-card";
import type { ApplicationEventRow, ApplicationRow, InterviewRow, MatchResult } from "@/types/db";
import { candidateApplicationAction, respondToInterviewAction, withdrawOtherAttachmentsAction } from "./actions";
import { StatusBadge } from "./status-badge";
import { canWithdraw } from "./status";
import { EventLog, StatusStepper } from "./timeline";

interface Detail {
  application: ApplicationRow & {
    opportunities: { id: string; title: string; type: "industrial_attachment" | "internship" | "graduate_trainee" | "entry_level"; location: string; start_date: string | null; companies: { name: string } | null } | null;
  };
  events: ApplicationEventRow[];
  interviews: InterviewRow[];
}

export function CandidateApplicationDetail({ userId, applicationId }: { userId: string; applicationId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = React.useState<null | "withdraw" | "decline">(null);
  const [pending, startTransition] = React.useTransition();
  const [offerAccepted, setOfferAccepted] = React.useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["application", applicationId],
    queryFn: withOfflineFallback<Detail>(userId, `application:${applicationId}`, async () => {
      const [app, events, interviews] = await Promise.all([
        supabase
          .from("applications")
          .select("*, opportunities(id, title, type, location, start_date, companies(name))")
          .eq("id", applicationId)
          .eq("candidate_id", userId)
          .maybeSingle(),
        supabase.from("application_events").select("*").eq("application_id", applicationId).order("created_at"),
        supabase.from("interviews").select("*").eq("application_id", applicationId).order("scheduled_at", { ascending: false }),
      ]);
      if (app.error) throw app.error;
      if (!app.data) throw Object.assign(new Error("Application not found"), { status: 404 });
      return {
        application: app.data as unknown as Detail["application"],
        events: (events.data ?? []) as ApplicationEventRow[],
        interviews: (interviews.data ?? []) as InterviewRow[],
      };
    }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
    void queryClient.invalidateQueries({ queryKey: ["applications", userId] });
    router.refresh();
  };

  if (isLoading) return <SkeletonList count={3} />;
  if (error || !data) return <EmptyState title="Application not found" description="It may have been removed, or you're offline and haven't opened it before." action={<Button asChild variant="outline"><Link href="/candidate/applications">Back to applications</Link></Button>} />;

  const { application: a, events, interviews } = data.data;
  const readOnly = data.stale;
  const opp = a.opportunities;
  const openInterview = interviews.find((i) => (i.status === "scheduled" || i.status === "confirmed") && new Date(i.scheduled_at) > new Date());

  const act = (action: "withdraw" | "accept" | "decline") =>
    startTransition(async () => {
      const r = await candidateApplicationAction(a.id, action);
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
      toast.success(r.message ?? "Done");
      setConfirm(null);
      if (action === "accept" && opp?.type === "industrial_attachment") setOfferAccepted(true);
      refresh();
    });

  const respond = (interviewId: string, accept: boolean) =>
    startTransition(async () => {
      const r = await respondToInterviewAction(interviewId, accept);
      if (r.ok) {
        toast.success(r.message ?? "Done");
        refresh();
      } else toast.error(r.error ?? "Something went wrong");
    });

  return (
    <div className="space-y-5">
      {readOnly ? (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium text-warning-soft-foreground">
          <CloudOff className="size-4" aria-hidden /> Offline: showing your saved copy. Actions are disabled until you reconnect.
        </p>
      ) : null}

      <header className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-semibold sm:text-2xl">{opp?.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {opp?.companies?.name} · {opp?.location}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Applied {formatDate(a.submitted_at)}</p>
          </div>
          <StatusBadge status={a.status} />
        </div>
        <div className="mt-5">
          <StatusStepper status={a.status} events={events} />
        </div>
        {opp ? (
          <Button asChild variant="link" size="sm" className="mt-3">
            <Link href={`/candidate/opportunities/${opp.id}`}>
              View opportunity <ExternalLink aria-hidden />
            </Link>
          </Button>
        ) : null}
      </header>

      {a.status === "offer_made" ? (
        <Card className="border-cta">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PartyPopper className="size-5 text-cta" aria-hidden /> You have an offer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              {opp?.companies?.name} would like you to join as <strong>{opp?.title}</strong>. Read their message below, then accept or decline.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="success" size="lg" loading={pending} disabled={readOnly} onClick={() => act("accept")}>
                Accept offer
              </Button>
              <Button variant="outline" size="lg" disabled={readOnly || pending} onClick={() => setConfirm("decline")}>
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {a.status === "accepted" || offerAccepted ? (
        <OtherAttachmentsPrompt applicationId={a.id} isAttachment={opp?.type === "industrial_attachment"} onDone={refresh} initiallyOpen={offerAccepted} />
      ) : null}

      {interviews.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Interview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {interviews.slice(0, 3).map((i) => {
              const upcoming = new Date(i.scheduled_at) > new Date();
              const canRespond = (i.status === "scheduled" || i.status === "confirmed") && upcoming && !readOnly;
              return (
                <div key={i.id} className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <CalendarClock className="size-4" aria-hidden /> {formatDateTime(i.scheduled_at)} · {i.duration_minutes} min
                    </p>
                    <Badge variant={i.status === "confirmed" ? "success" : i.status === "scheduled" ? "warning" : "neutral"}>
                      {i.status[0]!.toUpperCase() + i.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="flex items-start gap-2 text-sm">
                    {i.mode === "virtual" ? <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />}
                    {i.mode === "virtual" && /^https?:\/\//.test(i.location) ? (
                      <a href={i.location} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-link underline">
                        Join the meeting
                      </a>
                    ) : (
                      <span>{i.location}</span>
                    )}
                  </p>
                  {i.instructions ? <p className="whitespace-pre-line rounded-lg bg-surface-muted p-2.5 text-sm">{i.instructions}</p> : null}
                  {canRespond ? (
                    <div className="flex flex-wrap gap-2">
                      {i.status === "scheduled" ? (
                        <Button size="sm" variant="success" disabled={pending} onClick={() => respond(i.id, true)}>
                          Confirm attendance
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => respond(i.id, false)}>
                        Can&apos;t make it
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <EventLog events={events} />
          {a.cover_note ? (
            <div className="mt-4">
              <p className="text-sm font-semibold">Your cover note</p>
              <p className="mt-1 whitespace-pre-line rounded-lg bg-surface-muted p-3 text-sm">{a.cover_note}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {a.match_breakdown ? <MatchCard match={a.match_breakdown as MatchResult} /> : null}

      {canWithdraw(a.status) ? (
        <div className="flex justify-end">
          <Button variant="outline" disabled={readOnly} onClick={() => setConfirm("withdraw")}>
            Withdraw application
          </Button>
        </div>
      ) : null}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "decline" ? "Decline this offer?" : "Withdraw your application?"}
        description={confirm === "decline" ? "The employer will be told you declined. This can't be undone." : "The employer will be notified. This can't be undone."}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(null)}>
            Keep it
          </Button>
          <Button variant="destructive" loading={pending} onClick={() => act(confirm === "decline" ? "decline" : "withdraw")}>
            {confirm === "decline" ? "Decline offer" : "Withdraw"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/** After accepting an attachment offer, offer to withdraw the candidate's other pending attachment applications. */
function OtherAttachmentsPrompt({
  applicationId,
  isAttachment,
  onDone,
  initiallyOpen,
}: {
  applicationId: string;
  isAttachment: boolean;
  onDone: () => void;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = React.useState(initiallyOpen && isAttachment);
  const [pending, startTransition] = React.useTransition();
  return (
    <>
      <div className="rounded-xl border border-success bg-success-soft p-4 text-success-soft-foreground">
        <p className="flex items-center gap-2 font-heading font-semibold">
          <PartyPopper className="size-5" aria-hidden /> Congratulations, you accepted this offer!
        </p>
        {isAttachment ? (
          <Button variant="outline" size="sm" className="mt-3 bg-surface text-foreground" onClick={() => setOpen(true)}>
            Withdraw my other attachment applications
          </Button>
        ) : null}
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Withdraw your other applications?"
        description="You accepted an attachment offer. Do you want to withdraw your other pending attachment applications so employers aren't kept waiting?"
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button
            variant="default"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await withdrawOtherAttachmentsAction(applicationId);
                if (r.ok) {
                  toast.success(r.count ? `Withdrew ${r.count} application${r.count === 1 ? "" : "s"}` : "You have no other pending attachment applications");
                  setOpen(false);
                  onDone();
                } else toast.error(r.error ?? "Could not withdraw");
              })
            }
          >
            Withdraw them
          </Button>
        </div>
      </Dialog>
    </>
  );
}
