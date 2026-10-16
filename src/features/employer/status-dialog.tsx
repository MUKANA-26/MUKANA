"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";
import { setApplicationStatusAction } from "@/features/applications/actions";
import { STATUS_LABEL } from "@/features/applications/status";
import { PLACEHOLDERS, TEMPLATE_FOR_STATUS, renderTemplate, type MessageTemplate, type TemplateContext, type TemplateKind } from "@/features/applications/templates";
import type { ApplicationStatus } from "@/types/db";

export type ChangeableStatus = "under_review" | "shortlisted" | "offer_made" | "unsuccessful";

/**
 * Confirms a status change for one or many applicants. The message is pre-filled from the matching
 * template and fully editable before sending. {{placeholders}} are filled in per applicant on the server.
 */
export function StatusChangeDialog({
  open,
  onClose,
  ids,
  status,
  templates,
  preview,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  ids: string[];
  status: ChangeableStatus | null;
  templates: Record<TemplateKind, MessageTemplate>;
  /** For a single applicant, shows the message with real names filled in. */
  preview?: TemplateContext;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [send, setSend] = React.useState(true);
  const [pending, startTransition] = React.useTransition();
  const kind = status ? TEMPLATE_FOR_STATUS[status] : undefined;

  React.useEffect(() => {
    if (!open || !status) return;
    const t = kind ? templates[kind].body : "";
    setText(preview && t ? renderTemplate(t, preview) : t);
    setSend(Boolean(kind));
  }, [open, status, kind, templates, preview]);

  if (!status) return null;
  const label = STATUS_LABEL[status as ApplicationStatus];
  const many = ids.length > 1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Mark ${many ? `${ids.length} applicants` : "applicant"} as "${label}"`}
      description="The candidate is notified in the app, by push and, for offers, by email."
      className="max-w-lg"
    >
      <div className="space-y-4">
        {kind ? (
          <>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4" checked={send} onChange={(e) => setSend(e.target.checked)} />
              Include a message ({templates[kind].subject})
            </label>
            {send ? (
              <Field
                label="Message"
                htmlFor="status-message"
                hint={many ? `Placeholders are filled in for each person: ${PLACEHOLDERS.map((p) => p.token).join(", ")}` : undefined}
              >
                <Textarea id="status-message" rows={9} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
              </Field>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">The candidate will see the new status in their timeline.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={status === "unsuccessful" ? "destructive" : "cta"}
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await setApplicationStatusAction(ids, status, send ? text : undefined);
                if (r.ok) {
                  toast.success(r.message ?? "Updated");
                  onClose();
                  onDone?.();
                  router.refresh();
                } else toast.error(r.error ?? "Could not update");
              })
            }
          >
            Confirm
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
