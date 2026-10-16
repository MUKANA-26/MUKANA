// Row shapes for the Supabase tables the app reads. Kept in sync with supabase/migrations.

export type CandidateType = "attachee" | "graduate_trainee";
export type QualificationLevel = "certificate" | "diploma" | "bachelors" | "honours" | "masters" | "phd";
export type DegreeClass = "first" | "upper_second" | "lower_second" | "third" | "pass";
export type OpportunityType = "industrial_attachment" | "graduate_trainee";
export type OpportunityStatus = "draft" | "published" | "closed";
export type WorkMode = "on_site" | "hybrid";
export type StipendType = "paid" | "unpaid";
export type CurrencyCode = "USD" | "ZiG";
export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";
export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "shortlisted"
  | "interview_invited"
  | "offer_made"
  | "accepted"
  | "unsuccessful"
  | "withdrawn";
export type InterviewMode = "physical" | "virtual";
export type InterviewStatus = "scheduled" | "confirmed" | "declined" | "completed" | "cancelled";
export type NotificationType =
  | "application_received"
  | "application_status"
  | "interview_invite"
  | "interview_update"
  | "interview_reminder"
  | "offer"
  | "offer_response"
  | "deadline_reminder"
  | "verification"
  | "feed"
  | "report"
  | "system";

export interface CertificationItem {
  name: string;
  issuer?: string;
  year?: number | null;
}
export interface ProjectItem {
  title: string;
  description?: string;
  url?: string;
}
export interface VolunteerItem {
  role: string;
  organisation?: string;
  description?: string;
}

export interface CandidateProfileRow {
  user_id: string;
  candidate_type: CandidateType;
  city: string | null;
  province: string | null;
  bio: string | null;
  skills: string[];
  certifications: CertificationItem[];
  projects: ProjectItem[];
  coursework: string[];
  volunteer: VolunteerItem[];
  cv_path: string | null;
  cv_updated_at: string | null;
  institution: string | null;
  programme: string | null;
  current_level: number | null;
  registration_number: string | null;
  attachment_start: string | null;
  attachment_end: string | null;
  placement_letter_path: string | null;
  qualification: string | null;
  qualification_level: QualificationLevel | null;
  degree_class: DegreeClass | null;
  graduation_year: number | null;
  availability_date: string | null;
}

export interface Completeness {
  percent: number;
  missing: string[];
  complete: boolean;
}

export interface CompanyRow {
  id: string;
  owner_id: string;
  name: string;
  logo_path: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  description: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
  suspended: boolean;
}

export interface CompanyPrivateRow {
  company_id: string;
  registration_number: string | null;
  registration_details: string | null;
  rep_name: string | null;
  rep_title: string | null;
  rep_phone: string | null;
  rep_email: string | null;
}

export interface VerificationRequestRow {
  id: string;
  company_id: string;
  status: "pending" | "approved" | "rejected";
  document_paths: string[];
  note: string | null;
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface OpportunityRow {
  id: string;
  company_id: string;
  type: OpportunityType;
  title: string;
  department: string | null;
  description: string;
  requirements: string | null;
  skills: string[];
  eligible_fields: string[];
  min_level: number | null;
  min_qualification: QualificationLevel | null;
  slots: number;
  location: string;
  province: string | null;
  mode: WorkMode;
  start_date: string | null;
  duration_months: number | null;
  stipend_type: StipendType;
  stipend_amount: number | null;
  stipend_currency: CurrencyCode | null;
  deadline: string;
  status: OpportunityStatus;
  published_at: string | null;
  closed_at: string | null;
  suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpportunityWithCompany extends OpportunityRow {
  companies: Pick<CompanyRow, "id" | "name" | "logo_path" | "verification_status" | "industry" | "location"> | null;
}

export interface MatchBreakdownPart {
  score: number;
  max: number;
  reason: string;
}
export interface MatchResult {
  score: number;
  reason: string;
  breakdown: {
    field: MatchBreakdownPart;
    skills: MatchBreakdownPart;
    level: MatchBreakdownPart;
    availability: MatchBreakdownPart;
    location: MatchBreakdownPart;
  };
}

export interface ApplicationRow {
  id: string;
  opportunity_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  cover_note: string | null;
  match_score: number | null;
  match_breakdown: MatchResult | null;
  submitted_at: string;
  status_changed_at: string;
  updated_at: string;
}

export interface ApplicationEventRow {
  id: string;
  application_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  note: string | null;
  created_at: string;
}

export interface InterviewRow {
  id: string;
  application_id: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: InterviewMode;
  location: string;
  instructions: string | null;
  status: InterviewStatus;
  candidate_response_at: string | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
}
