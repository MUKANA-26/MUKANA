export type OpportunityType = "industrial_attachment" | "internship" | "graduate_trainee" | "entry_level";
export type CandidateType = "attachee" | "graduate_trainee";

export const OPPORTUNITY_TYPES: { value: OpportunityType; label: string; formLabel: string }[] = [
  { value: "industrial_attachment", label: "Industrial attachment", formLabel: "Industrial attachment" },
  { value: "internship", label: "Internship", formLabel: "Internship" },
  { value: "graduate_trainee", label: "Graduate trainee", formLabel: "Graduate trainee programme" },
  { value: "entry_level", label: "Entry-level job", formLabel: "Entry-level job" },
];

export const TYPE_LABEL: Record<OpportunityType, string> = Object.fromEntries(OPPORTUNITY_TYPES.map((t) => [t.value, t.label])) as Record<OpportunityType, string>;

/** Attachees fit attachments and internships; graduate trainees fit graduate programmes, entry-level jobs and internships. */
export function typesForCandidate(c: CandidateType): OpportunityType[] {
  return c === "attachee" ? ["industrial_attachment", "internship"] : ["graduate_trainee", "entry_level", "internship"];
}

export function fitsCandidate(type: OpportunityType, c: CandidateType): boolean {
  return typesForCandidate(c).includes(type);
}

/** Student-style placements ask for a current level (e.g. 2.2); graduate-style roles ask for a qualification. */
export const showsMinLevel = (type: OpportunityType) => type === "industrial_attachment" || type === "internship";
export const showsMinQualification = (type: OpportunityType) => type !== "industrial_attachment";

export const isOpportunityType = (v: unknown): v is OpportunityType => OPPORTUNITY_TYPES.some((t) => t.value === v);

export function typeSentence(type: OpportunityType): string {
  switch (type) {
    case "industrial_attachment":
      return "an attachment opportunity";
    case "internship":
      return "an internship";
    case "entry_level":
      return "an entry-level job";
    default:
      return "a graduate trainee programme";
  }
}
