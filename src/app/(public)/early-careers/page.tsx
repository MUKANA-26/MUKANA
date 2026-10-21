import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheck, GraduationCap, Sparkles } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { PageHeader, SkeletonList } from "@/components/ui/misc";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OPPORTUNITY_TYPES } from "@/lib/opportunity-types";
import { cn } from "@/lib/utils";
import { OpportunityBrowser } from "@/features/opportunities/opportunity-browser";

export const metadata: Metadata = {
  title: "Early careers",
  description: "Industrial attachments, internships, graduate trainee programmes and entry-level jobs that do not need work experience.",
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function EarlyCareersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const session = await getSession();
  const supabase = await createClient();
  const today = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
  const type = OPPORTUNITY_TYPES.some((t) => t.value === one(params.type)) ? one(params.type) : "";
  const noexp = one(params.noexp) === "1";

  // How many are open in each tab.
  const counts = await Promise.all(
    [null, ...OPPORTUNITY_TYPES.map((t) => t.value)].map(async (t) => {
      let q = supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "published").gte("deadline", today);
      if (t) q = q.eq("type", t);
      if (noexp) q = q.eq("no_experience", true);
      const { count } = await q;
      return count ?? 0;
    }),
  );
  const tabs = [{ value: "", label: "All" }, ...OPPORTUNITY_TYPES.map((t) => ({ value: t.value, label: t.value === "graduate_trainee" ? "Graduate programmes" : t.value === "industrial_attachment" ? "Attachments" : t.value === "internship" ? "Internships" : "Entry-level jobs" }))];
  const href = (t: string, n: boolean) => {
    const sp = new URLSearchParams();
    if (t) sp.set("type", t);
    if (n) sp.set("noexp", "1");
    const qs = sp.toString();
    return qs ? `/early-careers?${qs}` : "/early-careers";
  };

  let province: string | null = null;
  if (session?.role === "candidate") {
    const { data } = await supabase.from("candidate_profiles").select("province").eq("user_id", session.id).maybeSingle();
    province = data?.province ?? null;
  }

  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        <PageHeader title="Early careers" description="Attachments, internships, graduate programmes and jobs that do not need experience." />

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: BadgeCheck, title: "No experience needed", text: "Employers tick this when you can start from zero." },
            { icon: GraduationCap, title: "Made for students", text: "Attachments and internships fit your studies." },
            { icon: Sparkles, title: "Match scores", text: "Sign in to see how well each one fits you." },
          ].map((c) => (
            <div key={c.title} className="flex gap-3 rounded-xl border border-border bg-surface p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-info-soft text-info-soft-foreground">
                <c.icon className="size-5" aria-hidden />
              </span>
              <p className="text-sm">
                <span className="block font-semibold">{c.title}</span>
                <span className="text-muted-foreground">{c.text}</span>
              </p>
            </div>
          ))}
        </div>

        <nav aria-label="Opportunity types" className="flex flex-wrap items-center gap-2">
          {tabs.map((t, i) => (
            <Link key={t.value || "all"} href={href(t.value, noexp)} aria-current={type === t.value ? "page" : undefined} className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium", type === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted")}>
              {t.label}
              <span className={cn("rounded-full px-1.5 text-xs", type === t.value ? "bg-white/20" : "bg-surface-muted")}>{counts[i]}</span>
            </Link>
          ))}
          <Link href={href(type, !noexp)} aria-pressed={noexp} className={cn("ml-auto inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold", noexp ? "border-success bg-success text-success-foreground" : "border-success text-success hover:bg-success-soft")}>
            <BadgeCheck className="size-4" aria-hidden /> No experience needed
          </Link>
        </nav>

        <Suspense fallback={<SkeletonList />}>
          <OpportunityBrowser params={params} basePath="/early-careers" detailBase={session?.role === "candidate" ? "/candidate/opportunities" : "/opportunities"} hideType myProvince={province} />
        </Suspense>
      </div>
    </AdaptiveLayout>
  );
}
