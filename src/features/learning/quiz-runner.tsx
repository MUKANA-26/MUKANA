"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Award, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface QuizData {
  id: string;
  title: string;
  skill: string;
  pass_mark: number;
  questions: { position: number; question: string; options: string[] }[];
}
interface Result {
  score: number;
  passed: boolean;
  pass_mark: number;
  wrong: number[];
}

/** One question at a time; the answers are checked in the database so they never reach the browser. */
export function QuizRunner({ quiz, userId }: { quiz: QuizData; userId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [answers, setAnswers] = React.useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const [step, setStep] = React.useState(0);
  const [result, setResult] = React.useState<Result | null>(null);
  const [pending, setPending] = React.useState(false);
  const total = quiz.questions.length;
  const q = quiz.questions[step]!;

  const submit = async () => {
    setPending(true);
    const { data, error } = await supabase.rpc("submit_quiz", { p_id: quiz.id, p_answers: answers as number[] });
    setPending(false);
    if (error) return void toast.error(error.message.replace(/^.*?:\s*/, ""));
    setResult(data as Result);
  };

  if (result) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <span className={cn("mx-auto grid size-16 place-items-center rounded-full", result.passed ? "bg-success-soft text-success-soft-foreground" : "bg-warning-soft text-warning-soft-foreground")}>
          <Award className="size-8" aria-hidden />
        </span>
        <h2 className="font-heading text-2xl font-semibold">{result.score}%</h2>
        <p className="text-sm">
          {result.passed ? `You passed and earned the “${quiz.title}” badge. It now shows on your profile.` : `You needed ${result.pass_mark}% to pass. You got ${total - result.wrong.length} of ${total} right. Review the topic and try again.`}
        </p>
        {!result.passed && result.wrong.length ? <p className="text-xs text-muted-foreground">Questions to review: {result.wrong.join(", ")}</p> : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/learn">Back to Learn</Link>
          </Button>
          {result.passed ? (
            <Button asChild variant="cta">
              <Link href={`/people/${userId}`}>See my profile</Link>
            </Button>
          ) : (
            <Button
              variant="cta"
              onClick={() => {
                setAnswers(quiz.questions.map(() => null));
                setStep(0);
                setResult(null);
              }}
            >
              <RotateCcw aria-hidden /> Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Question {step + 1} of {total}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={total}>
          <div className="h-full bg-cta transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
      </div>
      <h2 className="font-heading text-lg font-semibold">{q.question}</h2>
      <ul className="space-y-2">
        {q.options.map((o, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setAnswers((a) => a.map((x, k) => (k === step ? i : x)))}
              aria-pressed={answers[step] === i}
              className={cn("w-full rounded-xl border p-3 text-left text-sm", answers[step] === i ? "border-primary bg-info-soft font-medium" : "border-border hover:bg-surface-muted")}
            >
              {o}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < total - 1 ? (
          <Button variant="cta" disabled={answers[step] === null} onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        ) : (
          <Button variant="cta" loading={pending} disabled={answers.some((a) => a === null)} onClick={() => void submit()}>
            Finish
          </Button>
        )}
      </div>
    </div>
  );
}
