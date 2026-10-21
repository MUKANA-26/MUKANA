import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ResourceBody } from "@/features/learning/resource-body";
import { LessonPlayer, type QuizItem } from "@/features/skills/lesson-player";

interface Lesson {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  level: string;
  minutes: number;
  skills: string[];
  body: string;
  exercise: string | null;
  quiz: QuizItem[];
}

async function load(slug: string) {
  const supabase = await createClient();
  const [{ data: lesson }, { data: all }] = await Promise.all([
    supabase.from("lessons").select("id, slug, title, summary, level, minutes, skills, body, exercise, quiz").eq("slug", slug).eq("published", true).maybeSingle(),
    supabase.from("lessons").select("slug, title").eq("published", true).order("position"),
  ]);
  return { lesson: lesson as Lesson | null, all: (all ?? []) as { slug: string; title: string }[], supabase };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { lesson } = await load((await params).slug);
  return lesson ? { title: lesson.title, description: lesson.summary ?? undefined } : { title: "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { lesson, all, supabase } = await load(slug);
  if (!lesson) notFound();
  const session = await getSession();
  const idx = all.findIndex((l) => l.slug === slug);
  const next = all[idx + 1] ?? null;
  // Careers that use these skills.
  const { data: careers } = await supabase.from("careers").select("slug, title, skills").eq("published", true).overlaps("skills", lesson.skills).limit(4);

  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl space-y-5">
        <Link href="/skills" className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Skills development
        </Link>
        <article className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={lesson.level === "beginner" ? "success" : "info"}>{lesson.level === "beginner" ? "Beginner" : "Intermediate"}</Badge>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> {lesson.minutes} min
            </span>
          </div>
          <h1 className="mt-2 font-heading text-2xl font-semibold">{lesson.title}</h1>
          {lesson.summary ? <p className="mt-1 text-muted-foreground">{lesson.summary}</p> : null}
          <ResourceBody body={lesson.body} />
        </article>

        <LessonPlayer lessonId={lesson.id} userId={session?.id ?? null} exercise={lesson.exercise} quiz={lesson.quiz} nextSlug={next?.slug ?? null} />

        {careers && careers.length > 0 ? (
          <section className="rounded-xl border border-border bg-surface p-4" aria-labelledby="rel-c">
            <h2 id="rel-c" className="font-heading font-semibold">
              Careers that use these skills
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {careers.map((c) => (
                <li key={c.slug}>
                  <Link href={`/careers/${c.slug}`} className="inline-block rounded-full border border-border px-3 py-1 text-sm font-medium hover:bg-surface-muted">
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AdaptiveLayout>
  );
}
