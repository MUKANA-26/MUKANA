import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { OpportunityCard } from "@/features/opportunities/opportunity-card";
import { getRecommendations } from "@/features/matching/queries";
import { getCompleteness } from "@/features/profile/queries";
import { CompletenessCard } from "@/features/profile/completeness-card";

export const metadata: Metadata = { title: "Recommended for you" };

export default async function RecommendedPage() {
  const session = await requireRole("candidate");
  const [recs, completeness] = await Promise.all([getRecommendations(30), getCompleteness(session.id)]);
  return (
    <>
      <PageHeader title="Recommended for you" description="Ranked by how well your profile fits. Every score is explained, and nothing is hidden from you." />
      {!completeness.complete ? (
        <div className="mb-5">
          <CompletenessCard completeness={completeness} />
        </div>
      ) : null}
      {recs.length === 0 ? (
        <EmptyState
          icon={<Sparkles aria-hidden />}
          title="No recommendations yet"
          description="Add your skills, programme and availability to your profile, and we'll rank open opportunities for you."
          action={
            <Button asChild variant="cta">
              <Link href="/candidate/profile">Update profile</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {recs.map((r) => (
            <li key={r.opportunity.id} className="relative">
              <OpportunityCard
                opportunity={r.opportunity}
                href={`/candidate/opportunities/${r.opportunity.id}`}
                matchScore={r.score}
                footer={<p className="text-xs text-muted-foreground">{r.reason}</p>}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
