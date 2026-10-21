import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Building2, CalendarDays, Factory, Gift, Globe, Heart, MapPin, Search, Users } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { VerifiedBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { getSession } from "@/lib/auth";
import { signAvatarUrl } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import { companyLogoUrl } from "@/lib/storage";
import { FollowCompanyButton } from "@/features/companies/follow-button";
import { ReviewsSection, type MyReview, type RatingSummary } from "@/features/companies/reviews-section";
import { Stars } from "@/features/companies/stars";
import { FeedList } from "@/features/feed/feed-list";
import { OPP_SELECT } from "@/features/opportunities/queries";
import { OpportunityCard } from "@/features/opportunities/opportunity-card";
import { ReportButton } from "@/features/opportunities/opportunity-buttons";
import type { OpportunityWithCompany } from "@/types/db";

interface PageData {
  company: {
    id: string;
    owner_id: string;
    name: string;
    logo_path: string | null;
    industry: string | null;
    location: string | null;
    website: string | null;
    description: string | null;
    verification_status: string;
    tagline: string | null;
    size_band: string | null;
    founded_year: number | null;
    locations: string[];
    benefits: string[];
    culture: string | null;
    looking_for: string | null;
    gallery_paths: string[];
  };
  rating: RatingSummary;
  followers: number;
  following: boolean;
  can_review: boolean;
  my_review: MyReview | null;
  open_roles: number;
}

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const today = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
  const [{ data, error }, { data: opps }] = await Promise.all([
    supabase.rpc("company_page_data", { p_id: id }),
    supabase.from("opportunities").select(OPP_SELECT).eq("company_id", id).eq("status", "published").gte("deadline", today).order("published_at", { ascending: false }),
  ]);
  let page = data as PageData | null;
  if (error) {
    // Older database (before migration 0019): show the basic company page.
    const { data: c } = await supabase.from("companies").select("id, owner_id, name, logo_path, industry, location, website, description, verification_status").eq("id", id).eq("suspended", false).maybeSingle();
    if (c) {
      page = {
        company: { ...(c as Omit<PageData["company"], "tagline" | "size_band" | "founded_year" | "locations" | "benefits" | "culture" | "looking_for" | "gallery_paths">), tagline: null, size_band: null, founded_year: null, locations: [], benefits: [], culture: null, looking_for: null, gallery_paths: [] },
        rating: { count: 0, avg: 0, distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } },
        followers: 0,
        following: false,
        can_review: false,
        my_review: null,
        open_roles: (opps ?? []).length,
      };
    }
  }
  if (!page) return null;
  return { page, opps: (opps ?? []) as unknown as OpportunityWithCompany[] };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await load((await params).id);
  if (!data) return { title: "Company not found" };
  const c = data.page.company;
  return { title: c.name, description: (c.tagline ?? c.description)?.slice(0, 160) ?? `Opportunities at ${c.name} on Mukana.` };
}

