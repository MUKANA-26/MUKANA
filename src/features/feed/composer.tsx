"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Video, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UploadError, uploadFile, validateFile } from "@/features/files/upload";
import { createPostAction } from "./actions";
import { MentionTextarea } from "./mention-textarea";
import { withTokens } from "./mentions";

interface Picked {
  id: string;
  file: File;
  kind: "image" | "video";
  preview: string;
}

/** "Start a post": text with @tagging, up to 4 photos or 1 video. */
export function Composer({ userId, name, avatarUrl, groupId }: { userId: string; name: string; avatarUrl: string | null; groupId?: string }) {
  const queryClient = useQueryClient();
  const [text, setText] = React.useState("");
  const [mentions, setMentions] = React.useState<Record<string, string>>({});
  const [files, setFiles] = React.useState<Picked[]>([]);
  const [posting, setPosting] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const imageInput = React.useRef<HTMLInputElement>(null);
  const videoInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = async (list: FileList | null, kind: "image" | "video") => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    const current = files;
    if (kind === "video" && (incoming.length > 1 || current.length > 0)) return void toast.error("Add one video on its own, without photos.");
    if (kind === "image" && (current.some((f) => f.kind === "video") || current.length + incoming.length > 4)) return void toast.error("You can add up to 4 photos (and no video with them).");
    const ok: Picked[] = [];
    for (const file of incoming) {
      try {
        await validateFile("post_media", file);
        ok.push({ id: crypto.randomUUID(), file, kind, preview: URL.createObjectURL(file) });
      } catch (e) {
        toast.error(e instanceof UploadError ? `${file.name}: ${e.message}` : `${file.name} can't be used`);
      }
    }
    setFiles((f) => [...f, ...ok]);
    setFocused(true);
  };

  const remove = (id: string) =>
    setFiles((f) => {
      const gone = f.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return f.filter((x) => x.id !== id);
    });

  const canPost = !posting && (text.trim().length > 0 || files.length > 0);

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      const uploaded: { kind: "image" | "video"; path: string }[] = [];
      for (const f of files) uploaded.push({ kind: f.kind, path: await uploadFile("post_media", f.file, userId) });
      const r = await createPostAction(withTokens(text.trim(), mentions), uploaded, groupId);
      if (!r.ok) throw new UploadError(r.error ?? "Could not post");
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setText("");
      setMentions({});
      setFiles([]);
      setFocused(false);
      toast.success("Posted");
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
    } catch (e) {
      toast.error(e instanceof UploadError ? e.message : "Couldn't post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <section aria-label="Create a post" className="rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-4">
      <div className="flex gap-3">
        <Avatar url={avatarUrl} name={name} size="md" />
        <div className="min-w-0 flex-1">
          <MentionTextarea
            aria-label="What do you want to share?"
            value={text}
            onChange={setText}
            mentions={mentions}
            onMention={(n, id) => setMentions((m) => ({ ...m, [n]: id }))}
            placeholder="Share an update, ask a question, celebrate a win… Type @ to tag someone"
            rows={focused || text ? 4 : 2}
            onSubmitShortcut={() => void submit()}
            className="border-0 bg-surface-muted"
          />
          <div onFocusCapture={() => setFocused(true)} />
          {files.length > 0 ? (
            <ul className={`mt-3 grid gap-2 ${files.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {files.map((f) => (
                <li key={f.id} className="relative overflow-hidden rounded-lg bg-black">
                  {f.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.preview} alt="Selected photo" className="max-h-72 w-full object-cover" />
                  ) : (
                    <video src={f.preview} controls playsInline preload="metadata" className="max-h-72 w-full" />
                  )}
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    aria-label="Remove this file"
                    className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/70 text-white hover:bg-black"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => imageInput.current?.click()} disabled={posting}>
                <ImagePlus className="text-success" aria-hidden /> Photo
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => videoInput.current?.click()} disabled={posting}>
                <Video className="text-cta" aria-hidden /> Video
              </Button>
              <input ref={imageInput} type="file" multiple className="sr-only" tabIndex={-1} accept=".jpg,.jpeg,.png,.webp" onChange={(e) => { void addFiles(e.target.files, "image"); e.target.value = ""; }} />
              <input ref={videoInput} type="file" className="sr-only" tabIndex={-1} accept=".mp4,.webm,.mov" onChange={(e) => { void addFiles(e.target.files, "video"); e.target.value = ""; }} />
            </div>
            <Button type="button" variant="cta" loading={posting} disabled={!canPost} onClick={() => void submit()}>
              Post
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
