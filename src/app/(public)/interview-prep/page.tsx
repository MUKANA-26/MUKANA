import type { Metadata } from "next";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { PageHeader } from "@/components/ui/misc";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InterviewCentre, type Category, type Question } from "@/features/interview/interview-centre";

export const metadata: Metadata = {
  title: "Interview preparation",
  description: "Common interview questions with model answers for attachees, graduate trainees and entry-level job seekers in Zimbabwe.",
};

export default async function InterviewPrepPage() {
  const session = await getSession();
  const supabase = await createClient();
  const [{ data: cats }, { data: qs }, cand] = await Promise.all([
    supabase.from("content_categories").select("slug, label, description").eq("kind", "interview").order("position"),
    supabase.from("interview_questions").select("id, category, question, answer, tip, audience").eq("published", true).order("position"),
    session?.role === "candidate" ? supabase.from("candidate_profiles").select("candidate_type").eq("user_id", session.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const audience = cand.data?.candidate_type === "graduate_trainee" ? "graduate_trainee" : cand.data?.candidate_type === "attachee" ? "attachee" : null;
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Interview preparation" description="Common questions with model answers, tips and a practice mode." />
        <InterviewCentre categories={(cats ?? []) as Category[]} questions={(qs ?? []) as Question[]} userId={session?.id ?? null} audience={audience} />
      </div>
    </AdaptiveLayout>
  );
}
