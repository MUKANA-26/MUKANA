import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEMPLATES, type MessageTemplate, type TemplateKind } from "@/features/applications/templates";
import type {
  ApplicationEventRow,
  ApplicationStatus,
  CandidateProfileRow,
  InterviewRow,
  MatchResult,
  OpportunityType,
} from "@/types/db";

export interface ApplicantRecord {
  id: string;
  status: ApplicationStatus;
  match_score: number | null;
  match_breakdown: MatchResult | null;
  cover_note: string | null;
  submitted_at: string;
  status_changed_at: string;
  opportunity: { id: string; title: string; type: OpportunityType } | null;
  candidate: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_path: string | null;
    profile: CandidateProfileRow | null;
  };
}

const APPLICANT_SELECT = `
  id, status, match_score, match_breakdown, cover_note, submitted_at, status_changed_at,
  opportunities(id, title, type),
  profiles!applications_candidate_id_fkey(id, full_name, email, phone, avatar_path, candidate_profiles(*))
`;

interface RawApplicant {
  id: string;
  status: ApplicationStatus;
  match_score: number | null;
  match_breakdown: MatchResult | null;
  cover_note: string | null;
  submitted_at: string;
  status_changed_at: string;
  opportunities: ApplicantRecord["opportunity"];
  profiles: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_path: string | null;
    candidate_profiles: CandidateProfileRow | CandidateProfileRow[] | null;
  } | null;
}

function shape(r: RawApplicant): ApplicantRecord {
  const p = r.profiles;
  const cp = Array.isArray(p?.candidate_profiles) ? p?.candidate_profiles[0] : p?.candidate_profiles;
  return {
    id: r.id,
    status: r.status,
    match_score: r.match_score,
    match_breakdown: r.match_breakdown,
    cover_note: r.cover_note,
    submitted_at: r.submitted_at,
    status_changed_at: r.status_changed_at,
    opportunity: r.opportunities,
    candidate: {
      id: p?.id ?? "",
      full_name: p?.full_name ?? "Candidate",
      email: p?.email ?? "",
      phone: p?.phone ?? null,
      avatar_path: p?.avatar_path ?? null,
      profile: cp ?? null,
    },
  };
}

/** All applicants for the signed-in employer's opportunities (RLS limits the rows; capped at 500). */
export async function getApplicants(): Promise<ApplicantRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(APPLICANT_SELECT)
    .order("submitted_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as unknown as RawApplicant[]).map(shape);
}

export async function getApplicant(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const [{ data: app }, { data: events }, { data: interviews }] = await Promise.all([
    supabase.from("applications").select(APPLICANT_SELECT).eq("id", id).maybeSingle(),
    supabase.from("application_events").select("*").eq("application_id", id).order("created_at"),
    supabase.from("interviews").select("*").eq("application_id", id).order("scheduled_at", { ascending: false }),
  ]);
  if (!app) return null;
  return {
    applicant: shape(app as unknown as RawApplicant),
    events: (events ?? []) as ApplicationEventRow[],
    interviews: (interviews ?? []) as InterviewRow[],
  };
}

export async function getTemplates(companyId: string): Promise<Record<TemplateKind, MessageTemplate>> {
  const supabase = await createClient();
  const { data } = await supabase.from("message_templates").select("kind, subject, body").eq("company_id", companyId);
  const merged = { ...DEFAULT_TEMPLATES };
  for (const row of (data ?? []) as MessageTemplate[]) merged[row.kind] = row;
  return merged;
}

export interface UpcomingInterview extends InterviewRow {
  applications: {
    id: string;
    opportunities: { title: string } | null;
    profiles: { full_name: string } | null;
  } | null;
}

export async function getInterviews(scope: "upcoming" | "past", limit = 50): Promise<UpcomingInterview[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  let q = supabase
    .from("interviews")
    .select("*, applications(id, opportunities(title), profiles!applications_candidate_id_fkey(full_name))")
    .limit(limit);
  q = scope === "upcoming" ? q.gte("scheduled_at", now).in("status", ["scheduled", "confirmed"]).order("scheduled_at") : q.lt("scheduled_at", now).order("scheduled_at", { ascending: false });
  const { data } = await q;
  return (data ?? []) as unknown as UpcomingInterview[];
}

export interface AnalyticsRow {
  opportunity_id: string;
  title: string;
  status: "draft" | "published" | "closed";
  applications: number;
  by_status: Record<string, number>;
  avg_match: number | null;
  time_to_fill_days: number | null;
}

export async function getAnalytics(): Promise<AnalyticsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("opportunity_analytics");
  return ((data ?? []) as AnalyticsRow[]).map((r) => ({
    ...r,
    applications: Number(r.applications),
    avg_match: r.avg_match != null ? Number(r.avg_match) : null,
    time_to_fill_days: r.time_to_fill_days != null ? Number(r.time_to_fill_days) : null,
  }));
}
