import type { Metadata } from "next";
import Link from "next/link";
import { Award, BookOpen, CheckCircle2 } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/misc";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Learn", description: "Career guides, interview preparation and skill quizzes for students and graduates." };

const KIND_LABEL: Record<string, string> = {
  career_guidance: "Career guidance",
  cv_and_applications: "CVs and applications",
  interview_prep: "Interview preparation",
  workplace_skills: "Workplace skills",
  digital_skills: "Digital skills",
};

interface Resource {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  audience: string;
}
interface Quiz {
  id: string;
  skill: string;
  title: string;
  description: string | null;
  question_count: number | string;
  pass_mark: number;
  best_score: number | null;
  earned: boolean;
}

export default async function LearnPage() {
  const session = await getSession();
  const supabase = await createClient();
  const [{ data: res }, { data: qz }] = await Promise.all([
    supabase.from("resources").select("id, kind, title, summary, audience").eq("published", true).order("position").order("title"),
    session?.role === "candidate" ? supabase.rpc("list_quizzes") : Promise.resolve({ data: [] }),
  ]);
  const resources = (res ?? []) as Resource[];
  const quizzes = (qz ?? []) as Quiz[];
  const groups = Object.keys(KIND_LABEL).map((k) => ({ kind: k, items: resources.filter((r) => r.kind === k) })).filter((g) => g.items.length);

  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader title="Learn" description="Guides and short quizzes to help you get hired." />

        {session?.role === "candidate" ? (
          <section aria-labelledby="quiz-h" className="space-y-3">
            <h2 id="quiz-h" className="flex items-center gap-2 font-heading text-lg font-semibold">
              <Award className="size-5 text-cta" aria-hidden /> Skill quizzes and badges
            </h2>
            <p className="text-sm text-muted-foreground">Pass a quiz to earn a badge that shows on your profile. You can take each quiz 3 times a day.</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {quizzes.map((z) => (
                <li key={z.id}>
                  <Link href={`/learn/quiz/${z.id}`} className="block h-full rounded-xl border border-border bg-surface p-4 shadow-sm hover:bg-surface-muted">
                    <p className="flex items-center justify-between gap-2 font-semibold">
                      {z.title}
                      {z.earned ? <CheckCircle2 className="size-5 text-success" aria-label="Badge earned" /> : null}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{z.description}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="neutral">{Number(z.question_count)} questions</Badge>
                      <Badge variant="neutral">Pass: {z.pass_mark}%</Badge>
                      {z.best_score != null ? <Badge variant={z.earned ? "success" : "warning"}>Best: {z.best_score}%</Badge> : null}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {groups.map((g) => (
          <section key={g.kind} aria-label={KIND_LABEL[g.kind]} className="space-y-3">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <BookOpen className="size-5 text-link" aria-hidden /> {KIND_LABEL[g.kind]}
            </h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {g.items.map((r) => (
                <li key={r.id}>
                  <Link href={`/learn/${r.id}`} className="block p-4 hover:bg-surface-muted">
                    <p className="font-semibold">{r.title}</p>
                    {r.summary ? <p className="text-sm text-muted-foreground">{r.summary}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AdaptiveLayout>
  );
}
