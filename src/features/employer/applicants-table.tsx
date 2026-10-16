"use client";

import * as React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/features/applications/status-badge";
import { EMPLOYER_NEXT, STATUS_LABEL } from "@/features/applications/status";
import type { MessageTemplate, TemplateKind } from "@/features/applications/templates";
import { ScorePill } from "@/features/matching/match-card";
import type { ApplicantRecord } from "./queries";
import { StatusChangeDialog, type ChangeableStatus } from "./status-dialog";

const BULK: ChangeableStatus[] = ["under_review", "shortlisted", "offer_made", "unsuccessful"];

export function ApplicantsTable({
  items,
  templates,
  avatars = {},
}: {
  items: ApplicantRecord[];
  templates: Record<TemplateKind, MessageTemplate>;
  avatars?: Record<string, string>;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [target, setTarget] = React.useState<ChangeableStatus | null>(null);

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (items.length === 0) {
    return <EmptyState icon={<Users aria-hidden />} title="No applicants match" description="Try clearing some filters, or share your opportunity link to attract candidates." />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={allSelected}
            onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())}
            aria-label="Select all applicants on this page"
          />
          Select all
        </label>
        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Bulk actions">
            <span className="text-sm font-semibold">{selected.size} selected</span>
            {BULK.map((s) => (
              <Button key={s} size="sm" variant={s === "unsuccessful" ? "outline" : "secondary"} onClick={() => setTarget(s)}>
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <ul className="space-y-3">
        {items.map((a) => {
          const p = a.candidate.profile;
          const level = p?.candidate_type === "attachee" ? (p.current_level != null ? `Level ${Number(p.current_level).toFixed(1)}` : null) : p?.degree_class ? p.degree_class.replace("_", " ") : null;
          const programme = p?.candidate_type === "attachee" ? p.programme : p?.qualification;
          const canChange = EMPLOYER_NEXT[a.status].length > 0;
          return (
            <li key={a.id} className="relative flex gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-4">
              <Checkbox
                className="mt-1"
                checked={selected.has(a.id)}
                disabled={!canChange}
                onChange={() => toggle(a.id)}
                aria-label={`Select ${a.candidate.full_name}`}
              />
              <Avatar url={a.candidate.avatar_path ? avatars[a.candidate.avatar_path] : null} name={a.candidate.full_name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-heading text-base font-semibold leading-snug">
                      <Link href={`/employer/applicants/${a.id}`} className="hover:underline">
                        {a.candidate.full_name}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {[p?.institution, programme, level].filter(Boolean).join(" · ") || "Profile details not shared"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ScorePill score={a.match_score} />
                    <StatusBadge status={a.status} />
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  For <span className="font-medium text-foreground">{a.opportunity?.title}</span> · applied {formatDate(a.submitted_at)}
                </p>
                {p?.skills?.length ? (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {p.skills.slice(0, 6).map((s) => (
                      <span key={s} className="rounded-full bg-surface-muted px-2 py-0.5 text-xs">
                        {s}
                      </span>
                    ))}
                    {p.skills.length > 6 ? <span className="text-xs text-muted-foreground">+{p.skills.length - 6}</span> : null}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <StatusChangeDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        ids={[...selected]}
        status={target}
        templates={templates}
        onDone={() => setSelected(new Set())}
      />
    </div>
  );
}
