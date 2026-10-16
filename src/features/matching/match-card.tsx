import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchResult } from "@/types/db";

const PARTS: { key: keyof MatchResult["breakdown"]; label: string }[] = [
  { key: "field", label: "Field / programme" },
  { key: "skills", label: "Skills" },
  { key: "level", label: "Level / qualification" },
  { key: "availability", label: "Availability" },
  { key: "location", label: "Location" },
];

export function scoreTone(score: number) {
  if (score >= 75) return { label: "Strong match", cls: "bg-success-soft text-success-soft-foreground" };
  if (score >= 50) return { label: "Good match", cls: "bg-info-soft text-info-soft-foreground" };
  if (score >= 30) return { label: "Partial match", cls: "bg-warning-soft text-warning-soft-foreground" };
  return { label: "Low match", cls: "bg-surface-muted text-foreground" };
}

export function ScorePill({ score, className }: { score: number | null | undefined; className?: string }) {
  if (score == null) return null;
  const tone = scoreTone(score);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tone.cls, className)} title={tone.label}>
      <Sparkles className="size-3.5" aria-hidden /> {score}% match
    </span>
  );
}

/**
 * Explains a match score: total, per-factor bars and the plain-language reason for each.
 * The score is guidance only; it never rejects anyone.
 */
export function MatchCard({ match, audience = "candidate" }: { match: MatchResult | null | undefined; audience?: "candidate" | "employer" }) {
  if (!match?.breakdown?.field) return null;
  const tone = scoreTone(match.score);
  return (
    <section aria-label="Match breakdown" className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-4">
        <div
          className={cn("grid size-16 shrink-0 place-items-center rounded-full font-heading text-xl font-bold", tone.cls)}
          role="img"
          aria-label={`${match.score} percent match`}
        >
          {match.score}%
        </div>
        <div className="min-w-0">
          <h3 className="font-heading text-base font-semibold">{tone.label}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{match.reason}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {PARTS.map(({ key, label }) => {
          const part = match.breakdown[key];
          const pct = part.max ? Math.round((part.score / part.max) * 100) : 0;
          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {part.score}/{part.max}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                <div className={cn("h-full rounded-full", pct >= 70 ? "bg-success" : pct >= 35 ? "bg-cta" : "bg-muted-foreground/50")} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{part.reason}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 rounded-lg bg-surface-muted p-2.5 text-xs text-muted-foreground">
        {audience === "employer"
          ? "This score helps you sort applicants. It is not a decision: every shortlist, offer and rejection is yours."
          : "This score only guides you. Employers read every application and make every decision themselves."}
      </p>
    </section>
  );
}
