import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Building2, CalendarClock, Clock, GraduationCap, Laptop, MapPin, Users, Wallet } from "lucide-react";
import { Badge, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { companyLogoUrl } from "@/lib/storage";
import { daysUntil, formatDate } from "@/lib/utils";
import { QUALIFICATION_LEVELS, labelOf } from "@/lib/zimbabwe";
import { MatchCard } from "@/features/matching/match-card";
import { getCompleteness } from "@/features/profile/queries";
import type { ApplicationStatus, Completeness, MatchResult } from "@/types/db";
import { ApplyPanel } from "./apply-panel";
import { DeadlineTag, TYPE_LABEL, stipendLabel } from "./opportunity-card";
import { fitsCandidate, showsMinLevel, showsMinQualification, typeSentence, type CandidateType } from "@/lib/opportunity-types";
import { ReportButton, SaveButton, ShareButton } from "./opportunity-buttons";
import { getOpportunity } from "./queries";

function Fact({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium">{children}</dd>
      </div>
    </div>
  );
}

/** Opportunity page body. Works for visitors, candidates, the owning employer and admins. */
export async function OpportunityDetailView({ id, trackBase = "/candidate/applications" }: { id: string; trackBase?: string }) {
  const o = await getOpportunity(id);
  if (!o) notFound();
  const session = await getSession();
  const supabase = await createClient();
  const logo = companyLogoUrl(o.companies?.logo_path);

  let saved = false;
  let application: { id: string; status: ApplicationStatus } | null = null;
  let completeness: Completeness = { percent: 0, missing: [], complete: false };
  let match: MatchResult | null = null;
  let isOwner = false;
  let typeMismatch = false;

  if (session?.role === "candidate") {
    const [savedRes, appRes, comp, matchRes, cp] = await Promise.all([
      supabase.from("saved_opportunities").select("opportunity_id").eq("user_id", session.id).eq("opportunity_id", id).maybeSingle(),
      supabase.from("applications").select("id, status").eq("opportunity_id", id).eq("candidate_id", session.id).maybeSingle(),
      getCompleteness(session.id),
      supabase.rpc("compute_match", { p_candidate: session.id, p_opportunity: id }),
      supabase.from("candidate_profiles").select("candidate_type").eq("user_id", session.id).maybeSingle(),
    ]);
    saved = Boolean(savedRes.data);
    application = (appRes.data as { id: string; status: ApplicationStatus } | null) ?? null;
    completeness = comp;
    match = (matchRes.data as MatchResult | null) ?? null;
    const t = cp.data?.candidate_type as string | undefined;
    typeMismatch = Boolean(t) && !fitsCandidate(o.type, t as CandidateType);
  } else if (session?.role === "employer") {
    const { data } = await supabase.rpc("manages_company", { p_company: o.company_id });
    isOwner = data === true;
  }

  const left = daysUntil(o.deadline);
  const isOpen = o.status === "published" && !o.suspended && (left === null || left >= 0);
  const closedReason = o.suspended ? "This opportunity has been suspended by a moderator." : o.status === "closed" || (left !== null && left < 0) ? "The deadline has passed." : "This opportunity is not published yet.";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white">
            {logo ? <Image src={logo} alt={`${o.companies?.name ?? "Company"} logo`} width={64} height={64} className="size-16 object-contain" priority /> : <Building2 className="size-8 text-muted-foreground" aria-hidden />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={o.type === "industrial_attachment" || o.type === "internship" ? "info" : "success"}>{TYPE_LABEL[o.type]}</Badge>
              <DeadlineTag deadline={o.deadline} status={o.status} />
              {o.status === "draft" ? <Badge variant="warning">Draft preview</Badge> : null}
            </div>
            <h1 className="mt-2 font-heading text-2xl font-bold leading-tight sm:text-3xl">{o.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
              <Link href={`/companies/${o.company_id}`} className="font-medium text-foreground hover:underline">{o.companies?.name}</Link>
              {o.companies?.verification_status === "approved" ? <VerifiedBadge /> : null}
              {o.department ? <span>· {o.department}</span> : null}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {session?.role === "candidate" ? <SaveButton opportunityId={o.id} saved={saved} /> : null}
          <ShareButton title={o.title} />
          {session && session.role !== "admin" && !isOwner ? <ReportButton targetType="opportunity" targetId={o.id} /> : null}
          {isOwner ? (
            <Button asChild variant="outline">
              <Link href={`/employer/opportunities/${o.id}/edit`}>Edit opportunity</Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section aria-labelledby="about">
            <h2 id="about" className="font-heading text-lg font-semibold">
              About the role
            </h2>
            <p className="mt-2 whitespace-pre-line leading-7">{o.description}</p>
          </section>
          {o.requirements ? (
            <section aria-labelledby="reqs">
              <h2 id="reqs" className="font-heading text-lg font-semibold">
                Requirements
              </h2>
              <p className="mt-2 whitespace-pre-line leading-7">{o.requirements}</p>
            </section>
          ) : null}
          {o.skills.length ? (
            <section aria-labelledby="skills">
              <h2 id="skills" className="font-heading text-lg font-semibold">
                Required skills
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {o.skills.map((s) => (
                  <li key={s}>
                    <Badge variant="info">{s}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {o.eligible_fields.length ? (
            <section aria-labelledby="fields">
              <h2 id="fields" className="font-heading text-lg font-semibold">
                Eligible programmes
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {o.eligible_fields.map((s) => (
                  <li key={s}>
                    <Badge variant="neutral">{s}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {session?.role === "candidate" && match && !typeMismatch ? <MatchCard match={match} /> : null}
        </div>

        <aside className="space-y-4">
          {!session ? (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <h2 className="font-heading font-semibold">Interested?</h2>
              <p className="text-sm text-muted-foreground">Sign in or create a free account to apply and see how well you match.</p>
              <Button asChild variant="cta" size="lg" className="w-full">
                <Link href={`/sign-in?next=${encodeURIComponent(`/opportunities/${o.id}`)}`}>Sign in to apply</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/sign-up">Create account</Link>
              </Button>
            </div>
          ) : session.role === "candidate" ? (
            typeMismatch ? (
              <div className="rounded-xl border border-border bg-surface-muted p-4 text-sm">
                This is {typeSentence(o.type)}. Your profile is set up for the other type, so you can browse it but not apply.
                <Link href="/candidate/profile/edit" className="mt-2 block font-semibold text-link underline">
                  Change my candidate type
                </Link>
              </div>
            ) : (
              <ApplyPanel
                opportunityId={o.id}
                open={isOpen}
                closedReason={closedReason}
                emailVerified={session.emailVerified}
                completeness={completeness}
                application={application}
                trackBase={trackBase}
              />
            )
          ) : null}

          <dl className="space-y-4 rounded-xl border border-border bg-surface p-4">
            <Fact icon={MapPin} label="Location">
              {o.location}
              {o.province ? `, ${o.province}` : ""}
            </Fact>
            <Fact icon={Laptop} label="Work mode">
              {o.mode === "hybrid" ? "Hybrid" : "On-site"}
            </Fact>
            <Fact icon={Wallet} label="Stipend">
              {stipendLabel(o)}
            </Fact>
            {o.duration_months ? (
              <Fact icon={Clock} label="Duration">
                {o.duration_months} month{o.duration_months === 1 ? "" : "s"}
              </Fact>
            ) : null}
            {o.start_date ? (
              <Fact icon={CalendarClock} label="Start date">
                {formatDate(o.start_date)}
              </Fact>
            ) : null}
            <Fact icon={CalendarClock} label="Apply by">
              {formatDate(o.deadline)}
            </Fact>
            <Fact icon={Users} label="Slots">
              {o.slots}
            </Fact>
            {showsMinLevel(o.type) ? (
              <Fact icon={GraduationCap} label="Minimum level">
                {o.min_level ? Number(o.min_level).toFixed(1) : "None"}
              </Fact>
            ) : null}
            {showsMinQualification(o.type) ? (
              <Fact icon={GraduationCap} label="Minimum qualification">
                {o.min_qualification ? labelOf(QUALIFICATION_LEVELS, o.min_qualification) : "None"}
              </Fact>
            ) : null}
          </dl>

          {o.companies?.name ? (
            <div className="rounded-xl border border-border bg-surface p-4 text-sm">
              <Link href={`/companies/${o.company_id}`} className="font-semibold hover:underline">{o.companies.name}</Link>
              <p className="text-xs text-link">View company page</p>
              <p className="text-muted-foreground">{[o.companies.industry, o.companies.location].filter(Boolean).join(" · ")}</p>
              {session && session.role !== "admin" && !isOwner ? (
                <div className="mt-2">
                  <ReportButton targetType="company" targetId={o.company_id} label="Report company" />
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
