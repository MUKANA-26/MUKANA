"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Compass, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export interface CareerCard {
  slug: string;
  field: string;
  title: string;
  summary: string;
  entry_roles: string[];
  pay: { entry: [number, number] } | null;
}
export interface FieldOption {
  slug: string;
  label: string;
}

/** Browse careers by field or search; each card links to the full path. */
export function CareerExplorer({ careers, fields }: { careers: CareerCard[]; fields: FieldOption[] }) {
  const [field, setField] = React.useState("all");
  const [term, setTerm] = React.useState("");
  const label = new Map(fields.map((f) => [f.slug, f.label]));
  const shown = careers.filter((c) => {
    if (field !== "all" && c.field !== field) return false;
    if (term.trim().length >= 2 && !`${c.title} ${c.summary} ${c.entry_roles.join(" ")}`.toLowerCase().includes(term.trim().toLowerCase())) return false;
    return true;
  });
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search careers (accountant, engineer, data...)" aria-label="Search careers" className="h-11 w-full rounded-xl border border-input bg-surface pl-9 pr-3 text-sm" />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Fields">
          {[{ slug: "all", label: `All fields (${careers.length})` }, ...fields.map((f) => ({ slug: f.slug, label: `${f.label} (${careers.filter((c) => c.field === f.slug).length})` }))].map((f) => (
            <button key={f.slug} type="button" role="tab" aria-selected={field === f.slug} onClick={() => setField(f.slug)} className={cn("h-9 shrink-0 rounded-full border px-3 text-sm font-medium", field === f.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<Compass aria-hidden />} title="No careers match" description="Try another field or a different word." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((c) => (
            <li key={c.slug}>
              <Link href={`/careers/${c.slug}`} className="group flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <Badge variant="info" className="self-start">
                  {label.get(c.field) ?? c.field}
                </Badge>
                <span className="mt-2 font-heading text-lg font-semibold">{c.title}</span>
                <span className="mt-1 flex-1 text-sm text-muted-foreground">{c.summary}</span>
                <span className="mt-3 flex flex-wrap gap-1.5">
                  {c.entry_roles.slice(0, 2).map((r) => (
                    <span key={r} className="rounded-full bg-surface-muted px-2 py-0.5 text-xs">
                      {r}
                    </span>
                  ))}
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-link group-hover:underline">
                  Explore this path <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
