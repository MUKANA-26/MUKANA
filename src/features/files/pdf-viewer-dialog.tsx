"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { BucketId } from "./constants";

const PdfViewerInner = dynamic(() => import("./pdf-viewer-inner").then((m) => m.PdfViewerInner), {
  ssr: false,
  loading: () => <div className="grid h-48 place-items-center text-sm text-muted-foreground">Loading viewer…</div>,
});

export interface PdfTarget {
  bucket: BucketId;
  path: string;
  title: string;
}

/** Full-screen modal PDF viewer. The document opens inside the site; there is no download. */
export function PdfViewerDialog({ target, onClose }: { target: PdfTarget | null; onClose: () => void }) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (target && !el.open) el.showModal();
    if (!target && el.open) el.close();
  }, [target]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={target?.title ?? "Document viewer"}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-background p-0 text-foreground backdrop:bg-black/60 md:m-auto md:h-[92dvh] md:w-[min(56rem,94vw)] md:rounded-2xl md:border md:border-border"
    >
      {target ? (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 safe-top">
            <h2 className="truncate font-heading text-base font-semibold">{target.title}</h2>
            <button type="button" onClick={onClose} aria-label="Close viewer" className="grid size-11 place-items-center rounded-lg hover:bg-surface-muted">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <PdfViewerInner bucket={target.bucket} path={target.path} />
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
