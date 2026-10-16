import "@/lib/zod-setup";
import { z } from "zod";

const t = (max: number) => z.string().trim().max(max);

export const cvSchema = z.object({
  template: z.enum(["classic", "modern"]),
  fullName: t(120).min(2, "Enter your name"),
  headline: t(120),
  email: t(254),
  phone: t(40),
  location: t(120),
  summary: t(1200),
  education: z
    .array(z.object({ institution: t(160).min(1, "Institution is required"), qualification: t(200), period: t(60), details: t(600) }))
    .max(6),
  skills: z.array(t(60).min(1)).max(40),
  coursework: z.array(t(80).min(1)).max(30),
  projects: z.array(z.object({ title: t(160).min(1, "Project title is required"), description: t(700), url: t(300) })).max(8),
  volunteer: z.array(z.object({ role: t(160).min(1, "Role is required"), organisation: t(160), description: t(600) })).max(6),
  certifications: z.array(z.object({ name: t(160).min(1, "Certification name is required"), issuer: t(160), year: t(4) })).max(10),
  languages: z.array(t(60).min(1)).max(10),
});

export type CvData = z.infer<typeof cvSchema>;

export const EMPTY_CV: CvData = {
  template: "classic",
  fullName: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  summary: "",
  education: [],
  skills: [],
  coursework: [],
  projects: [],
  volunteer: [],
  certifications: [],
  languages: [],
};
