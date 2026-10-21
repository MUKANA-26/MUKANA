import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Category, Question } from "@/features/interview/interview-centre";
import { PracticeSession } from "@/features/interview/practice-session";

export const metadata: Metadata = { title: "Interview practice" };

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const session = await getSession();
  const supabase = await createClient();
  const [{ data: cats }, { data: qs }] = await Promise.all([
    supabase.from("content_categories").select("slug, label, description").eq("kind", "interview").order("position"),
    supabase.from("interview_questions").select("id, category, question, answer, tip, audience").eq("published", true),
  ]);
  const categories = (cats ?? []) as Category[];
  const initial = categories.some((c) => c.slug === cat) ? (cat as string) : "all";
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/interview-prep" className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Interview preparation
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Practice mode</h1>
        <PracticeSession categories={categories} questions={(qs ?? []) as Question[]} userId={session?.id ?? null} initialCategory={initial} />
      </div>
    </AdaptiveLayout>
  );
}
