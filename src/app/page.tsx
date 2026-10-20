import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  FileSearch,
  FileText,
  GraduationCap,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Users,
  Wifi,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Blobs, ChevronBand, HeroPhone, MatchBreakdownCard, PipelineArt } from "@/components/landing/art";
import { InstallButton } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";
import { GoogleButton } from "@/features/auth/google-button";

const steps = [
  { icon: UserRoundCheck, title: "Build your profile", body: "Add your institution, skills and CV once. Our CV builder helps if you have no work experience yet." },
  { icon: Sparkles, title: "Get matched", body: "See a clear match score for every opportunity with the reasons behind it, so you apply where you fit." },
  { icon: Send, title: "Apply in one tap", body: "Apply with your saved profile and CV, then follow every step from Submitted to Accepted." },
];

const features = [
  { icon: Sparkles, title: "Explainable matches", body: "A score out of 100 with plain reasons. Nothing is rejected automatically.", tone: "bg-success-soft text-success-soft-foreground", href: "/opportunities" },
  { icon: FileText, title: "Free CV builder", body: "Make a clean PDF CV in minutes, even with no work experience.", tone: "bg-info-soft text-info-soft-foreground", href: "/sign-up" },
  { icon: Users, title: "Your network", body: "Connect with classmates, lecturers and employers. Get endorsed for your skills.", tone: "bg-warning-soft text-warning-soft-foreground", href: "/sign-up" },
  { icon: MessageCircle, title: "Chat and community", body: "Message employers, join groups and share what you are learning.", tone: "bg-info-soft text-info-soft-foreground", href: "/sign-up" },
  { icon: CalendarDays, title: "Events and career fairs", body: "Webinars, meet-ups and career fairs hosted by verified companies.", tone: "bg-success-soft text-success-soft-foreground", href: "/events" },
  { icon: BookOpen, title: "Learn and earn badges", body: "Interview tips, career guides and short quizzes that earn skill badges.", tone: "bg-warning-soft text-warning-soft-foreground", href: "/learn" },
];

const trust = [
  { icon: ShieldCheck, text: "Admin-verified employers" },
  { icon: GraduationCap, text: "Free for students and graduates" },
  { icon: Wifi, text: "Works on low data" },
  { icon: BadgeCheck, text: "English, chiShona, isiNdebele" },
];

