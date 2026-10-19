import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QuizRunner, type QuizData } from "@/features/learning/quiz-runner";

export const metadata: Metadata = { title: "Skill quiz" };

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const supabase = await createClient();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await supabase.rpc("get_quiz", { p_id: id }) : { data: null };
  const quiz = (data ?? null) as QuizData | null;
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-xl space-y-4">
        <Link href="/learn" className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Learn
        </Link>
        {!quiz ? (
          <EmptyState title="Quiz not found" action={<Button asChild variant="outline"><Link href="/learn">Back to Learn</Link></Button>} />
        ) : session.role !== "candidate" ? (
          <EmptyState title="Quizzes are for candidates" description="Switch to a candidate account to earn skill badges." />
        ) : (
          <>
            <h1 className="font-heading text-2xl font-semibold">{quiz.title}</h1>
            <QuizRunner quiz={quiz} userId={session.id} />
          </>
        )}
      </div>
    </AdaptiveLayout>
  );
}
