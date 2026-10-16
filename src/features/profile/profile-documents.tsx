"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfViewerDialog, type PdfTarget } from "@/features/files/pdf-viewer-dialog";

/** CV and placement letter shown on the profile; they open in the in-site viewer. */
export function ProfileDocuments({ cvPath, placementPath }: { cvPath: string | null; placementPath: string | null }) {
  const [viewer, setViewer] = React.useState<PdfTarget | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {cvPath ? (
          <Button variant="outline" onClick={() => setViewer({ bucket: "cvs", path: cvPath, title: "My CV" })}>
            <FileText aria-hidden /> View my CV
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link href="/candidate/profile/edit">
              <Upload aria-hidden /> Add your CV
            </Link>
          </Button>
        )}
        {placementPath ? (
          <Button variant="outline" onClick={() => setViewer({ bucket: "placement-letters", path: placementPath, title: "Placement letter" })}>
            <FileText aria-hidden /> Placement letter
          </Button>
        ) : null}
        <Button asChild variant="ghost">
          <Link href="/candidate/cv-builder">Open CV builder</Link>
        </Button>
      </div>
      <PdfViewerDialog target={viewer} onClose={() => setViewer(null)} />
    </>
  );
}
