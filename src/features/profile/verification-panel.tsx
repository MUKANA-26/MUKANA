"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, FileCheck2, ShieldCheck, ShieldX, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/form";
import { VerifiedBadge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { PdfViewerDialog, type PdfTarget } from "@/features/files/pdf-viewer-dialog";
import { FILE_RULES } from "@/features/files/constants";
import { UploadError, uploadFile } from "@/features/files/upload";
import { formatDate } from "@/lib/utils";
import type { CompanyRow, VerificationRequestRow } from "@/types/db";
import { requestVerificationAction } from "./actions";

export function VerificationPanel({ company, requests }: { company: CompanyRow; requests: VerificationRequestRow[] }) {
  const router = useRouter();
  const [paths, setPaths] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [viewer, setViewer] = React.useState<PdfTarget | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const latest = requests[0];
  const status = company.verification_status;
  const canRequest = status === "unverified" || status === "rejected";

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (paths.length + uploaded.length >= 6) {
          toast.error("You can attach up to 6 documents.");
          break;
        }
        uploaded.push(await uploadFile("verification_doc", file, company.id));
      }
      setPaths((p) => [...p, ...uploaded]);
    } catch (e) {
      toast.error(e instanceof UploadError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Company verification</CardTitle>
          {status === "approved" ? <VerifiedBadge /> : null}
          {status === "pending" ? (
            <Badge variant="warning">
              <Clock className="size-3.5" aria-hidden /> Under review
            </Badge>
          ) : null}
          {status === "rejected" ? (
            <Badge variant="danger">
              <ShieldX className="size-3.5" aria-hidden /> Not approved
            </Badge>
          ) : null}
        </div>
        <CardDescription>
          Verified companies get a green badge and can publish opportunities. Unverified companies can still save drafts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "approved" ? (
          <p className="flex items-center gap-2 text-sm text-success-soft-foreground">
            <ShieldCheck className="size-5" aria-hidden /> Verified on {formatDate(company.verified_at)}. You can publish opportunities.
          </p>
        ) : null}
        {status === "pending" ? (
          <p className="text-sm text-muted-foreground">
            Your request was sent on {formatDate(latest?.created_at)}. We&apos;ll notify you as soon as an admin has reviewed it.
          </p>
        ) : null}
        {status === "rejected" && latest?.reason ? (
          <div role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-foreground">
            <p className="font-semibold">Reason from the reviewer</p>
            <p className="mt-1">{latest.reason}</p>
            <p className="mt-2">Fix the issue and submit a new request below.</p>
          </div>
        ) : null}

        {canRequest ? (
          <div className="space-y-3">
            <p className="text-sm">
              Upload supporting documents, such as your certificate of incorporation, a CR14 or a tax clearance. {FILE_RULES.verification_doc.label}.
            </p>
            <ul className="space-y-2">
              {paths.map((p) => (
                <li key={p} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <FileCheck2 className="size-4 shrink-0 text-success-soft-foreground" aria-hidden />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left hover:underline"
                    onClick={() => p.endsWith(".pdf") && setViewer({ bucket: "verification-docs", path: p, title: "Verification document" })}
                  >
                    {p.split("/").pop()}
                  </button>
                  <button type="button" aria-label="Remove document" onClick={() => setPaths((x) => x.filter((i) => i !== p))} className="grid size-8 place-items-center rounded-md hover:bg-surface-muted">
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => void onFiles(e.target.files)}
            />
            <Button type="button" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
              <Upload aria-hidden /> Add documents
            </Button>
            <Field label="Note for the reviewer (optional)" htmlFor="verify-note">
              <Textarea id="verify-note" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Button
              type="button"
              variant="cta"
              disabled={paths.length === 0}
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await requestVerificationAction(paths, note);
                  if (r.ok) {
                    toast.success(r.message ?? "Request sent");
                    setPaths([]);
                    router.refresh();
                  } else toast.error(r.error ?? "Could not send the request");
                })
              }
            >
              Request verification
            </Button>
          </div>
        ) : null}
      </CardContent>
      <PdfViewerDialog target={viewer} onClose={() => setViewer(null)} />
    </Card>
  );
}
