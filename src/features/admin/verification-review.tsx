"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, FileImage, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PdfViewerDialog, type PdfTarget } from "@/features/files/pdf-viewer-dialog";
import { getSignedFileUrlAction } from "@/features/files/actions";
import { ActionButton, ReasonButton } from "./reason-dialog";
import { reviewVerificationAction } from "./actions";

/** Opens each verification document: PDFs in the in-site viewer, images in a dialog (60-second signed URLs). */
export function VerificationDocs({ paths }: { paths: string[] }) {
  const [pdf, setPdf] = React.useState<PdfTarget | null>(null);
  const [image, setImage] = React.useState<{ url: string; name: string } | null>(null);

  const open = async (path: string) => {
    const name = path.split("/").pop() ?? "document";
    if (path.toLowerCase().endsWith(".pdf")) return setPdf({ bucket: "verification-docs", path, title: name });
    const r = await getSignedFileUrlAction("verification-docs", path);
    if (r.ok && r.url) setImage({ url: r.url, name });
    else toast.error(r.error ?? "Could not open the document");
  };

  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {paths.map((p) => (
          <li key={p}>
            <Button size="sm" variant="outline" onClick={() => void open(p)}>
              {p.toLowerCase().endsWith(".pdf") ? <FileText aria-hidden /> : <FileImage aria-hidden />}
              <span className="max-w-40 truncate">{p.split("/").pop()}</span>
            </Button>
          </li>
        ))}
      </ul>
      <PdfViewerDialog target={pdf} onClose={() => setPdf(null)} />
      <Dialog open={image !== null} onClose={() => setImage(null)} title={image?.name ?? "Document"} className="max-w-2xl">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={image.name} className="max-h-[70dvh] w-full rounded-lg object-contain" onContextMenu={(e) => e.preventDefault()} />
        ) : null}
      </Dialog>
    </>
  );
}

export function VerificationDecision({ requestId }: { requestId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton label="Approve" variant="success" size="default" icon={<Check aria-hidden />} run={() => reviewVerificationAction(requestId, true)} />
      <ReasonButton
        label="Reject"
        title="Reject this request"
        description="The company sees your reason and can submit a new request."
        confirmLabel="Reject request"
        variant="outline"
        size="default"
        required
        placeholder="e.g. The registration certificate is not legible. Please upload a clear copy."
        icon={<X aria-hidden />}
        run={(reason) => reviewVerificationAction(requestId, false, reason)}
      />
    </div>
  );
}
