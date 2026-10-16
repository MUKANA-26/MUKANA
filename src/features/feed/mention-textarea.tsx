"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { PersonSuggestion } from "./types";

const ROLE: Record<string, string> = { candidate: "Candidate", employer: "Employer", admin: "Team" };

/**
 * Textarea with @tagging: type @ and a name, pick a person, and they are tagged.
 * `mentions` maps the visible "Full Name" to the user id; the parent turns it into stored tokens on send.
 */
export function MentionTextarea({
  id,
  value,
  onChange,
  mentions,
  onMention,
  placeholder,
  rows = 3,
  maxLength = 3000,
  className,
  onSubmitShortcut,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  mentions: Record<string, string>;
  onMention: (name: string, id: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  onSubmitShortcut?: () => void;
  "aria-label"?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = React.useState<{ start: number; text: string } | null>(null);
  const [results, setResults] = React.useState<PersonSuggestion[]>([]);
  const [active, setActive] = React.useState(0);
  const listId = React.useId();

  const detect = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = /(^|\s)@([^\s@]{1,30}(?: [^\s@]{0,30})?)$/.exec(before);
    if (!m) return setQuery(null);
    setQuery({ start: before.length - m[2]!.length - 1, text: m[2]! });
  };

  React.useEffect(() => {
    if (!query || query.text.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await createClient().rpc("search_people", { p_q: query.text.trim() });
      if (!cancelled) {
        setResults((data ?? []) as PersonSuggestion[]);
        setActive(0);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const pick = (p: PersonSuggestion) => {
    if (!query || !ref.current) return;
    const caret = ref.current.selectionStart;
    const next = `${value.slice(0, query.start)}@${p.full_name} ${value.slice(caret)}`;
    onChange(next);
    onMention(p.full_name, p.id);
    setQuery(null);
    setResults([]);
    requestAnimationFrame(() => {
      const pos = query.start + p.full_name.length + 2;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  };

  const open = query !== null && results.length > 0;

  return (
    <div className="relative">
      <textarea
        ref={ref}
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) detect(value, e.currentTarget.selectionStart);
        }}
        onClick={(e) => detect(value, e.currentTarget.selectionStart)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + results.length) % results.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(results[active]!);
              return;
            }
            if (e.key === "Escape") {
              setQuery(null);
              return;
            }
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSubmitShortcut?.();
        }}
        className={cn(
          "w-full resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
          className,
        )}
      />
      {open ? (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-xl">
          {results.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                className={cn("flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm", i === active ? "bg-info-soft" : "hover:bg-surface-muted")}
              >
                <span className="font-semibold">{p.full_name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[ROLE[p.role], p.company_name ?? p.headline].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {Object.keys(mentions).length ? <span className="sr-only">Tagged: {Object.keys(mentions).join(", ")}</span> : null}
    </div>
  );
}
