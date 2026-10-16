import type { QualificationLevel, DegreeClass } from "@/types/db";

export const PROVINCES = [
  "Bulawayo",
  "Harare",
  "Manicaland",
  "Mashonaland Central",
  "Mashonaland East",
  "Mashonaland West",
  "Masvingo",
  "Matabeleland North",
  "Matabeleland South",
  "Midlands",
] as const;

export const INSTITUTIONS = [
  "University of Zimbabwe",
  "National University of Science and Technology (NUST)",
  "Midlands State University",
  "Harare Institute of Technology",
  "Chinhoyi University of Technology",
  "Bindura University of Science Education",
  "Great Zimbabwe University",
  "Lupane State University",
  "Africa University",
  "Zimbabwe Open University",
  "Women's University in Africa",
  "Solusi University",
  "Catholic University in Zimbabwe",
  "Gwanda State University",
  "Manicaland State University of Applied Sciences",
  "Harare Polytechnic",
  "Bulawayo Polytechnic",
  "Kwekwe Polytechnic",
  "Mutare Polytechnic",
  "Masvingo Polytechnic",
] as const;

export const INDUSTRIES = [
  "Agriculture",
  "Banking & Finance",
  "Construction & Engineering",
  "Education",
  "Energy & Utilities",
  "Healthcare",
  "Hospitality & Tourism",
  "Information Technology",
  "Manufacturing",
  "Media & Communications",
  "Mining",
  "NGO & Development",
  "Retail & Wholesale",
  "Telecommunications",
  "Transport & Logistics",
  "Other",
] as const;

export const FIELDS_OF_STUDY = [
  "Accounting",
  "Agriculture",
  "Architecture",
  "Business Administration",
  "Chemical Engineering",
  "Civil Engineering",
  "Computer Science",
  "Economics",
  "Education",
  "Electrical Engineering",
  "Environmental Science",
  "Finance",
  "Human Resource Management",
  "Information Systems",
  "Law",
  "Marketing",
  "Mechanical Engineering",
  "Mining Engineering",
  "Nursing",
  "Software Engineering",
  "Statistics",
  "Supply Chain Management",
] as const;

export const QUALIFICATION_LEVELS: { value: QualificationLevel; label: string }[] = [
  { value: "certificate", label: "Certificate" },
  { value: "diploma", label: "Diploma" },
  { value: "bachelors", label: "Bachelor's degree" },
  { value: "honours", label: "Honours degree" },
  { value: "masters", label: "Master's degree" },
  { value: "phd", label: "PhD" },
];

export const DEGREE_CLASSES: { value: DegreeClass; label: string }[] = [
  { value: "first", label: "First class" },
  { value: "upper_second", label: "Upper second (2.1)" },
  { value: "lower_second", label: "Lower second (2.2)" },
  { value: "third", label: "Third class" },
  { value: "pass", label: "Pass" },
];

export const LEVELS = ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2"] as const;

export const labelOf = <T extends string>(list: { value: T; label: string }[], value: T | null | undefined) =>
  list.find((i) => i.value === value)?.label ?? "—";
