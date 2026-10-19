"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { deleteResourceAction, saveResourceAction } from "./resources-actions";

export interface ResourceRow {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  body: string;
  audience: string;
  language: string;
  published: boolean;
}
const KINDS = [
  ["career_guidance", "Career guidance"],
  ["cv_and_applications", "CVs and applications"],
  ["interview_prep", "Interview preparation"],
  ["workplace_skills", "Workplace skills"],
  ["digital_skills", "Digital skills"],
] as const;
const blank = { kind: "career_guidance", title: "", summary: "", body: "", audience: "all", language: "en", published: true };

/** Admin list with create / edit / delete for learning guides. */
export function ResourceManager({ resources }: { resources: ResourceRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<ResourceRow | "new" | null>(null);
  const [v, setV] = React.useState(blank);
  const [pending, startTransition] = React.useTransition();
  const open = (r: ResourceRow | "new") => {
    setV(r === "new" ? blank : { kind: r.kind, title: r.title, summary: r.summary ?? "", body: r.body, audience: r.audience, language: r.language, published: r.published });
    setEditing(r);
  };
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <Button variant="cta" onClick={() => open("new")}>
        <Plus aria-hidden /> New guide
      </Button>
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {resources.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {r.title} {!r.published ? <Badge variant="warning">Hidden</Badge> : null}
              </p>
              <p className="text-xs text-muted-foreground">{KINDS.find((k) => k[0] === r.kind)?.[1]} · {r.audience === "all" ? "everyone" : r.audience.replace("_", " ")} · {r.language.toUpperCase()}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => open(r)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() =>
                  window.confirm(`Delete “${r.title}”?`) &&
                  startTransition(async () => {
                    const res = await deleteResourceAction(r.id);
                    if (res.ok) {
                      toast.success(res.message ?? "Deleted");
                      router.refresh();
                    } else toast.error(res.error ?? "Could not delete");
                  })
                }
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New guide" : "Edit guide"} className="max-w-2xl">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Topic" htmlFor="rs-kind">
              <Select id="rs-kind" value={v.kind} onChange={set("kind")}>
                {KINDS.map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="For" htmlFor="rs-aud">
              <Select id="rs-aud" value={v.audience} onChange={set("audience")}>
                <option value="all">Everyone</option>
                <option value="attachee">Attachees</option>
                <option value="graduate_trainee">Graduates</option>
              </Select>
            </Field>
            <Field label="Language" htmlFor="rs-lang">
              <Select id="rs-lang" value={v.language} onChange={set("language")}>
                <option value="en">English</option>
                <option value="sn">Shona</option>
                <option value="nd">Ndebele</option>
              </Select>
            </Field>
          </div>
          <Field label="Title" htmlFor="rs-title" required>
            <Input id="rs-title" value={v.title} onChange={set("title")} maxLength={160} />
          </Field>
          <Field label="Short summary" htmlFor="rs-sum">
            <Input id="rs-sum" value={v.summary} onChange={set("summary")} maxLength={300} />
          </Field>
          <Field label="Guide text" htmlFor="rs-body" required hint="Use “## Heading” for headings and “- ” for bullet points. Blank lines separate paragraphs.">
            <Textarea id="rs-body" rows={12} value={v.body} onChange={set("body")} />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-4" checked={v.published} onChange={(e) => setV((s) => ({ ...s, published: e.target.checked }))} />
            <span className="font-medium">Published (visible to everyone)</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="cta"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await saveResourceAction(editing === "new" || editing === null ? null : editing.id, v as Parameters<typeof saveResourceAction>[1]);
                  if (res.ok) {
                    toast.success(res.message ?? "Saved");
                    setEditing(null);
                    router.refresh();
                  } else toast.error(res.error ?? "Could not save");
                })
              }
            >
              Save guide
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
