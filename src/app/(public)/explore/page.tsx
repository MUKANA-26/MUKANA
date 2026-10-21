import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, BookOpen, Briefcase, Building2, CalendarDays, Compass, GraduationCap, Mic, Sprout, UserSearch, Users } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Explore" };

export default async function ExplorePage() {
  const session = await requireUser();
  const cards = [
    { href: "/early-careers", title: "Early careers", text: "Attachments, internships, graduate programmes and jobs with no experience needed.", icon: Briefcase },
    { href: "/companies", title: "Companies", text: "Browse verified employers, follow them and read reviews.", icon: Building2 },
    { href: "/careers", title: "Career explorer", text: "See the qualifications, skills and steps for each career.", icon: Compass },
    { href: "/skills", title: "Skills development", text: "Short lessons with exercises and quizzes.", icon: Sprout },
    { href: "/interview-prep", title: "Interview preparation", text: "Common questions, model answers and practice mode.", icon: Mic },
    { href: "/events", title: "Events", text: "Webinars, meet-ups and career fairs.", icon: CalendarDays },
    { href: "/groups", title: "Groups", text: "Join conversations about your school, skills or industry.", icon: Users },
    { href: "/learn", title: "Learn", text: "Career guides and skill quizzes that earn profile badges.", icon: BookOpen },
    { href: "/mentors", title: "Mentors", text: "Ask experienced people for advice.", icon: GraduationCap },
    ...(session.role === "candidate" ? [{ href: "/candidate/alerts", title: "Job alerts", text: "Be told the moment a matching opportunity opens.", icon: BellRing }] : []),
    ...(session.role === "employer" ? [{ href: "/employer/talent", title: "Find talent", text: "Search candidates, shortlist and invite them to apply.", icon: UserSearch }] : []),
  ];
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Explore" description="More ways to learn, connect and get hired." />
        <ul className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="flex h-full gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm hover:bg-surface-muted">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-info-soft text-info-soft-foreground">
                  <c.icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-heading font-semibold">{c.title}</span>
                  <span className="block text-sm text-muted-foreground">{c.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AdaptiveLayout>
  );
}
