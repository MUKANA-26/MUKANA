export type TemplateKind = "shortlist" | "interview" | "offer" | "rejection";

export interface MessageTemplate {
  kind: TemplateKind;
  subject: string;
  body: string;
}

export const TEMPLATE_LABEL: Record<TemplateKind, string> = {
  shortlist: "Shortlisting",
  interview: "Interview invitation",
  offer: "Offer",
  rejection: "Rejection",
};

export const PLACEHOLDERS = [
  { token: "{{first_name}}", label: "Candidate's first name" },
  { token: "{{candidate_name}}", label: "Candidate's full name" },
  { token: "{{role}}", label: "Opportunity title" },
  { token: "{{company}}", label: "Your company name" },
] as const;

export const DEFAULT_TEMPLATES: Record<TemplateKind, MessageTemplate> = {
  shortlist: {
    kind: "shortlist",
    subject: "You have been shortlisted",
    body: "Hi {{first_name}},\n\nThank you for applying for the {{role}} opportunity at {{company}}. We are pleased to let you know that you have been shortlisted.\n\nWe will be in touch soon with the next steps.\n\nKind regards,\n{{company}}",
  },
  interview: {
    kind: "interview",
    subject: "Interview invitation",
    body: "Hi {{first_name}},\n\nWe would like to invite you to an interview for the {{role}} opportunity at {{company}}. The date, time and place are shown below.\n\nPlease confirm your attendance in Mukana as soon as you can. If the time does not work, let us know by declining so we can find another.\n\nKind regards,\n{{company}}",
  },
  offer: {
    kind: "offer",
    subject: "Offer: congratulations",
    body: "Congratulations {{first_name}}!\n\nWe are delighted to offer you the {{role}} position at {{company}}.\n\nPlease accept or decline the offer in Mukana. We look forward to welcoming you.\n\nKind regards,\n{{company}}",
  },
  rejection: {
    kind: "rejection",
    subject: "Update on your application",
    body: "Hi {{first_name}},\n\nThank you for your interest in the {{role}} opportunity at {{company}} and for the time you put into your application.\n\nAfter careful consideration we will not be taking your application further this time. We encourage you to apply for future opportunities.\n\nKind regards,\n{{company}}",
  },
};

/** Which template suits each status change. */
export const TEMPLATE_FOR_STATUS: Partial<Record<string, TemplateKind>> = {
  shortlisted: "shortlist",
  offer_made: "offer",
  unsuccessful: "rejection",
  interview_invited: "interview",
};

export interface TemplateContext {
  candidateName: string;
  role: string;
  company: string;
}

export function renderTemplate(text: string, ctx: TemplateContext) {
  const first = ctx.candidateName.trim().split(/\s+/)[0] || "there";
  return text
    .replaceAll("{{first_name}}", first)
    .replaceAll("{{candidate_name}}", ctx.candidateName.trim() || "there")
    .replaceAll("{{role}}", ctx.role)
    .replaceAll("{{company}}", ctx.company);
}
