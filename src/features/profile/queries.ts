import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CandidateProfileRow, Completeness, CompanyPrivateRow, CompanyRow, VerificationRequestRow } from "@/types/db";

export async function getCandidateProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle();
  return data as CandidateProfileRow | null;
}

export async function getCompleteness(userId: string): Promise<Completeness> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("profile_completeness", { p_user: userId });
  return (data as Completeness | null) ?? { percent: 0, missing: [], complete: false };
}

export async function getMyCompany(userId: string) {
  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("*").eq("owner_id", userId).maybeSingle();
  if (!company) return null;
  const [{ data: priv }, { data: requests }] = await Promise.all([
    supabase.from("company_private").select("*").eq("company_id", company.id).maybeSingle(),
    supabase
      .from("verification_requests")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  return {
    company: company as CompanyRow,
    priv: (priv as CompanyPrivateRow | null) ?? null,
    requests: (requests as VerificationRequestRow[] | null) ?? [],
  };
}
