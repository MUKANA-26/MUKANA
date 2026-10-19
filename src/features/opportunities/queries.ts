import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isOpportunityType, type OpportunityType } from "@/lib/opportunity-types";
import type { OpportunityWithCompany } from "@/types/db";

export const PAGE_SIZE = 20;

export const OPP_SELECT =
  "*, companies(id, name, logo_path, verification_status, industry, location)";

export interface OpportunityFilters {
  q?: string;
  type?: string;
  field?: string;
  province?: string;
  pay?: string;
  startFrom?: string;
  startTo?: string;
  deadlineBefore?: string;
  page?: number;
  /** Restrict to the types a candidate can apply for (a candidate only sees their own kinds by default). */
  candidateTypes?: OpportunityType[];
}

/** PostgREST `or`/`ilike` values must not contain filter metacharacters. */
const clean = (s: string) => s.replace(/[%,()*\\]/g, " ").trim().slice(0, 80);

export async function listOpportunities(filters: OpportunityFilters) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const today = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10); // Africa/Harare (UTC+2)

  let query = supabase
    .from("opportunities")
    .select(OPP_SELECT, { count: "exact" })
    .eq("status", "published")
    .gte("deadline", today)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (isOpportunityType(filters.type) && (!filters.candidateTypes || filters.candidateTypes.includes(filters.type))) query = query.eq("type", filters.type);
  else if (filters.candidateTypes) query = query.in("type", filters.candidateTypes);
  if (filters.q) {
    const q = clean(filters.q);
    if (q) query = query.ilike("search_text", `%${q.toLowerCase()}%`);
  }
  if (filters.field) {
    const f = clean(filters.field);
    if (f) query = query.ilike("search_text", `%${f.toLowerCase()}%`);
  }
  if (filters.province) query = query.eq("province", filters.province);
  if (filters.pay === "paid" || filters.pay === "unpaid") query = query.eq("stipend_type", filters.pay);
  if (filters.startFrom) query = query.gte("start_date", filters.startFrom);
  if (filters.startTo) query = query.lte("start_date", filters.startTo);
  if (filters.deadlineBefore) query = query.lte("deadline", filters.deadlineBefore);

  const { data, count } = await query;
  return { items: (data ?? []) as unknown as OpportunityWithCompany[], total: count ?? 0, page };
}

export const getOpportunity = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("opportunities").select(OPP_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as OpportunityWithCompany | null) ?? null;
});

export async function getCompanyOpportunities(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("*, applications(count)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as (OpportunityWithCompany & { applications: { count: number }[] })[];
}
