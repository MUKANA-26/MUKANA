"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { removeFileAction } from "@/features/files/actions";
import { UploadError, uploadFile } from "@/features/files/upload";

/** Big round photo with a camera button: tap it to choose a new picture (JPG, PNG or WebP, max 2MB). */
export function AvatarUploader({
  userId,
  url,
  name,
  size = "xl",
  hasPhoto,
}: {
  userId: string;
  url: string | null;
  name: string;
  size?: "lg" | "xl";
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await uploadFile("avatar", file, userId);
      toast.success("Profile photo updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof UploadError ? e.message : "Couldn't upload your photo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="relative inline-block">
      <Avatar url={url} name={name} size={size} className="ring-4 ring-surface" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={hasPhoto ? "Change profile photo" : "Add a profile photo"}
        className="absolute -bottom-1 -right-1 grid size-10 place-items-center rounded-full border-2 border-surface bg-cta text-cta-foreground shadow-md hover:bg-cta-hover"
      >
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
      </button>
      {hasPhoto ? (
        <button
          type="button"
          onClick={async () => {
            const r = await removeFileAction("avatar");
            if (r.ok) {
              toast.success("Photo removed");
              router.refresh();
            } else toast.error(r.error ?? "Could not remove the photo");
          }}
          aria-label="Remove profile photo"
          className="absolute -left-1 -bottom-1 grid size-8 place-items-center rounded-full border-2 border-surface bg-surface-muted text-muted-foreground hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      ) : null}
      <input ref={inputRef} type="file" className="sr-only" tabIndex={-1} accept=".jpg,.jpeg,.png,.webp" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
