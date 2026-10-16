import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  FileSearch,
  GraduationCap,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Wifi,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { FullLogo } from "@/components/brand/logo";
import { InstallButton } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  { icon: UserRoundCheck, title: "Build your profile", body: "Add your institution, skills and CV once. Our CV builder helps if you have no work experience yet." },
  { icon: Sparkles, title: "Get matched", body: "See a clear match score for every opportunity with the reasons behind it, so you apply where you fit." },
  { icon: Send, title: "Apply in one tap", body: "Apply with your saved profile and CV, then follow every step from Submitted to Accepted." },
];

export default function LandingPage() {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-gradient-to-b from-info-soft/60 to-background">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-soft-foreground">
              <BadgeCheck className="size-4" aria-hidden /> Verified Zimbabwean employers
            </p>
            <h1 className="mt-4 font-heading text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Your opportunity starts <span className="text-link">here.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Mukana connects industrial attachees and graduate trainees across Zimbabwe with employers who are ready to
              train the next generation.
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
          </div>
          <div className="flex justify-center md:justify-end">
            <FullLogo size={340} priority className="shadow-lg ring-1 ring-border" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="font-heading text-2xl font-semibold">Made for two groups</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <span className="grid size-11 place-items-center rounded-xl bg-info-soft text-info-soft-foreground">
                <BriefcaseBusiness aria-hidden />
              </span>
              <CardTitle className="mt-2 text-lg">Attachees</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Students looking for industrial attachment placements. Match by programme, level and attachment dates, and
              attach your institution&apos;s placement letter.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <span className="grid size-11 place-items-center rounded-xl bg-success-soft text-success-soft-foreground">
                <GraduationCap aria-hidden />
              </span>
              <CardTitle className="mt-2 text-lg">Graduate trainees</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Recent graduates looking for structured trainee programmes. Match by qualification, degree class and
              availability.
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="font-heading text-2xl font-semibold">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground">
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

      <section id="employers" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <div className="grid items-center gap-6 rounded-2xl bg-primary p-6 text-primary-foreground sm:p-10 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="font-heading text-2xl font-semibold">Hiring attachees or graduate trainees?</h2>
            <p className="mt-2 text-sm opacity-90 sm:text-base">
              Get verified, publish opportunities, review applicants in a built-in document viewer and schedule
              interviews, all in one place. Matches are explainable and you make every decision.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="cta">
                <Link href="/sign-up?role=employer">Register your company</Link>
              </Button>
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden /> Admin-verified company badge</li>
            <li className="flex items-start gap-3"><FileSearch className="mt-0.5 size-5 shrink-0" aria-hidden /> View CVs securely, right in the page</li>
            <li className="flex items-start gap-3"><Wifi className="mt-0.5 size-5 shrink-0" aria-hidden /> Works on low bandwidth and offline</li>
          </ul>
        </div>
      </section>
    </PublicLayout>
  );
}
