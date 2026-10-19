import Link from "next/link";
import { MapPin, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { FIELDS_OF_STUDY, PROVINCES } from "@/lib/zimbabwe";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OPPORTUNITY_TYPES, type OpportunityType } from "@/lib/opportunity-types";
import { OpportunityCard } from "./opportunity-card";
import { PAGE_SIZE, listOpportunities, type OpportunityFilters } from "./queries";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(params: Params): OpportunityFilters {
  return {
    q: one(params.q),
    type: one(params.type),
    field: one(params.field),
    province: one(params.province),
    pay: one(params.pay),
    startFrom: one(params.startFrom),
    startTo: one(params.startTo),
    deadlineBefore: one(params.deadlineBefore),
    page: Number(one(params.page)) || 1,
  };
}

function pageHref(basePath: string, params: Params, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const value = one(v);
    if (value && k !== "page") sp.set(k, value);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Search + filters (plain GET form: shareable, works without JS) and a paginated list (20 per page). */
export async function OpportunityBrowser({
  params,
  basePath,
  detailBase,
  lockedTypes,
  myProvince,
}: {
  params: Params;
  basePath: string;
  /** Where the card links go, e.g. "/opportunities" or "/candidate/opportunities". */
  detailBase: string;
  /** For candidates: only the types they can apply for. */
  lockedTypes?: OpportunityType[];
  /** For candidates: their province, powering the "Near me" shortcut. */
  myProvince?: string | null;
}) {
  const filters = parseFilters(params);
  const { items, total, page } = await listOpportunities({ ...filters, candidateTypes: lockedTypes });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // For signed-in candidates, mark the opportunities they already applied to or saved.
  const applied = new Set<string>();
  const saved = new Set<string>();
  const session = items.length ? await getSession() : null;
  if (session?.role === "candidate") {
    const supabase = await createClient();
    const ids = items.map((o) => o.id);
    const [a, s] = await Promise.all([
      supabase.from("applications").select("opportunity_id").eq("candidate_id", session.id).in("opportunity_id", ids),
      supabase.from("saved_opportunities").select("opportunity_id").eq("user_id", session.id).in("opportunity_id", ids),
    ]);
    (a.data ?? []).forEach((r) => applied.add(r.opportunity_id));
    (s.data ?? []).forEach((r) => saved.add(r.opportunity_id));
  }
  const hasFilters = Object.entries(params).some(([k, v]) => k !== "page" && one(v));

  return (
    <div className="space-y-5">
      <form method="get" action={basePath} className="space-y-3 rounded-xl border border-border bg-surface p-3 sm:p-4" role="search">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={filters.q} placeholder="Search title, company, skill or location" className="pl-9" aria-label="Search opportunities" />
          </div>
          <Button type="submit" variant="cta">
            Search
          </Button>
        </div>
        {myProvince ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={pageHref(basePath, { ...params, province: filters.province === myProvince ? undefined : myProvince }, 1)}
              aria-pressed={filters.province === myProvince}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 font-medium ${filters.province === myProvince ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted"}`}
            >
              <MapPin className="size-4" aria-hidden /> Near me · {myProvince}
            </Link>
          </div>
        ) : null}
        <details className="group" open={hasFilters}>
          <summary className="cursor-pointer select-none text-sm font-semibold text-link">Filters</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!lockedTypes || lockedTypes.length > 1 ? (
              <label className="space-y-1 text-sm font-medium">
                Type
                <Select name="type" defaultValue={filters.type}>
                  <option value="">All types</option>
                  {OPPORTUNITY_TYPES.filter((t) => !lockedTypes || lockedTypes.includes(t.value)).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
            <label className="space-y-1 text-sm font-medium">
              Field
              <Select name="field" defaultValue={filters.field}>
                <option value="">Any field</option>
                {FIELDS_OF_STUDY.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Province
              <Select name="province" defaultValue={filters.province}>
                <option value="">Anywhere</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Pay
              <Select name="pay" defaultValue={filters.pay}>
                <option value="">Paid or unpaid</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </Select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Starts after
              <Input type="date" name="startFrom" defaultValue={filters.startFrom} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Starts before
              <Input type="date" name="startTo" defaultValue={filters.startTo} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Deadline before
              <Input type="date" name="deadlineBefore" defaultValue={filters.deadlineBefore} />
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" variant="default" className="flex-1">
                Apply filters
              </Button>
              {hasFilters ? (
                <Button asChild variant="ghost">
                  <Link href={basePath}>Clear</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </details>
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === 0 ? "No opportunities found" : `${total} opportunit${total === 1 ? "y" : "ies"}`}
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={<SearchX aria-hidden />}
          title="No matching opportunities"
          description="Try fewer filters or a different search. New opportunities are published every week."
          action={
            hasFilters ? (
              <Button asChild variant="outline">
                <Link href={basePath}>Clear filters</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((o) => (
            <li key={o.id} className="relative">
              <OpportunityCard opportunity={o} href={`${detailBase}/${o.id}`} applied={applied.has(o.id)} saved={saved.has(o.id)} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={pageHref(basePath, params, page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}>
              Previous
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button asChild variant="outline" className={page >= pages ? "pointer-events-none opacity-50" : ""}>
            <Link href={pageHref(basePath, params, page + 1)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined}>
              Next
            </Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
