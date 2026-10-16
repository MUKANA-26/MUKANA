"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { clearOfflineCache } from "@/lib/offline-cache";
import { deleteAccountAction, exportMyDataAction } from "./actions";

export function PrivacyPanel({ canDelete = true }: { canDelete?: boolean }) {
  const [exporting, startExport] = React.useTransition();
  const [deleting, startDelete] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your data and privacy</CardTitle>
        <CardDescription>Your rights under Zimbabwe&apos;s Cyber and Data Protection Act [Chapter 12:07].</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
          <div className="min-w-0">
            <p className="font-semibold">Download my data</p>
            <p className="text-sm text-muted-foreground">A JSON file with your profile, applications, interviews, notifications and consent record.</p>
          </div>
          <Button
            variant="outline"
            loading={exporting}
            onClick={() =>
              startExport(async () => {
                const r = await exportMyDataAction();
                if (!r.ok || !r.json) return void toast.error(r.error ?? "Could not export");
                const url = URL.createObjectURL(new Blob([r.json], { type: "application/json" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = r.filename ?? "mukana-data.json";
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Your data was downloaded");
              })
            }
          >
            <Download aria-hidden /> Download JSON
          </Button>
        </div>

        {canDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger p-4">
            <div className="min-w-0">
              <p className="font-semibold text-danger">Delete my account</p>
              <p className="text-sm text-muted-foreground">Permanently removes your profile, documents, applications and notifications. This can&apos;t be undone.</p>
            </div>
            <Button variant="destructive" onClick={() => setOpen(true)}>
              <Trash2 aria-hidden /> Delete account
            </Button>
          </div>
        ) : null}
      </CardContent>

      <Dialog open={open} onClose={() => setOpen(false)} title="Delete your account?" description="Everything is erased permanently, including uploaded CVs and documents.">
        <div className="space-y-4">
          <Field label='Type DELETE to confirm' htmlFor="delete-confirm" error={error ?? undefined}>
            <Input id="delete-confirm" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleting}
              disabled={text.trim() !== "DELETE"}
              onClick={() =>
                startDelete(async () => {
                  setError(null);
                  clearOfflineCache();
                  const r = await deleteAccountAction(text);
                  if (r && !r.ok) setError(r.error ?? "Could not delete your account");
                })
              }
            >
              Delete everything
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
