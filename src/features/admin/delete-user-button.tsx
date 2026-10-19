"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { deleteUserAction } from "./actions";

/** Permanent deletion with a typed-email confirmation, so it can't happen by accident. */
export function DeleteUserButton({ userId, name, email, role }: { userId: string; name: string; email: string; role: "candidate" | "employer" }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="text-danger" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden /> Delete
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setTyped("");
          setError(null);
        }}
        title={`Permanently delete ${name || email}?`}
        description="This cannot be undone."
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-foreground">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>
              {role === "employer"
                ? "Their company, all opportunities, applicants' applications to them, posts, comments, notifications and uploaded files will be erased."
                : "Their profile, CV and documents, applications, saved items, posts, comments and notifications will be erased."}{" "}
              Their account can't be recovered.
            </p>
          </div>
          <Field label={`Type ${email} to confirm`} htmlFor="del-confirm" error={error ?? undefined}>
            <Input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" placeholder={email} />
          </Field>
          <Field label="Reason (kept in the audit log, optional)" htmlFor="del-reason">
            <Input id="del-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              disabled={!matches}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const r = await deleteUserAction(userId, typed, reason);
                  if (r.ok) {
                    toast.success(r.message ?? "User deleted");
                    setOpen(false);
                    setTyped("");
                    router.refresh();
                  } else setError(r.error ?? "Could not delete this user");
                })
              }
            >
              Delete permanently
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}