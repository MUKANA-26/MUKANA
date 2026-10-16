"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { ChevronLeft, ChevronRight, Loader2, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

/**
 * Renders PDF bytes held in memory onto canvases (pdf.js) with page navigation and zoom.
 * No download button, nothing is persisted.
 */
export function PdfCanvas({ bytes, error: externalError }: { bytes: Uint8Array | null; error?: string | null }) {
  const [error, setError] = React.useState<string | null>(null);
  const [pages, setPages] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [zoom, setZoom] = React.useState(1);
  const [width, setWidth] = React.useState(320);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setPage(1);
    setError(null);
  }, [bytes]);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // pdf.js transfers the buffer to its worker, so hand it a copy.
  const file = React.useMemo(() => (bytes ? { data: bytes.slice() } : null), [bytes]);
  const shownError = externalError ?? error;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2">
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft aria-hidden />
          </Button>
          <span className="min-w-24 text-center text-sm font-medium" aria-live="polite">
            {pages ? `Page ${page} of ${pages}` : "Loading…"}
          </span>
          <Button type="button" size="icon" variant="ghost" aria-label="Next page" disabled={!pages || page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
            <ZoomOut aria-hidden />
          </Button>
          <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button type="button" size="icon" variant="ghost" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>
            <ZoomIn aria-hidden />
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Fit to width" onClick={() => setZoom(1)}>
            <Maximize2 aria-hidden />
          </Button>
        </div>
      </div>

      <div ref={wrapRef} className="min-h-0 flex-1 overflow-auto bg-surface-muted p-3" onContextMenu={(e) => e.preventDefault()}>
        {shownError ? (
          <p role="alert" className="mx-auto mt-10 max-w-sm rounded-lg bg-danger-soft p-4 text-center text-sm font-medium text-danger-soft-foreground">
            {shownError}
          </p>
        ) : !file ? (
          <div className="grid h-48 place-items-center text-muted-foreground" role="status">
            <Loader2 className="size-6 animate-spin" aria-label="Loading document" />
          </div>
        ) : (
          <Document
            file={file}
            onLoadSuccess={({ numPages }) => setPages(numPages)}
            onLoadError={() => setError("This file couldn't be displayed.")}
            loading={<Loader2 className="mx-auto mt-10 size-6 animate-spin" aria-label="Loading document" />}
            className="mx-auto w-fit"
          >
            <Page pageNumber={Math.min(page, pages || 1)} width={Math.floor((width - 24) * zoom)} renderTextLayer={false} renderAnnotationLayer={false} className="overflow-hidden rounded-md shadow-md" />
          </Document>
        )}
      </div>
    </div>
  );
}
