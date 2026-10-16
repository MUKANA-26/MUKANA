import type { ApplicationStatus } from "@/types/db";

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  shortlisted: "Shortlisted",
  interview_invited: "Interview invited",
  offer_made: "Offer made",
  accepted: "Accepted",
  unsuccessful: "Unsuccessful",
  withdrawn: "Withdrawn",
};

export const STATUS_VARIANT: Record<ApplicationStatus, "neutral" | "info" | "success" | "warning" | "danger" | "cta"> = {
  submitted: "neutral",
  under_review: "info",
  shortlisted: "info",
  interview_invited: "warning",
  offer_made: "cta",
  accepted: "success",
  unsuccessful: "danger",
  withdrawn: "neutral",
};

/** The happy-path steps shown in the timeline stepper. */
export const TIMELINE_STEPS: ApplicationStatus[] = ["submitted", "under_review", "shortlisted", "interview_invited", "offer_made", "accepted"];

export const OPEN_STATUSES: ApplicationStatus[] = ["submitted", "under_review", "shortlisted", "interview_invited", "offer_made"];

export const canWithdraw = (s: ApplicationStatus) => OPEN_STATUSES.includes(s);

/** Statuses an employer may move an application to from the given status. Mirrors employer_transition_allowed() in SQL. */
export const EMPLOYER_NEXT: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted: ["under_review", "shortlisted", "unsuccessful"],
  under_review: ["shortlisted", "unsuccessful"],
  shortlisted: ["under_review", "offer_made", "unsuccessful"],
  interview_invited: ["shortlisted", "offer_made", "unsuccessful"],
  offer_made: ["unsuccessful"],
  accepted: [],
  unsuccessful: [],
  withdrawn: [],
};
