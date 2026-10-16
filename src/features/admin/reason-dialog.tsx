"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/features/auth/actions";

/** Small confirm dialog that asks for a reason/note, then runs a server action. */
export function ReasonButton({
  label,
  title,
  description,
  confirmLabel,
  variant = "outline",
  size = "sm",
  required = false,
  placeholder,
  run,
  icon,
}: {
  label: string;
  title: string;
  description?: string;
  confirmLabel: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  required?: boolean;
  placeholder?: string;
  run: (reason: string) => Promise<ActionResult>;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const id = React.useId();
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        {icon} {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <div className="space-y-4">
          <Field label={required ? "Reason (sent to the user)" : "Note (optional)"} htmlFor={id}>
            <Textarea id={id} rows={3} maxLength={1000} value={reason} placeholder={placeholder} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={variant === "success" ? "success" : "destructive"}
              loading={pending}
              disabled={required && reason.trim().length < 3}
              onClick={() =>
                startTransition(async () => {
                  const r = await run(reason);
                  if (r.ok) {
                    toast.success(r.message ?? "Done");
                    setOpen(false);
                    setReason("");
                    router.refresh();
                  } else toast.error(r.error ?? "Something went wrong");
                })
              }
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

/** One-click action with a toast (no reason needed). */
export function ActionButton({
  label,
  run,
  variant = "outline",
  size = "sm",
  icon,
}: {
  label: string;
  run: () => Promise<ActionResult>;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await run();
          if (r.ok) {
            toast.success(r.message ?? "Done");
            router.refresh();
          } else toast.error(r.error ?? "Something went wrong");
        })
      }
    >
      {icon} {label}
    </Button>
  );
}
