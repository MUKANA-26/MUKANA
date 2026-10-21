"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeGalleryPhotoAction } from "@/features/files/actions";
import { UploadError, uploadFile } from "@/features/files/upload";
import { companyLogoUrl } from "@/lib/storage";

/** Up to 8 photos shown on the public company page (team, office, events). */
export function GalleryManager({ companyId, paths }: { companyId: string; paths: string[] }) {
  const router = useRouter();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let added = 0;
    for (const file of Array.from(files).slice(0, 8 - paths.length)) {
      try {
        await uploadFile("company_gallery", file, companyId);
        added++;
      } catch (e) {
        toast.error(e instanceof UploadError ? `${file.name}: ${e.message}` : `${file.name} could not be uploaded`);
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (added) {
      toast.success(`${added} photo${added === 1 ? "" : "s"} added`);
      router.refresh();
    }
  };

  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-sm font-medium">Company photos ({paths.length}/8)</p>
      {paths.length > 0 ? (
        <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {paths.map((p) => (
            <li key={p} className="relative overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={companyLogoUrl(p) ?? ""} alt="Company photo" className="h-28 w-full object-cover" />
              <button
                type="button"
                aria-label="Remove this photo"
                onClick={async () => {
                  if (!window.confirm("Remove this photo?")) return;
                  const r = await removeGalleryPhotoAction(p);
                  if (r.ok) {
                    toast.success("Photo removed");
                    router.refresh();
                  } else toast.error(r.error ?? "Could not remove it");
                }}
                className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-black/70 text-white hover:bg-black"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button type="button" variant="outline" loading={busy} disabled={paths.length >= 8} onClick={() => input.current?.click()}>
        <ImagePlus aria-hidden /> Add photos
      </Button>
      <input ref={input} type="file" multiple className="sr-only" tabIndex={-1} accept=".jpg,.jpeg,.png,.webp" onChange={(e) => void add(e.target.files)} />
      <p className="mt-1 text-xs text-muted-foreground">Real photos of your team, workplace and events help candidates picture themselves with you.</p>
    </div>
  );
}
