import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Briefcase, Building2, MapPin, Search, Users } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Badge, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";
import { companyLogoUrl } from "@/lib/storage";
import { INDUSTRIES, PROVINCES } from "@/lib/zimbabwe";
import { Stars } from "@/features/companies/stars";

export const metadata: Metadata = {
  title: "Companies",
  description: "Browse verified employers in Zimbabwe: what they do, who they hire and what attachees say.",
};

const PAGE = 24;
interface Row {
  id: string;
  name: string;
  logo_path: string | null;
  industry: string | null;
  location: string | null;
  tagline: string | null;
  size_band: string | null;
  open_roles: number | string;
  rating_avg: number | string;
  rating_count: number | string;
  followers: number | string;
  total: number | string;
}
type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = one(params.q);
  const industry = one(params.industry);
  const province = one(params.province);
  const hiring = one(params.hiring) === "1";
  const sort = ["name", "hiring", "rating", "followers"].includes(one(params.sort)) ? one(params.sort) : "name";
  const page = Math.max(1, Number(one(params.page)) || 1);

  const supabase = await createClient();
  const { data } = await supabase.rpc("list_companies", { p_q: q || null, p_industry: industry || null, p_province: province || null, p_hiring: hiring, p_sort: sort, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  const rows = (data ?? []) as Row[];
  const total = Number(rows[0]?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, industry, province, hiring: hiring ? "1" : "", sort: sort === "name" ? "" : sort })) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/companies?${s}` : "/companies";
  };
  const hasFilters = Boolean(q || industry || province || hiring);

  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <PageHeader title="Companies" description="Verified employers on Mukana. Follow the ones you like and see what people say about them." />

        <form method="get" role="search" className="mb-5 space-y-3 rounded-xl border border-border bg-surface p-3 sm:p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input name="q" defaultValue={q} placeholder="Search companies or industries" className="pl-9" aria-label="Search companies" />
            </div>
            <Button type="submit" variant="cta">
              Search
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="space-y-1 text-sm font-medium">
              Industry
              <Select name="industry" defaultValue={industry}>
                <option value="">All industries</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Province
              <Select name="province" defaultValue={province}>
                <option value="">Anywhere</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Sort by
              <Select name="sort" defaultValue={sort}>
                <option value="name">Name</option>
                <option value="hiring">Most open roles</option>
                <option value="rating">Highest rated</option>
                <option value="followers">Most followed</option>
              </Select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <input type="checkbox" name="hiring" value="1" defaultChecked={hiring} className="size-4" />
              Hiring now
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="default">
              Apply filters
            </Button>
            {hasFilters ? (
              <Button asChild variant="ghost">
                <Link href="/companies">Clear</Link>
              </Button>
            ) : null}
          </div>
        </form>

        <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
          {total === 0 ? "No companies found" : `${total} compan${total === 1 ? "y" : "ies"}`}
        </p>

        {rows.length === 0 ? (
          <EmptyState icon={<Building2 aria-hidden />} title="No companies match" description="Try removing a filter." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((c) => {
              const logo = companyLogoUrl(c.logo_path);
              const rating = Number(c.rating_avg);
              return (
                <li key={c.id}>
                  <Link href={`/companies/${c.id}`} className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white">
                        {logo ? <Image src={logo} alt="" width={56} height={56} className="size-full object-contain" /> : <Building2 className="size-6 text-muted-foreground" aria-hidden />}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-heading font-semibold leading-tight">
                          <span className="truncate">{c.name}</span> <VerifiedBadge />
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{c.industry}</p>
                        {c.location ? (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="size-3" aria-hidden /> {c.location}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {c.tagline ? <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{c.tagline}</p> : null}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-xs">
                      {Number(c.rating_count) > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Stars value={rating} /> <span className="font-semibold">{rating.toFixed(1)}</span> <span className="text-muted-foreground">({Number(c.rating_count)})</span>
                        </span>
                      ) : null}
                      <Badge variant={Number(c.open_roles) > 0 ? "success" : "neutral"}>
                        <Briefcase className="size-3" aria-hidden /> {Number(c.open_roles)} open role{Number(c.open_roles) === 1 ? "" : "s"}
                      </Badge>
                      {Number(c.followers) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Users className="size-3" aria-hidden /> {Number(c.followers)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
            <Button asChild variant="outline" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
              <Link href={href(page - 1)}>Previous</Link>
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {pages}
            </span>
            <Button asChild variant="outline" className={page >= pages ? "pointer-events-none opacity-50" : ""}>
              <Link href={href(page + 1)}>Next</Link>
            </Button>
          </nav>
        ) : null}
      </div>
    </AdaptiveLayout>
  );
}
