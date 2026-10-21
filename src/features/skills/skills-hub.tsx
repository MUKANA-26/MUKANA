"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Clock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface LessonCard {
  id: string;
  slug: string;
  category: string;
  title: string;
  summary: string | null;
  level: "beginner" | "intermediate" | "advanced";
  minutes: number;
  skills: string[];
}
export interface LessonCategory {
  slug: string;
  label: string;
  description: string | null;
}

export function useLessonProgress(userId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  return useQuery({
    queryKey: ["lessons", "progress", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("lesson_progress").select("lesson_id, quiz_score");
      if (error) throw error;
      return new Map((data ?? []).map((r: { lesson_id: string; quiz_score: number | null }) => [r.lesson_id, r.quiz_score]));
    },
  });
}

const LEVEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;

/** Browse lessons by topic, see what you have finished and continue where you stopped. */
export function SkillsHub({ lessons, categories, userId }: { lessons: LessonCard[]; categories: LessonCategory[]; userId: string | null }) {
  const [cat, setCat] = React.useState("all");
  const [level, setLevel] = React.useState("all");
  const [term, setTerm] = React.useState("");
  const progress = useLessonProgress(userId);
  const done = progress.data ?? new Map<string, number | null>();

  const shown = lessons.filter((l) => {
    if (cat !== "all" && l.category !== cat) return false;
    if (level !== "all" && l.level !== level) return false;
    if (term.trim().length >= 2 && !`${l.title} ${l.summary ?? ""} ${l.skills.join(" ")}`.toLowerCase().includes(term.trim().toLowerCase())) return false;
    return true;
  });
  const completed = lessons.filter((l) => done.has(l.id)).length;
  const next = lessons.find((l) => !done.has(l.id));
  const minutesLeft = lessons.filter((l) => !done.has(l.id)).reduce((s, l) => s + l.minutes, 0);

  return (
    <div className="space-y-5">
      {userId ? (
        <section className="rounded-xl border border-border bg-gradient-to-br from-info-soft to-surface p-4" aria-label="Your progress">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {completed} of {lessons.length} lessons completed
              </p>
              <div className="mt-2 h-2 w-56 max-w-full overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={lessons.length}>
                <div className="h-full bg-success transition-all" style={{ width: `${lessons.length ? (completed / lessons.length) * 100 : 0}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">About {Math.round(minutesLeft / 60 * 10) / 10} hours of lessons left</p>
            </div>
            {next ? (
              <Button asChild variant="cta">
                <Link href={`/skills/${next.slug}`}>{completed ? "Continue" : "Start"}: {next.title.length > 34 ? `${next.title.slice(0, 33)}...` : next.title}</Link>
              </Button>
            ) : (
              <Badge variant="success">All lessons completed</Badge>
            )}
          </div>
        </section>
      ) : null}

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search skills and lessons (Excel, CV, Python)" aria-label="Search lessons" className="h-11 w-full rounded-xl border border-input bg-surface pl-9 pr-3 text-sm" />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Topics">
          {[{ slug: "all", label: "All topics" }, ...categories].map((c) => (
            <button key={c.slug} type="button" role="tab" aria-selected={cat === c.slug} onClick={() => setCat(c.slug)} className={cn("h-9 shrink-0 rounded-full border px-3 text-sm font-medium", cat === c.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted")}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 text-sm">
          {(["all", "beginner", "intermediate"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={cn("rounded-lg px-3 py-1.5 font-medium", level === l ? "bg-surface-muted underline" : "text-muted-foreground hover:bg-surface-muted")}>
              {l === "all" ? "Any level" : LEVEL[l]}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={<BookOpen aria-hidden />} title="No lessons match" description="Try a different topic or search." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((l) => (
            <li key={l.id}>
              <Link href={`/skills/${l.slug}`} className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="flex items-center justify-between gap-2">
                  <Badge variant={l.level === "beginner" ? "success" : "info"}>{LEVEL[l.level]}</Badge>
                  {done.has(l.id) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                      <CheckCircle2 className="size-4" aria-hidden /> Done
                    </span>
                  ) : null}
                </span>
                <span className="mt-2 font-heading font-semibold">{l.title}</span>
                <span className="mt-1 flex-1 text-sm text-muted-foreground">{l.summary}</span>
                <span className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden /> {l.minutes} min
                  </span>
                  {l.skills.slice(0, 3).map((s) => (
                    <span key={s} className="rounded-full bg-surface-muted px-2 py-0.5">
                      {s}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
