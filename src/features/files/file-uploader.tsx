"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, FileCheck2, ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FILE_RULES, type FileKind } from "./constants";
import { removeFileAction } from "./actions";
import { UploadError, uploadFile } from "./upload";

export function FileUploader({
  kind,
  ownerId,
  currentPath,
  label,
  onUploaded,
  onView,
  removable = false,
  compact = false,
}: {
  kind: FileKind;
  /** User id (candidate files) or company id (company files). */
  ownerId: string;
  currentPath?: string | null;
  label?: string;
  onUploaded?: (path: string) => void;
  onView?: (path: string) => void;
  removable?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const rule = FILE_RULES[kind];
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const isImage = rule.mimes[0]?.startsWith("image/");
  const Icon = isImage ? ImageIcon : FileCheck2;

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const path = await uploadFile(kind, file, ownerId);
      toast.success("Uploaded");
      onUploaded?.(path);
      router.refresh();
    } catch (e) {
      setError(e instanceof UploadError ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label ? <p className="text-sm font-medium">{label}</p> : null}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-surface-muted/50 p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{currentPath ? currentPath.split("/").pop() : "No file uploaded"}</p>
          <p className="text-xs text-muted-foreground">{rule.label}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentPath && onView ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onView(currentPath)}>
              <Eye aria-hidden /> View
            </Button>
          ) : null}
          <Button type="button" size={compact ? "sm" : "default"} variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden /> {currentPath ? "Replace" : "Upload"}
          </Button>
          {removable && currentPath ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove file"
              onClick={async () => {
                const res = await removeFileAction(kind as "cv" | "placement_letter" | "avatar");
                if (res.ok) {
                  toast.success("Removed");
                  router.refresh();
                } else toast.error(res.error ?? "Could not remove");
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept={rule.extensions.map((e) => `.${e}`).join(",")}
          onChange={(e) => void handle(e.target.files?.[0])}
        />
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
