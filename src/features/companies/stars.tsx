import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star rating (supports halves visually by rounding to the nearest half). */
export function Stars({ value, size = "size-4", className }: { value: number; size?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className={cn("relative inline-block", size)}>
            <Star className={cn("absolute inset-0 text-border", size)} aria-hidden />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("fill-cta text-cta", size)} aria-hidden />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Pick a rating from 1 to 5. */
export function StarInput({ value, onChange, id }: { value: number; onChange: (v: number) => void; id?: string }) {
  return (
    <div id={id} role="radiogroup" aria-label="Rating" className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => onChange(n)} className="grid size-10 place-items-center rounded-lg hover:bg-surface-muted">
          <Star className={cn("size-6", n <= value ? "fill-cta text-cta" : "text-border")} aria-hidden />
        </button>
      ))}
    </div>
  );
}
