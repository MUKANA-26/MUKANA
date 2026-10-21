import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, Building, CheckCircle2, ChevronLeft, CircleDashed, GraduationCap, Landmark, Rocket, Wallet, Wrench } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SaveCareerButton } from "@/features/careers/save-career-button";
import { OPP_SELECT } from "@/features/opportunities/queries";
import { OpportunityCard } from "@/features/opportunities/opportunity-card";
import type { OpportunityWithCompany } from "@/types/db";

interface Career {
  id: string;
  slug: string;
  field: string;
  title: string;
  summary: string;
  what_you_do: string | null;
  entry_roles: string[];
  path: { stage: string; roles: string; years: string }[];
  qualifications: string[];
  subjects: string[];
  institutions: string[];
  bodies: string[];
  skills: string[];
  tools: string[];
  how_to_start: string | null;
  pay: { entry: [number, number]; mid: [number, number]; senior: [number, number] } | null;
  keywords: string[];
}

async function load(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("careers").select("*").eq("slug", slug).eq("published", true).maybeSingle();
  return { career: data as Career | null, supabase };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { career } = await load((await params).slug);
  return career ? { title: `${career.title}: career path`, description: career.summary } : { title: "Career" };
}

const clean = (s: string) => s.replace(/[%,()*\\]/g, " ").trim().toLowerCase();
const matches = (have: string[], need: string) => have.some((h) => h === need || (h.length >= 3 && need.length >= 3 && (h.includes(need) || need.includes(h))));
const money = ([a, b]: [number, number]) => `US$${a.toLocaleString("en-US")} to ${b.toLocaleString("en-US")}`;

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
        <Icon className="size-5 text-link" aria-hidden /> {title}
      </h2>
      <div className="mt-3 text-sm leading-6">{children}</div>
    </section>
  );
}
const Bullets = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((i) => (
      <li key={i}>{i}</li>
    ))}
  </ul>
);

