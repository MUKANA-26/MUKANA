import "server-only";
import { createClient } from "@/lib/supabase/server";
import { OPP_SELECT } from "@/features/opportunities/queries";
import type { OpportunityWithCompany } from "@/types/db";

export interface Recommendation {
  opportunity: OpportunityWithCompany;
  score: number;
  reason: string;
}

/** Best open opportunities for the signed-in candidate, scored in Postgres (rule-based, explainable). */
export async function getRecommendations(limit = 20): Promise<Recommendation[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("recommended_opportunities", { p_limit: limit });
  if (error || !rows?.length) return [];
  const list = rows as { opportunity_id: string; score: number; reason: string }[];
  const { data: opps } = await supabase
    .from("opportunities")
    .select(OPP_SELECT)
    .in(
      "id",
      list.map((r) => r.opportunity_id),
    );
  const byId = new Map(((opps ?? []) as unknown as OpportunityWithCompany[]).map((o) => [o.id, o]));
  return list
    .map((r) => ({ opportunity: byId.get(r.opportunity_id)!, score: r.score, reason: r.reason }))
    .filter((r) => r.opportunity);
}