function Card({ id, icon: Icon, title, children }: { id: string; icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <h2 id={id} className="flex items-center gap-2 font-heading text-lg font-semibold">
        <Icon className="size-5 text-link" aria-hidden /> {title}
      </h2>
      <div className="mt-2 text-sm leading-7">{children}</div>
    </section>
  );
}

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await load((await params).id);
  if (!data) notFound();
  const { page, opps } = data;
  const c = page.company;
  const session = await getSession();
  const logo = companyLogoUrl(c.logo_path);
  const isOwner = session?.id === c.owner_id;
  const myAvatar = session ? await signAvatarUrl(session.avatar_path) : null;
  const gallery = c.gallery_paths.map((p) => companyLogoUrl(p)).filter((u): u is string => Boolean(u));
  const rating = Number(page.rating.avg);

  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <header className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="h-24 bg-gradient-to-r from-navy via-blue to-green sm:h-32" aria-hidden />
          <div className="px-4 pb-5 sm:px-6">
            <div className="-mt-10 flex items-end justify-between gap-3 sm:-mt-12">
              <div className="grid size-20 place-items-center overflow-hidden rounded-xl border-4 border-surface bg-white sm:size-24">
                {logo ? <Image src={logo} alt={`${c.name} logo`} width={96} height={96} className="size-full object-contain" priority /> : <Building2 className="size-9 text-muted-foreground" aria-hidden />}
              </div>
              {!isOwner ? <FollowCompanyButton companyId={c.id} userId={session?.id ?? null} initiallyFollowing={page.following} followers={page.followers} /> : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold">{c.name}</h1>
              {c.verification_status === "approved" ? <VerifiedBadge /> : null}
            </div>
            {c.tagline ? <p className="mt-1 text-muted-foreground">{c.tagline}</p> : null}
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
              {c.size_band ? (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden /> {c.size_band} employees
                </span>
              ) : null}
              {c.founded_year ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden /> Founded {c.founded_year}
                </span>
              ) : null}
              {c.website ? (
                <a href={c.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-link hover:underline">
                  <Globe className="size-4" aria-hidden /> {c.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {page.rating.count > 0 ? (
                <a href="#reviews-h" className="inline-flex items-center gap-1.5 hover:underline">
                  <Stars value={rating} /> <strong>{rating.toFixed(1)}</strong> <span className="text-muted-foreground">({page.rating.count} review{page.rating.count === 1 ? "" : "s"})</span>
                </a>
              ) : (
                <span className="text-muted-foreground">No reviews yet</span>
              )}
              <a href="#open-roles" className="inline-flex items-center gap-1.5 font-medium text-link hover:underline">
                <Briefcase className="size-4" aria-hidden /> {page.open_roles} open role{page.open_roles === 1 ? "" : "s"}
              </a>
            </p>
            {session && session.role !== "admin" && !isOwner ? (
              <div className="mt-2">
                <ReportButton targetType="company" targetId={c.id} label="Report company" />
              </div>
            ) : null}
            {isOwner ? (
              <p className="mt-3 rounded-lg bg-info-soft px-3 py-2 text-sm text-info-soft-foreground">
                This is how candidates see your company. <Link href="/employer/company" className="font-semibold underline">Edit your profile</Link> to add a tagline, benefits, culture and photos.
              </p>
            ) : null}
          </div>
        </header>

        {c.description ? (
          <Card id="about-co" icon={Building2} title="About">
            <p className="whitespace-pre-line">{c.description}</p>
          </Card>
        ) : null}

        {c.locations.length > 0 ? (
          <Card id="loc-co" icon={MapPin} title="Locations">
            <ul className="flex flex-wrap gap-2">
              {c.locations.map((l) => (
                <li key={l} className="rounded-full border border-border px-3 py-1">
                  {l}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {c.culture || c.benefits.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {c.culture ? (
              <Card id="culture-co" icon={Heart} title="Culture">
                <p className="whitespace-pre-line">{c.culture}</p>
              </Card>
            ) : null}
            {c.benefits.length > 0 ? (
              <Card id="benefits-co" icon={Gift} title="Benefits and support">
                <ul className="flex flex-wrap gap-2">
                  {c.benefits.map((b) => (
                    <li key={b} className="rounded-full bg-success-soft px-3 py-1 text-success-soft-foreground">
                      {b}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        ) : null}

        {c.looking_for ? (
          <Card id="look-co" icon={Search} title="What we look for in attachees and graduates">
            <p className="whitespace-pre-line">{c.looking_for}</p>
          </Card>
        ) : null}

        {gallery.length > 0 ? (
          <section aria-label="Photos" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {gallery.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt={`${c.name} photo ${i + 1}`} loading="lazy" className="h-40 w-full rounded-xl object-cover" />
            ))}
          </section>
        ) : null}

        <section aria-labelledby="open-roles">
          <h2 id="open-roles" className="mb-3 font-heading text-lg font-semibold">
            Open opportunities ({opps.length})
          </h2>
          {opps.length === 0 ? (
            <EmptyState icon={<Building2 aria-hidden />} title="No open opportunities right now" description="Follow the company to remember it, or browse opportunities from other employers." />
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

        <ReviewsSection companyId={c.id} summary={page.rating} signedIn={Boolean(session)} role={session?.role ?? null} canReview={page.can_review} myReview={page.my_review} isOwner={isOwner} />

        {session ? (
          <section aria-labelledby="updates-co">
            <h2 id="updates-co" className="mb-3 font-heading text-lg font-semibold">
              Recent updates
            </h2>
            <FeedList userId={session.id} role={session.role} name={session.full_name || session.email} avatarUrl={myAvatar} authorId={c.owner_id} emptyText="No updates from this company yet." />
          </section>
        ) : null}
      </div>
    </AdaptiveLayout>
  );
}
