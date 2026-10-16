"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Flag, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/form";
import { reportAction } from "@/features/applications/actions";
import { toggleSaveAction } from "./actions";

export function SaveButton({ opportunityId, saved }: { opportunityId: string; saved: boolean }) {
  const router = useRouter();
  const [isSaved, setSaved] = React.useState(saved);
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={isSaved}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const next = !isSaved;
          const r = await toggleSaveAction(opportunityId, next);
          if (r.ok) {
            setSaved(next);
            toast.success(next ? "Saved. We'll remind you before the deadline." : "Removed from saved");
            router.refresh();
          } else toast.error(r.error ?? "Could not update");
        })
      }
    >
      {isSaved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
      {isSaved ? "Saved" : "Save"}
    </Button>
  );
}

export function ShareButton({ title }: { title: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        const url = window.location.href.replace("/candidate/opportunities/", "/opportunities/");
        try {
          if (navigator.share) await navigator.share({ title, text: `${title} on Mukana`, url });
          else {
            await navigator.clipboard.writeText(url);
            toast.success("Link copied");
          }
        } catch {
          /* user cancelled */
        }
      }}
    >
      <Share2 aria-hidden /> Share
    </Button>
  );
}

const REASONS = [
  { value: "scam_or_fee", label: "Scam, or asks candidates to pay" },
  { value: "misleading", label: "Misleading or false information" },
  { value: "discriminatory", label: "Discriminatory" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "duplicate", label: "Duplicate or spam" },
  { value: "other", label: "Something else" },
] as const;

export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: "opportunity" | "company"; targetId: string; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<(typeof REASONS)[number]["value"]>("misleading");
  const [details, setDetails] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-muted-foreground">
        <Flag aria-hidden /> {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Report this ${targetType}`} description="Tell us what's wrong. A Mukana moderator will review it.">
        <div className="space-y-4">
          <Field label="Reason" htmlFor="report-reason">
            <Select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Details (optional)" htmlFor="report-details">
            <Textarea id="report-details" rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await reportAction({ targetType, targetId, reason, details });
                  if (r.ok) {
                    toast.success(r.message ?? "Reported");
                    setOpen(false);
                    setDetails("");
                  } else toast.error(r.error ?? "Could not send");
                })
              }
            >
              Send report
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
