"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, PenLine, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useLessonProgress } from "./skills-hub";

export interface QuizItem {
  q: string;
  options: string[];
  correct: number;
  why: string;
}

/** Exercise, self-check quiz (explanations after each answer) and "mark complete". */
export function LessonPlayer({ lessonId, userId, exercise, quiz, nextSlug }: { lessonId: string; userId: string | null; exercise: string | null; quiz: QuizItem[]; nextSlug: string | null }) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const progress = useLessonProgress(userId);
  const alreadyDone = progress.data?.has(lessonId) ?? false;
  const [answers, setAnswers] = React.useState<(number | null)[]>(() => quiz.map(() => null));
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const answered = answers.filter((a) => a !== null).length;
  const correct = answers.filter((a, i) => a === quiz[i]!.correct).length;
  const score = quiz.length ? Math.round((correct / quiz.length) * 100) : 100;
  const complete = alreadyDone || saved;

  const finish = async () => {
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase.from("lesson_progress").upsert({ user_id: userId, lesson_id: lessonId, quiz_score: score, completed_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
    setBusy(false);
    if (error) return void toast.error("Could not save your progress");
    setSaved(true);
    toast.success("Lesson completed");
    void queryClient.invalidateQueries({ queryKey: ["lessons", "progress", userId] });
  };

  return (
    <div className="space-y-6">
      {exercise ? (
        <section className="rounded-xl border border-border bg-info-soft p-4 text-info-soft-foreground" aria-labelledby="ex-h">
          <h2 id="ex-h" className="flex items-center gap-2 font-heading font-semibold">
            <PenLine className="size-5" aria-hidden /> Try it yourself
          </h2>
          <p className="mt-1 text-sm leading-6">{exercise}</p>
        </section>
      ) : null}

      {quiz.length ? (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm" aria-labelledby="qz-h">
          <h2 id="qz-h" className="font-heading text-lg font-semibold">
            Check your understanding
          </h2>
          <ol className="mt-3 space-y-5">
            {quiz.map((item, qi) => {
              const picked = answers[qi];
              return (
                <li key={qi}>
                  <p className="text-sm font-semibold">
                    {qi + 1}. {item.q}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {item.options.map((o, oi) => {
                      const isPicked = picked === oi;
                      const showResult = picked !== null;
                      return (
                        <li key={oi}>
                          <button
                            type="button"
                            disabled={picked !== null}
                            onClick={() => setAnswers((a) => a.map((x, k) => (k === qi ? oi : x)))}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm",
                              showResult && oi === item.correct ? "border-success bg-success-soft" : showResult && isPicked ? "border-danger bg-danger-soft" : "border-border hover:bg-surface-muted",
                            )}
                          >
                            <span>{o}</span>
                            {showResult && oi === item.correct ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Correct" /> : showResult && isPicked ? <XCircle className="size-4 shrink-0 text-danger" aria-label="Not correct" /> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {picked !== null ? <p className="mt-2 text-sm text-muted-foreground">{item.why}</p> : null}
                </li>
              );
            })}
          </ol>
          {answered === quiz.length ? (
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold">
              <Trophy className="size-5 text-cta" aria-hidden /> You got {correct} of {quiz.length} ({score}%).
              <button type="button" className="ml-2 text-link underline" onClick={() => setAnswers(quiz.map(() => null))}>
                Try again
              </button>
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        {userId ? (
          complete ? (
            <>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-success">
                <CheckCircle2 className="size-5" aria-hidden /> Completed
              </span>
              {nextSlug ? (
                <Button asChild variant="cta">
                  <Link href={`/skills/${nextSlug}`}>Next lesson</Link>
                </Button>
              ) : null}
            </>
          ) : (
            <Button variant="cta" loading={busy} onClick={() => void finish()}>
              Mark lesson complete
            </Button>
          )
        ) : (
          <p className="text-sm">
            <Link href="/sign-in?next=/skills" className="font-semibold text-link underline">
              Sign in
            </Link>{" "}
            to save your progress.
          </p>
        )}
        <Button asChild variant="ghost">
          <Link href="/skills">All lessons</Link>
        </Button>
      </div>
    </div>
  );
}
