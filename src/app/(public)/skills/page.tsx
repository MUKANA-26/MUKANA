import type { Metadata } from "next";
import Link from "next/link";
import { Award, Mic } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SkillsHub, type LessonCard, type LessonCategory } from "@/features/skills/skills-hub";

export const metadata: Metadata = {
  title: "Skills development",
  description: "Short lessons to build career skills: CVs, communication, Excel, digital safety, finance and more.",
};

export default async function SkillsPage() {
  const session = await getSession();
  const supabase = await createClient();
  const [{ data: cats }, { data: lessons }] = await Promise.all([
    supabase.from("content_categories").select("slug, label, description").eq("kind", "lesson").order("position"),
    supabase.from("lessons").select("id, slug, category, title, summary, level, minutes, skills").eq("published", true).order("position"),
  ]);
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Skills development"
          description="Short lessons with exercises and quizzes. Learn something useful in under 15 minutes."
          actions={
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/interview-prep">
                  <Mic aria-hidden /> Interview prep
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/learn">
                  <Award aria-hidden /> Quizzes and badges
                </Link>
              </Button>
            </div>
          }
        />
        <SkillsHub lessons={(lessons ?? []) as LessonCard[]} categories={(cats ?? []) as LessonCategory[]} userId={session?.id ?? null} />
      </div>
    </AdaptiveLayout>
  );
}
