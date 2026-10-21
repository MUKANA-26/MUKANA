"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, CheckCircle2, ChevronDown, Lightbulb, PlayCircle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface Category {
  slug: string;
  label: string;
  description: string | null;
}
export interface Question {
  id: string;
  category: string;
  question: string;
  answer: string;
  tip: string | null;
  audience: "all" | "attachee" | "graduate_trainee";
}
interface Practice {
  question_id: string;
  saved: boolean;
  confidence: number | null;
}

const CONF = ["", "Needs work", "Getting there", "Confident"];

export function usePractice(userId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["interview", "practice", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("interview_practice").select("question_id, saved, confidence");
      if (error) throw error;
      return new Map(((data ?? []) as Practice[]).map((p) => [p.question_id, p]));
    },
  });
  const save = async (questionId: string, patch: Partial<Pick<Practice, "saved" | "confidence">>) => {
    if (!userId) return false;
    const current = query.data?.get(questionId);
    const { error } = await supabase.from("interview_practice").upsert(
      { user_id: userId, question_id: questionId, saved: current?.saved ?? false, confidence: current?.confidence ?? null, ...patch, last_practiced_at: new Date().toISOString() },
      { onConflict: "user_id,question_id" },
    );
    if (error) {
      toast.error("Could not save that");
      return false;
    }
    await queryClient.invalidateQueries({ queryKey: ["interview", "practice", userId] });
    return true;
  };
  return { map: query.data ?? new Map<string, Practice>(), save };
}

/** The Interview Preparation Centre: browse by category, read model answers, save questions and track confidence. */
export function InterviewCentre({ categories, questions, userId, audience }: { categories: Category[]; questions: Question[]; userId: string | null; audience: "attachee" | "graduate_trainee" | null }) {
  const [cat, setCat] = React.useState<string>("all");
  const [aud, setAud] = React.useState<"all" | "mine">(audience ? "mine" : "all");
  const [term, setTerm] = React.useState("");
  const [onlySaved, setOnlySaved] = React.useState(false);
  const { map, save } = usePractice(userId);

  const shown = questions.filter((q) => {
    if (cat !== "all" && q.category !== cat) return false;
    if (aud === "mine" && audience && q.audience !== "all" && q.audience !== audience) return false;
    if (onlySaved && !map.get(q.id)?.saved) return false;
    if (term.trim().length >= 2 && !`${q.question} ${q.answer}`.toLowerCase().includes(term.trim().toLowerCase())) return false;
    return true;
  });
  const counts = new Map<string, number>();
  for (const q of questions) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
  const practised = [...map.values()].filter((p) => p.confidence).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 sm:col-span-2">
          <h2 className="flex items-center gap-2 font-heading font-semibold">
            <Lightbulb className="size-5 text-cta" aria-hidden /> Answer with SAR
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            For &quot;tell me about a time...&quot; questions: <strong>Situation</strong> (what was happening), <strong>Action</strong> (what you did), <strong>Result</strong> (what changed). Keep each answer to about 60 to 90 seconds.
          </p>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-border bg-gradient-to-br from-info-soft to-surface p-4">
          <p className="text-sm font-semibold">Practice like the real thing</p>
          <Button asChild variant="cta" size="sm" className="mt-2">
            <Link href={cat === "all" ? "/interview-prep/practice" : `/interview-prep/practice?cat=${cat}`}>
              <PlayCircle aria-hidden /> Start practice mode
            </Link>
          </Button>
          {userId ? <p className="mt-2 text-xs text-muted-foreground">{practised} of {questions.length} questions rated</p> : null}
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search questions" aria-label="Search questions" className="h-11 w-full rounded-xl border border-input bg-surface pl-9 pr-3 text-sm" />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Categories">
          {[{ slug: "all", label: `All (${questions.length})` }, ...categories.map((c) => ({ slug: c.slug, label: `${c.label} (${counts.get(c.slug) ?? 0})` }))].map((c) => (
            <button key={c.slug} type="button" role="tab" aria-selected={cat === c.slug} onClick={() => setCat(c.slug)} className={cn("h-9 shrink-0 rounded-full border px-3 text-sm font-medium", cat === c.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted")}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {audience ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4" checked={aud === "mine"} onChange={(e) => setAud(e.target.checked ? "mine" : "all")} />
              Only questions for {audience === "attachee" ? "attachees" : "graduates"}
            </label>
          ) : null}
          {userId ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4" checked={onlySaved} onChange={(e) => setOnlySaved(e.target.checked)} />
              Saved only
            </label>
          ) : null}
        </div>
        {cat !== "all" ? <p className="text-sm text-muted-foreground">{categories.find((c) => c.slug === cat)?.description}</p> : null}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No questions match" description="Try another category or clear the search." />
      ) : (
        <ul className="space-y-2">
          {shown.map((q) => {
            const p = map.get(q.id);
            return (
              <li key={q.id}>
                <details className="group rounded-xl border border-border bg-surface open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                    <ChevronDown className="mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                    <span className="flex-1 text-sm font-semibold">{q.question}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {p?.confidence ? <Badge variant={p.confidence === 3 ? "success" : p.confidence === 2 ? "warning" : "danger"}>{CONF[p.confidence]}</Badge> : null}
                      {q.audience !== "all" ? <Badge variant="info">{q.audience === "attachee" ? "Attachees" : "Graduates"}</Badge> : null}
                      {p?.saved ? <Bookmark className="size-4 fill-current text-link" aria-label="Saved" /> : null}
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-border px-4 pb-4 pt-3 text-sm leading-6">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Model answer</p>
                      <p className="whitespace-pre-line">{q.answer}</p>
                    </div>
                    {q.tip ? (
                      <p className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2 text-warning-soft-foreground">
                        <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{q.tip}</span>
                      </p>
                    ) : null}
                    {userId ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button size="sm" variant={p?.saved ? "secondary" : "outline"} onClick={() => void save(q.id, { saved: !p?.saved })}>
                          <Bookmark className={cn(p?.saved && "fill-current")} aria-hidden /> {p?.saved ? "Saved" : "Save"}
                        </Button>
                        <span className="text-xs text-muted-foreground">How ready are you?</span>
                        {[1, 2, 3].map((c) => (
                          <Button key={c} size="sm" variant={p?.confidence === c ? "cta" : "ghost"} onClick={() => void save(q.id, { confidence: c })}>
                            {p?.confidence === c ? <CheckCircle2 aria-hidden /> : null} {CONF[c]}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        <Link href="/sign-in" className="font-semibold text-link underline">Sign in</Link> to save questions and track how ready you are.
                      </p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
