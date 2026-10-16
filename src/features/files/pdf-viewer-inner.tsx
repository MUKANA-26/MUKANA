"use client";

import * as React from "react";
import { getSignedFileUrlAction } from "./actions";
import type { BucketId } from "./constants";
import { PdfCanvas } from "./pdf-canvas";

/**
 * In-page viewer for a private file. The file is fetched with a 60-second signed URL into memory only:
 * nothing is written to disk, the service worker or browser storage, and there is no download button.
 */
export function PdfViewerInner({ bucket, path }: { bucket: BucketId; path: string }) {
  const [bytes, setBytes] = React.useState<Uint8Array | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setBytes(null);
    setError(null);
    (async () => {
      const res = await getSignedFileUrlAction(bucket, path);
      if (!res.ok || !res.url) throw new Error(res.error ?? "Could not open the file");
      const file = await fetch(res.url, { cache: "no-store", credentials: "omit" });
      if (!file.ok) throw new Error("Could not open the file");
      const buf = new Uint8Array(await file.arrayBuffer());
      if (!cancelled) setBytes(buf);
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Could not open the file");
    });
    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  return <PdfCanvas bytes={bytes} error={error} />;
}
