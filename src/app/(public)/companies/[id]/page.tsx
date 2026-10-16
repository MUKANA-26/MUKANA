import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Building2, Globe, MapPin, Factory } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { VerifiedBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { companyLogoUrl } from "@/lib/storage";
import { OPP_SELECT } from "@/features/opportunities/queries";
import { OpportunityCard } from "@/features/opportunities/opportunity-card";
import { ReportButton } from "@/features/opportunities/opportunity-buttons";
import type { CompanyRow, OpportunityWithCompany } from "@/types/db";

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const today = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
  const [{ data: company }, { data: opps }] = await Promise.all([
    supabase.from("companies").select("id, owner_id, name, logo_path, industry, location, website, description, verification_status, suspended").eq("id", id).maybeSingle(),
    supabase.from("opportunities").select(OPP_SELECT).eq("company_id", id).eq("status", "published").gte("deadline", today).order("published_at", { ascending: false }),
  ]);
  if (!company) return null;
  return { company: company as CompanyRow, opps: (opps ?? []) as unknown as OpportunityWithCompany[] };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await load((await params).id);
  if (!data) return { title: "Company not found" };
  return { title: data.company.name, description: data.company.description?.slice(0, 160) ?? `Opportunities at ${data.company.name} on Mukana.` };
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await load((await params).id);
  if (!data) notFound();
  const { company: c, opps } = data;
  const session = await getSession();
  const logo = companyLogoUrl(c.logo_path);
  const isOwner = session?.id === c.owner_id;

  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <header className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="h-24 bg-gradient-to-r from-navy via-blue to-green sm:h-32" aria-hidden />
          <div className="px-4 pb-5 sm:px-6">
            <div className="-mt-10 grid size-20 place-items-center overflow-hidden rounded-xl border-4 border-surface bg-white sm:-mt-12 sm:size-24">
              {logo ? <Image src={logo} alt={`${c.name} logo`} width={96} height={96} className="size-full object-contain" priority /> : <Building2 className="size-9 text-muted-foreground" aria-hidden />}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold">{c.name}</h1>
              {c.verification_status === "approved" ? <VerifiedBadge /> : null}
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {c.industry ? (
                <span className="inline-flex items-center gap-1.5">
                  <Factory className="size-4" aria-hidden /> {c.industry}
                </span>
              ) : null}
              {c.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden /> {c.location}
                </span>
              ) : null}
              {c.website ? (
                <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-link hover:underline">
                  <Globe className="size-4" aria-hidden /> {c.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
            </p>
            {session && session.role !== "admin" && !isOwner ? (
              <div className="mt-2">
                <ReportButton targetType="company" targetId={c.id} label="Report company" />
              </div>
            ) : null}
          </div>
        </header>

        {c.description ? (
          <section className="mt-5 rounded-xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="about-co">
            <h2 id="about-co" className="font-heading text-lg font-semibold">
              About
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-7">{c.description}</p>
          </section>
        ) : null}

        <section className="mt-6" aria-labelledby="open-roles">
          <h2 id="open-roles" className="mb-3 font-heading text-lg font-semibold">
            Open opportunities ({opps.length})
          </h2>
          {opps.length === 0 ? (
            <EmptyState icon={<Building2 aria-hidden />} title="No open opportunities right now" description="Check back soon, or browse opportunities from other employers." />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {opps.map((o) => (
                <li key={o.id} className="relative">
                  <OpportunityCard opportunity={o} href={session?.role === "candidate" ? `/candidate/opportunities/${o.id}` : `/opportunities/${o.id}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdaptiveLayout>
  );
}