export default async function CareerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { career: c, supabase } = await load(slug);
  if (!c) notFound();
  const session = await getSession();
  const today = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);

  const orFilter = c.keywords.map(clean).filter(Boolean).map((k) => `title.ilike.%${k}%`).join(",");
  const [oppRes, lessonRes, mine, savedRes] = await Promise.all([
    orFilter
      ? supabase.from("opportunities").select(OPP_SELECT).eq("status", "published").gte("deadline", today).or(orFilter).order("published_at", { ascending: false }).limit(6)
      : Promise.resolve({ data: [] }),
    supabase.from("lessons").select("slug, title, minutes").eq("published", true).overlaps("skills", c.skills).limit(5),
    session?.role === "candidate" ? supabase.from("candidate_profiles").select("skills").eq("user_id", session.id).maybeSingle() : Promise.resolve({ data: null }),
    session ? supabase.from("saved_careers").select("career_id").eq("career_id", c.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const opps = (oppRes.data ?? []) as unknown as OpportunityWithCompany[];
  const lessons = (lessonRes.data ?? []) as { slug: string; title: string; minutes: number }[];
  const mySkills = ((mine.data?.skills as string[] | null) ?? []).map((s) => s.toLowerCase());
  const haveSkills = mine.data ? c.skills.filter((s) => matches(mySkills, s.toLowerCase())) : [];
  const missing = mine.data ? c.skills.filter((s) => !haveSkills.includes(s)) : [];
  const detailBase = session?.role === "candidate" ? "/candidate/opportunities" : "/opportunities";

  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/careers" className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> All careers
        </Link>

        <header className="rounded-2xl border border-border bg-gradient-to-br from-info-soft to-surface p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-bold sm:text-3xl">{c.title}</h1>
              <p className="mt-1 max-w-2xl text-muted-foreground">{c.summary}</p>
            </div>
            {session ? <SaveCareerButton careerId={c.id} userId={session.id} initiallySaved={Boolean(savedRes.data)} /> : null}
          </div>
          {c.what_you_do ? <p className="mt-3 text-sm leading-6">{c.what_you_do}</p> : null}
          {c.entry_roles.length ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">Ways in:</span>
              {c.entry_roles.map((r) => (
                <Badge key={r} variant="success">
                  {r}
                </Badge>
              ))}
            </p>
          ) : null}
        </header>

        <Section icon={Rocket} title="Your path, step by step">
          <ol className="relative space-y-4 border-l-2 border-border pl-5">
            {c.path.map((p, i) => (
              <li key={p.stage} className="relative">
                <span className="absolute -left-[1.85rem] top-0.5 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                <p className="font-semibold">
                  {p.stage} <span className="font-normal text-muted-foreground">· {p.years}</span>
                </p>
                <p className="text-muted-foreground">{p.roles}</p>
              </li>
            ))}
          </ol>
        </Section>

        <div className="grid gap-5 md:grid-cols-2">
          <Section icon={GraduationCap} title="Qualifications">
            <Bullets items={c.qualifications} />
            {c.subjects.length ? (
              <>
                <p className="mt-3 font-semibold">Useful school subjects</p>
                <p className="text-muted-foreground">{c.subjects.join(", ")}</p>
              </>
            ) : null}
          </Section>
          <Section icon={Building} title="Where to study">
            <Bullets items={c.institutions} />
            {c.bodies.length ? (
              <>
                <p className="mt-3 flex items-center gap-1.5 font-semibold">
                  <Landmark className="size-4" aria-hidden /> Professional bodies
                </p>
                <p className="text-muted-foreground">{c.bodies.join(", ")}</p>
              </>
            ) : null}
          </Section>
        </div>

        <Section icon={Wrench} title="Skills to build">
          {mine.data ? (
            <p className="mb-3 text-muted-foreground">
              You already have <strong className="text-foreground">{haveSkills.length}</strong> of {c.skills.length} key skills on your profile.
            </p>
          ) : null}
          <ul className="flex flex-wrap gap-2">
            {c.skills.map((s) => {
              const has = haveSkills.includes(s);
              return (
                <li key={s} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${has ? "border-success bg-success-soft text-success-soft-foreground" : "border-border"}`}>
                  {mine.data ? has ? <CheckCircle2 className="size-4" aria-label="You have this" /> : <CircleDashed className="size-4 text-muted-foreground" aria-label="To build" /> : null}
                  {s}
                </li>
              );
            })}
          </ul>
          {c.tools.length ? (
            <p className="mt-3 text-muted-foreground">
              <span className="font-semibold text-foreground">Tools:</span> {c.tools.join(", ")}
            </p>
          ) : null}
          {mine.data && missing.length > 0 ? (
            <p className="mt-3 text-muted-foreground">
              Add skills to your <Link href="/candidate/profile/edit" className="font-semibold text-link underline">profile</Link> as you learn them.
            </p>
          ) : null}
        </Section>

        {c.how_to_start ? (
          <Section icon={Briefcase} title="How to start">
            <p>{c.how_to_start}</p>
          </Section>
        ) : null}

        {c.pay ? (
          <Section icon={Wallet} title="Typical pay (rough guide)">
            <dl className="grid gap-3 sm:grid-cols-3">
              {([["Entry level", c.pay.entry], ["Mid career", c.pay.mid], ["Senior", c.pay.senior]] as const).map(([label, range]) => (
                <div key={label} className="rounded-lg bg-surface-muted p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-heading font-semibold">{money(range)}</dd>
                  <dd className="text-xs text-muted-foreground">per month</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Illustrative ranges only. Real pay depends on the employer, location, qualifications and the economy, and attachments are often paid less or not at all. Always check the opportunity.</p>
          </Section>
        ) : null}

        {lessons.length > 0 ? (
          <Section icon={GraduationCap} title="Lessons to get you ready">
            <ul className="space-y-1">
              {lessons.map((l) => (
                <li key={l.slug}>
                  <Link href={`/skills/${l.slug}`} className="font-medium text-link hover:underline">
                    {l.title}
                  </Link>{" "}
                  <span className="text-muted-foreground">({l.minutes} min)</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <section aria-labelledby="open-now">
          <h2 id="open-now" className="mb-3 font-heading text-lg font-semibold">
            Opportunities on Mukana right now
          </h2>
          {opps.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
              Nothing matching is open at the moment. <Link href="/candidate/alerts" className="font-semibold text-link underline">Set a job alert</Link> to hear when one opens.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {opps.map((o) => (
                <li key={o.id} className="relative">
                  <OpportunityCard opportunity={o} href={`${detailBase}/${o.id}`} />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href="/early-careers">See all early-career opportunities</Link>
            </Button>
          </div>
        </section>
      </div>
    </AdaptiveLayout>
  );
}
