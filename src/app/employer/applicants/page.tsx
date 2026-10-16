import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL } from "@/features/applications/status";
import { ApplicantsTable } from "@/features/employer/applicants-table";
import { getApplicants, getTemplates, type ApplicantRecord } from "@/features/employer/queries";
import { getMyCompany } from "@/features/profile/queries";
import { LEVELS } from "@/lib/zimbabwe";
import type { ApplicationStatus } from "@/types/db";

export const metadata: Metadata = { title: "Applicants" };

const PAGE = 20;
type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const has = (hay: string | null | undefined, needle: string) => (hay ?? "").toLowerCase().includes(needle.toLowerCase());

function filterAndSort(items: ApplicantRecord[], p: Params) {
  const opp = one(p.opportunity);
  const status = one(p.status) as ApplicationStatus | "";
  const institution = one(p.institution);
  const programme = one(p.programme);
  const skill = one(p.skill);
  const minLevel = Number(one(p.level)) || 0;
  const minScore = Number(one(p.minScore)) || 0;
  const q = one(p.q);

  const out = items.filter((a) => {
    const cp = a.candidate.profile;
    if (opp && a.opportunity?.id !== opp) return false;
    if (status && a.status !== status) return false;
    if (q && !has(a.candidate.full_name, q) && !has(a.candidate.email, q)) return false;
    if (institution && !has(cp?.institution, institution)) return false;
    if (programme && !has(cp?.programme, programme) && !has(cp?.qualification, programme)) return false;
    if (minLevel && (cp?.current_level == null || Number(cp.current_level) < minLevel)) return false;
    if (skill && !(cp?.skills ?? []).some((s) => has(s, skill))) return false;
    if (minScore && (a.match_score ?? 0) < minScore) return false;
    return true;
  });

  const sort = one(p.sort) || "match";
  out.sort((a, b) =>
    sort === "recent"
      ? b.submitted_at.localeCompare(a.submitted_at)
      : sort === "name"
        ? a.candidate.full_name.localeCompare(b.candidate.full_name)
        : (b.match_score ?? -1) - (a.match_score ?? -1) || b.submitted_at.localeCompare(a.submitted_at),
  );
  return out;
}

function href(params: Params, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const val = one(v);
    if (val && k !== "page") sp.set(k, val);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/employer/applicants?${qs}` : "/employer/applicants";
}

export default async function ApplicantsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const session = await requireRole("employer");
  const company = await getMyCompany(session.id);
  const supabase = await createClient();
  const [all, templates, { data: opps }] = await Promise.all([
    getApplicants(),
    company ? getTemplates(company.company.id) : Promise.resolve(null),
    supabase.from("opportunities").select("id, title").eq("company_id", company?.company.id ?? "").neq("status", "draft").order("created_at", { ascending: false }),
  ]);

  const filtered = filterAndSort(all, params);
  const page = Math.max(1, Number(one(params.page)) || 1);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice((page - 1) * PAGE, page * PAGE);
  const hasFilters = Object.entries(params).some(([k, v]) => k !== "page" && k !== "sort" && one(v));

  return (
    <>
      <PageHeader title="Applicants" description="Sorted by match score by default. The score guides you; every decision is yours." />

      <form method="get" className="mb-5 space-y-3 rounded-xl border border-border bg-surface p-3 sm:p-4" role="search">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm font-medium sm:col-span-2">
            Opportunity
            <Select name="opportunity" defaultValue={one(params.opportunity)}>
              <option value="">All opportunities</option>
              {(opps ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Status
            <Select name="status" defaultValue={one(params.status)}>
              <option value="">Any status</option>
              {(Object.keys(STATUS_LABEL) as ApplicationStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Sort by
            <Select name="sort" defaultValue={one(params.sort) || "match"}>
              <option value="match">Best match</option>
              <option value="recent">Most recent</option>
              <option value="name">Name</option>
            </Select>
          </label>
        </div>
        <details open={hasFilters}>
          <summary className="cursor-pointer select-none text-sm font-semibold text-link">More filters</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm font-medium">
              Name or email
              <Input name="q" defaultValue={one(params.q)} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Institution
              <Input name="institution" defaultValue={one(params.institution)} placeholder="e.g. NUST" />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Programme / qualification
              <Input name="programme" defaultValue={one(params.programme)} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Minimum level (attachees)
              <Select name="level" defaultValue={one(params.level)}>
                <option value="">Any</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Skill
              <Input name="skill" defaultValue={one(params.skill)} placeholder="e.g. Python" />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Minimum match
              <Select name="minScore" defaultValue={one(params.minScore)}>
                <option value="">Any</option>
                {[30, 50, 70, 85].map((s) => (
                  <option key={s} value={s}>
                    {s}%+
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </details>
        <div className="flex gap-2">
          <Button type="submit" variant="default">
            Apply filters
          </Button>
          {hasFilters ? (
            <Button asChild variant="ghost">
              <Link href="/employer/applicants">Clear</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {filtered.length} applicant{filtered.length === 1 ? "" : "s"}
      </p>
      {templates ? <ApplicantsTable key={`${page}-${filtered.length}`} items={visible} templates={templates} /> : null}

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-3">
          <Button asChild variant="outline" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={href(params, page - 1)} aria-disabled={page <= 1}>
              Previous
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button asChild variant="outline" className={page >= pages ? "pointer-events-none opacity-50" : ""}>
            <Link href={href(params, page + 1)} aria-disabled={page >= pages}>
              Next
            </Link>
          </Button>
        </nav>
      ) : null}
    </>
  );
}
