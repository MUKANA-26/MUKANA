import * as React from "react";
import { BadgeCheck, CalendarCheck, MapPin, Sparkles, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/** Zig-zag band inspired by the chevron patterns of Great Zimbabwe. Purely decorative. */
export function ChevronBand({ className }: { className?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg aria-hidden className={cn("pointer-events-none absolute inset-x-0 h-6 w-full", className)} preserveAspectRatio="none">
      <defs>
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 18 L12 6 L24 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Soft blobs behind a section. */
export function Blobs({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute -left-20 -top-24 size-72 rounded-full bg-cta/15 blur-3xl" />
      <div className="absolute -right-24 top-10 size-80 rounded-full bg-link/15 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 size-64 rounded-full bg-success/10 blur-3xl" />
    </div>
  );
}

/** Circular match score. */
export function ScoreRing({ value, size = 84 }: { value: number; size?: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${value} percent match`}>
      <svg viewBox="0 0 88 88" className="size-full -rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" strokeWidth="9" className="stroke-surface-muted" />
        <circle cx="44" cy="44" r={r} fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} className="stroke-success" />
      </svg>
      <span className="absolute font-heading text-lg font-bold">{value}%</span>
    </div>
  );
}

const FACTORS = [
  { label: "Field of study", score: 35, max: 35, color: "bg-link" },
  { label: "Skills", score: 24, max: 30, color: "bg-success" },
  { label: "Level", score: 15, max: 15, color: "bg-cta" },
  { label: "Availability", score: 13, max: 15, color: "bg-warning" },
  { label: "Location", score: 5, max: 5, color: "bg-navy" },
];

/** The five-part match breakdown the product really uses (sample numbers). */
export function MatchBreakdownCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface p-5 shadow-xl", className)}>
      <div className="flex items-center gap-4">
        <ScoreRing value={92} />
        <div>
          <p className="font-heading font-semibold">Software Development Attachee</p>
          <p className="text-sm text-muted-foreground">Why you match, in plain words</p>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {FACTORS.map((f) => (
          <li key={f.label}>
            <div className="flex justify-between text-xs font-medium">
              <span>{f.label}</span>
              <span className="text-muted-foreground">
                {f.score}/{f.max}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className={cn("h-full rounded-full", f.color)} style={{ width: `${(f.score / f.max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-lg bg-success-soft px-3 py-2 text-xs font-medium text-success-soft-foreground">Matches 4 of 5 required skills. Your field of study matches the eligible programmes.</p>
    </div>
  );
}

/** Illustrative phone preview used in the hero (sample content, not real data). */
export function HeroPhone({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-sm", className)}>
      <div className="mukana-float-slow absolute -left-12 top-6 z-10 hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold shadow-lg sm:flex">
        <BadgeCheck className="size-4 text-link" aria-hidden /> Verified employer
      </div>
      <div className="mukana-float absolute -right-10 top-32 z-10 hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold shadow-lg sm:flex">
        <CalendarCheck className="size-4 text-success" aria-hidden /> Interview invitation
      </div>
      <div className="mukana-float-slow absolute -left-14 bottom-20 z-10 hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold shadow-lg sm:flex">
        <Sparkles className="size-4 text-cta" aria-hidden /> New match for you
      </div>

      <div className="rounded-[2rem] border-8 border-navy bg-background p-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-navy/30" />
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary font-heading font-bold text-primary-foreground">D</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Software Development Attachee</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  Delta Corp <BadgeCheck className="size-3.5 text-link" aria-label="Verified" />
                </p>
              </div>
              <ScoreRing value={92} size={52} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-1"><MapPin className="size-3" aria-hidden /> Harare</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-1"><Wallet className="size-3" aria-hidden /> Paid</span>
              <span className="rounded-full bg-warning-soft px-2 py-1 text-warning-soft-foreground">3 days left</span>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-success font-heading font-bold text-success-foreground">E</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Graduate Trainee: Finance</p>
                <p className="truncate text-xs text-muted-foreground">Econet · Bulawayo</p>
              </div>
              <ScoreRing value={78} size={52} />
            </div>
          </div>
          <div className="rounded-xl bg-cta px-4 py-3 text-center text-sm font-semibold text-cta-foreground">Apply in one tap</div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Sample screen for illustration</p>
    </div>
  );
}

const STAGES = ["Submitted", "Under review", "Shortlisted", "Interview", "Offer"];

/** The hiring pipeline employers use. */
export function PipelineArt() {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold" aria-label="Hiring stages">
      {STAGES.map((s, i) => (
        <React.Fragment key={s}>
          <li className={cn("rounded-full px-3 py-1.5", i === STAGES.length - 1 ? "bg-cta text-cta-foreground" : "bg-primary-foreground/15")}>{s}</li>
          {i < STAGES.length - 1 ? <span aria-hidden className="opacity-60">→</span> : null}
        </React.Fragment>
      ))}
    </ol>
  );
}