export default function LandingPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-info-soft/70 to-background">
        <Blobs />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-[1.1fr_0.9fr] md:py-16">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-soft-foreground">
              <BadgeCheck className="size-4" aria-hidden /> Verified Zimbabwean employers
            </p>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Your opportunity starts <span className="bg-gradient-to-r from-link to-success bg-clip-text text-transparent">here.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Mukana connects industrial attachees and graduate trainees across Zimbabwe with employers who are ready to train the next generation. Find a
              placement, build your profile and get hired.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="cta" size="lg">
                <Link href="/opportunities">
                  Browse opportunities <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/sign-up">Create free account</Link>
              </Button>
              <InstallButton variant="secondary" size="lg" />
            </div>
            <div className="mt-5 max-w-sm">
              <GoogleButton label="Continue with Google" />
            </div>
          </div>
          <HeroPhone />
        </div>
        <ChevronBand className="bottom-0 text-cta/40" />
      </section>

      {/* Trust strip */}
      <section aria-label="Why Mukana" className="border-b border-border bg-surface">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 py-5 md:grid-cols-4">
          {trust.map((t) => (
            <li key={t.text} className="flex items-center gap-3 text-sm font-medium">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-info-soft text-info-soft-foreground">
                <t.icon className="size-4" aria-hidden />
              </span>
              {t.text}
            </li>
          ))}
        </ul>
      </section>

      {/* Two groups */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Made for two groups</h2>
        <p className="mt-1 text-muted-foreground">Whichever stage you are at, Mukana speaks your language.</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <article className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-link" />
            <span className="grid size-12 place-items-center rounded-xl bg-info-soft text-info-soft-foreground">
              <BriefcaseBusiness aria-hidden />
            </span>
            <h3 className="mt-3 font-heading text-xl font-semibold">Attachees</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Students looking for industrial attachment or internship placements. Match by programme, level and attachment dates, and attach your institution&apos;s placement letter.
            </p>
            <Link href="/sign-up" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-link hover:underline">
              Start as an attachee <ArrowRight className="size-4" aria-hidden />
            </Link>
          </article>
          <article className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-success" />
            <span className="grid size-12 place-items-center rounded-xl bg-success-soft text-success-soft-foreground">
              <GraduationCap aria-hidden />
            </span>
            <h3 className="mt-3 font-heading text-xl font-semibold">Graduate trainees</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent graduates looking for trainee programmes, internships and entry-level jobs. Match by qualification, degree class and availability.
            </p>
            <Link href="/sign-up" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-link hover:underline">
              Start as a graduate <ArrowRight className="size-4" aria-hidden />
            </Link>
          </article>
        </div>
      </section>

      {/* Match explainer */}
      <section className="relative overflow-hidden border-y border-border bg-surface-muted">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2">
          <div>
            <h2 className="font-heading text-2xl font-semibold sm:text-3xl">See exactly why you match</h2>
            <p className="mt-3 text-muted-foreground">
              No black box. Every opportunity shows a score out of 100 built from five things you can understand and improve: your field of study, your
              skills, your level, when you are available and where you are.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex items-start gap-2"><BadgeCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> Employers see the same breakdown for their applicants</li>
              <li className="flex items-start gap-2"><BadgeCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> A match only ranks people. Nobody is rejected automatically</li>
              <li className="flex items-start gap-2"><BadgeCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> Fill in your profile to raise your score</li>
            </ul>
          </div>
          <MatchBreakdownCard className="mx-auto w-full max-w-md" />
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-heading text-2xl font-semibold sm:text-3xl">More than a job board</h2>
        <p className="mt-1 text-muted-foreground">Everything a young Zimbabwean professional needs to start a career, in one app.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <li key={f.title}>
              <Link href={f.href} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <span className={`grid size-12 place-items-center rounded-xl ${f.tone}`}>
                  <f.icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-3 font-heading text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{f.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-link group-hover:underline">
                  Learn more <ArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="font-heading text-2xl font-semibold sm:text-3xl">How it works</h2>
          <ol className="relative mt-8 grid gap-5 md:grid-cols-3">
            <div aria-hidden className="absolute left-[16%] right-[16%] top-10 hidden h-0.5 bg-gradient-to-r from-link via-success to-cta md:block" />
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-border bg-surface p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="relative z-10 grid size-10 place-items-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground ring-4 ring-surface-muted">
                    {i + 1}
                  </span>
                  <s.icon className="size-5 text-link" aria-hidden />
                </div>
                <h3 className="mt-3 font-heading font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Employers */}
      <section id="employers" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
        <div className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground sm:p-10">
          <ChevronBand className="bottom-0 text-white/10" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1.3fr_1fr]">
            <div>
              <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Hiring attachees or graduate trainees?</h2>
              <p className="mt-3 text-sm opacity-90 sm:text-base">
                Get verified, publish opportunities, find talent, review applicants in a built-in document viewer and schedule interviews, all in one place. Matches
                are explainable and you make every decision.
              </p>
              <div className="mt-5">
                <PipelineArt />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild variant="cta" size="lg">
                  <Link href="/sign-up?role=employer">Register your company</Link>
                </Button>
              </div>
            </div>
            <ul className="space-y-3 rounded-2xl bg-white/10 p-5 text-sm backdrop-blur">
              <li className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden /> Admin-verified company badge</li>
              <li className="flex items-start gap-3"><FileSearch className="mt-0.5 size-5 shrink-0" aria-hidden /> View CVs securely, right in the page</li>
              <li className="flex items-start gap-3"><Users className="mt-0.5 size-5 shrink-0" aria-hidden /> Search talent, shortlist and invite to apply</li>
              <li className="flex items-start gap-3"><Wifi className="mt-0.5 size-5 shrink-0" aria-hidden /> Works on low bandwidth and offline</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Final call to action */}
      <section className="relative overflow-hidden border-t border-border bg-gradient-to-b from-background to-info-soft/60">
        <Blobs />
        <div className="relative mx-auto max-w-3xl px-4 py-14 text-center">
          <h2 className="font-heading text-3xl font-bold">Ready to start?</h2>
          <p className="mt-2 text-muted-foreground">Create your free account in a minute and see opportunities that fit you.</p>
          <div className="mx-auto mt-6 max-w-sm space-y-3">
            <GoogleButton label="Continue with Google" />
            <Button asChild variant="cta" size="lg" className="w-full">
              <Link href="/sign-up">Create free account</Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-semibold text-link hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
