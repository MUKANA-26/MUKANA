"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { removeFileAction } from "@/features/files/actions";
import { UploadError, uploadFile } from "@/features/files/upload";
import { savePresenceAction } from "./actions";

export interface PresenceValues {
  headline: string;
  open_to_work: boolean;
  searchable: boolean;
  profile_visibility: "members" | "connections";
  messages_from: "connections" | "anyone";
  mentor: boolean;
  mentor_topics: string;
}

/** How the member appears to others: headline, cover photo, open-to-work, and privacy choices. */
export function PresencePanel({ userId, role, initial, coverUrl, hasCover }: { userId: string; role: "candidate" | "employer" | "admin"; initial: PresenceValues; coverUrl: string | null; hasCover: boolean }) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);

  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await uploadFile("cover", file, userId);
      toast.success("Cover photo updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof UploadError ? e.message : "Couldn't upload your cover photo");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your public profile</CardTitle>
        <CardDescription>What other members see on your profile page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium">Cover photo</p>
          <div className="relative h-28 overflow-hidden rounded-xl bg-gradient-to-r from-primary to-link sm:h-36">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="Your cover photo" className="size-full object-cover" />
            ) : null}
            <div className="absolute right-2 top-2 flex gap-2">
              <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />} {hasCover ? "Change" : "Add cover"}
              </Button>
              {hasCover ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  aria-label="Remove cover photo"
                  onClick={async () => {
                    const r = await removeFileAction("cover");
                    if (r.ok) {
                      toast.success("Cover photo removed");
                      router.refresh();
                    } else toast.error(r.error ?? "Could not remove it");
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </div>
            <input ref={input} type="file" className="sr-only" tabIndex={-1} accept=".jpg,.jpeg,.png,.webp" onChange={(e) => void pickCover(e.target.files?.[0])} />
          </div>
        </div>

        <Field label="Headline" htmlFor="pp-headline" hint="A short line under your name, for example “Computer Science student at UZ looking for attachment”.">
          <Input id="pp-headline" maxLength={120} value={v.headline} onChange={(e) => setV({ ...v, headline: e.target.value })} />
        </Field>

        {role === "candidate" ? (
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
            <input type="checkbox" className="mt-1 size-4" checked={v.open_to_work} onChange={(e) => setV({ ...v, open_to_work: e.target.checked })} />
            <span>
              <span className="block text-sm font-semibold">Open to work</span>
              <span className="block text-sm text-muted-foreground">Show an “Open to work” badge on your profile and in search.</span>
            </span>
          </label>
        ) : null}

        <div className="space-y-3 rounded-xl border border-border p-3">
          <label className="flex min-h-10 cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 size-4" checked={v.mentor} onChange={(e) => setV({ ...v, mentor: e.target.checked })} />
            <span>
              <span className="block text-sm font-semibold">I can mentor others</span>
              <span className="block text-sm text-muted-foreground">Students and graduates can ask you for advice. You choose who to accept.</span>
            </span>
          </label>
          {v.mentor ? (
            <Field label="Topics you can help with" htmlFor="pp-topics" hint="Separate with commas, e.g. Careers, Engineering, Interviews">
              <Input id="pp-topics" maxLength={300} value={v.mentor_topics} onChange={(e) => setV({ ...v, mentor_topics: e.target.value })} />
            </Field>
          ) : null}
        </div>

        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
          <input type="checkbox" className="mt-1 size-4" checked={v.searchable} onChange={(e) => setV({ ...v, searchable: e.target.checked })} />
          <span>
            <span className="block text-sm font-semibold">Appear in people search and suggestions</span>
            <span className="block text-sm text-muted-foreground">Turn off to be found only by people you are already connected with.</span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Who can see my full profile" htmlFor="pp-vis">
            <Select id="pp-vis" value={v.profile_visibility} onChange={(e) => setV({ ...v, profile_visibility: e.target.value as PresenceValues["profile_visibility"] })}>
              <option value="members">All Mukana members</option>
              <option value="connections">Only my connections</option>
            </Select>
          </Field>
          <Field label="Who can start a chat with me" htmlFor="pp-msg">
            <Select id="pp-msg" value={v.messages_from} onChange={(e) => setV({ ...v, messages_from: e.target.value as PresenceValues["messages_from"] })}>
              <option value="connections">My connections only</option>
              <option value="anyone">Any member</option>
            </Select>
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">Employers you apply to, and applicants to your opportunities, can always message each other.</p>

        <div className="flex justify-end">
          <Button
            variant="cta"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await savePresenceAction(v);
                if (r.ok) toast.success(r.message ?? "Saved");
                else toast.error(r.error ?? "Could not save");
              })
            }
          >
            Save profile settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
