"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { applyAction } from "@/features/applications/actions";
import { StatusBadge } from "@/features/applications/status-badge";
import type { ApplicationStatus, Completeness } from "@/types/db";

export function ApplyPanel({
  opportunityId,
  open,
  closedReason,
  emailVerified,
  completeness,
  application,
  trackBase = "/candidate/applications",
}: {
  opportunityId: string;
  open: boolean;
  closedReason?: string;
  emailVerified: boolean;
  completeness: Completeness;
  application: { id: string; status: ApplicationStatus } | null;
  trackBase?: string;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  if (application) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <p className="flex items-center gap-2 font-heading font-semibold">
          <CheckCircle2 className="size-5 text-success-soft-foreground" aria-hidden /> You&apos;ve applied
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          Status: <StatusBadge status={application.status} />
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href={`${trackBase}/${application.id}`}>Track my application</Link>
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Lock className="size-4" aria-hidden /> Applications are closed
        </p>
        <p className="mt-1 text-muted-foreground">{closedReason ?? "This opportunity is no longer accepting applications."}</p>
      </div>
    );
  }

  const blocked = !completeness.complete || !emailVerified;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-heading font-semibold">Apply with your Mukana profile</h2>
      {!emailVerified ? (
        <p role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          Verify your email address to apply. Check your inbox for the confirmation link.
        </p>
      ) : null}
      {!completeness.complete ? (
        <div role="alert" className="rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          <p className="font-semibold">Your profile is {completeness.percent}% complete.</p>
          <p className="mt-1">Still needed: {completeness.missing.join(", ")}.</p>
          <Link href="/candidate/profile/edit" className="mt-2 inline-block font-semibold underline">
            Complete your profile
          </Link>
        </div>
      ) : null}
      <Field label="Cover note (optional)" htmlFor="cover-note" hint="A few lines on why you are a good fit. Max 2000 characters.">
        <Textarea id="cover-note" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} disabled={blocked} />
      </Field>
      <Button
        type="button"
        variant="cta"
        size="lg"
        className="w-full"
        disabled={blocked}
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await applyAction(opportunityId, note);
            if (r.ok) {
              toast.success("Application submitted. Good luck!");
              router.push(`${trackBase}/${r.applicationId}`);
              router.refresh();
            } else toast.error(r.error ?? "Could not submit your application");
          })
        }
      >
        <Send aria-hidden /> Apply now
      </Button>
      <p className="text-xs text-muted-foreground">Your profile, CV and placement letter will be shared with this employer.</p>
    </div>
  );
}
