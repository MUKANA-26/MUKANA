"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, RotateCcw, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { usePractice, type Category, type Question } from "./interview-centre";

const LEN = [5, 10, 15];
const LIMIT = 120; // seconds to think, like a real interview

/** Flash-card style practice: a random set of questions, a timer, the model answer on request, and a self-rating saved to your account. */
export function PracticeSession({ categories, questions, userId, initialCategory }: { categories: Category[]; questions: Question[]; userId: string | null; initialCategory: string }) {
  const { save } = usePractice(userId);
  const [cat, setCat] = React.useState(initialCategory);
  const [count, setCount] = React.useState(5);
  const [deck, setDeck] = React.useState<Question[] | null>(null);
  const [i, setI] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [seconds, setSeconds] = React.useState(LIMIT);
  const [running, setRunning] = React.useState(false);
  const [ratings, setRatings] = React.useState<number[]>([]);
  const [notes, setNotes] = React.useState("");

  const start = () => {
    const pool = questions.filter((q) => cat === "all" || q.category === cat);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
    setDeck(shuffled);
    setI(0);
    setRatings([]);
    setRevealed(false);
    setSeconds(LIMIT);
    setRunning(true);
    setNotes("");
  };

  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => (s <= 1 ? (setRunning(false), 0) : s - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  const rate = async (confidence: number) => {
    if (!deck) return;
    const q = deck[i]!;
    if (userId) await save(q.id, { confidence });
    setRatings((r) => [...r, confidence]);
    setRevealed(false);
    setNotes("");
    setSeconds(LIMIT);
    setRunning(true);
    setI((n) => n + 1);
  };

  if (!deck) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-heading text-lg font-semibold">Set up your practice</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            Topic
            <Select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">Everything</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Number of questions
            <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {LEN.map((n) => (
                <option key={n} value={n}>
                  {n} questions
                </option>
              ))}
            </Select>
          </label>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Read the question and answer out loud (you have 2 minutes).</li>
          <li>Reveal the model answer and compare.</li>
          <li>Rate how ready you are. Weak spots come up again.</li>
        </ol>
        <Button variant="cta" size="lg" onClick={start}>
          Start practice
        </Button>
        {!userId ? (
          <p className="text-xs text-muted-foreground">
            <Link href="/sign-in" className="font-semibold text-link underline">Sign in</Link> to keep your ratings and track progress.
          </p>
        ) : null}
      </div>
    );
  }

  if (i >= deck.length) {
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    return (
      <div className="space-y-4 rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success-soft-foreground">
          <Trophy className="size-7" aria-hidden />
        </span>
        <h2 className="font-heading text-xl font-semibold">Practice complete</h2>
        <p className="text-sm text-muted-foreground">
          You answered {deck.length} questions. {ratings.filter((r) => r === 3).length} confident, {ratings.filter((r) => r === 1).length} to work on. Average readiness {avg.toFixed(1)} out of 3.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="cta" onClick={start}>
            <RotateCcw aria-hidden /> Practise again
          </Button>
          <Button asChild variant="outline">
            <Link href="/interview-prep">Back to the centre</Link>
          </Button>
        </div>
      </div>
    );
  }

  const q = deck[i]!;
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-muted-foreground">
          Question {i + 1} of {deck.length}
        </span>
        <span className={cn("inline-flex items-center gap-1.5 font-mono font-semibold", seconds <= 15 && "text-danger")} aria-live="off">
          <Timer className="size-4" aria-hidden /> {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </div>
      <h2 className="font-heading text-xl font-semibold leading-snug">{q.question}</h2>
      <label className="block space-y-1 text-sm font-medium">
        Your notes (optional, not saved)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Jot down your key points, then say your answer out loud" className="w-full rounded-lg border border-input bg-surface-muted p-3 text-sm" />
      </label>
      {revealed ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-info-soft p-3 text-sm leading-6 text-info-soft-foreground">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide">Model answer</p>
            <p className="whitespace-pre-line">{q.answer}</p>
            {q.tip ? <p className="mt-2 font-medium">Tip: {q.tip}</p> : null}
          </div>
          <p className="text-sm font-medium">How did you do?</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => void rate(1)}>Needs work</Button>
            <Button variant="outline" onClick={() => void rate(2)}>Getting there</Button>
            <Button variant="cta" onClick={() => void rate(3)}>Confident</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="lg" className="w-full" onClick={() => setRevealed(true)}>
          <Eye aria-hidden /> Show the model answer
        </Button>
      )}
    </div>
  );
}
