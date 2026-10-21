import "@/lib/zod-setup";
import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
  .optional()
  .or(z.literal(""));

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number, e.g. +263 77 123 4567")
  .optional()
  .or(z.literal(""));

export const candidateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(120),
    phone: phoneSchema,
    city: optionalText(80),
    province: optionalText(80),
    bio: optionalText(1000),
    candidateType: z.enum(["attachee", "graduate_trainee"]),
    institution: optionalText(160),
    // attachee
    programme: optionalText(160),
    currentLevel: z
      .string()
      .regex(/^[1-6]\.[1-2]$/, "Use the format 2.2")
      .optional()
      .or(z.literal("")),
    registrationNumber: optionalText(40),
    attachmentStart: optionalDate,
    attachmentEnd: optionalDate,
    // graduate trainee
    qualification: optionalText(160),
    qualificationLevel: z.enum(["certificate", "diploma", "bachelors", "honours", "masters", "phd"]).optional().or(z.literal("")),
    degreeClass: z.enum(["first", "upper_second", "lower_second", "third", "pass"]).optional().or(z.literal("")),
    graduationYear: z
      .string()
      .regex(/^(19|20)\d{2}$/, "Enter a 4-digit year")
      .optional()
      .or(z.literal("")),
    availabilityDate: optionalDate,
    skills: z.array(z.string().trim().min(1).max(60)).max(40, "Add up to 40 skills"),
    certifications: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Name is required").max(160),
          issuer: optionalText(160),
          year: z.string().regex(/^(19|20)\d{2}$/, "Enter a 4-digit year").optional().or(z.literal("")),
        }),
      )
      .max(15),
    projects: z
      .array(
        z.object({
          title: z.string().trim().min(1, "Title is required").max(160),
          description: optionalText(600),
          url: z.string().trim().url("Enter a valid link starting with https://").max(300).optional().or(z.literal("")),
        }),
      )
      .max(10),
  })
  .refine((v) => !v.attachmentStart || !v.attachmentEnd || v.attachmentEnd >= v.attachmentStart, {
    path: ["attachmentEnd"],
    message: "End date must be after the start date",
  });

export type CandidateProfileValues = z.infer<typeof candidateProfileSchema>;

export const companyProfileSchema = z.object({
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  sizeBand: z.enum(["", "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]).optional(),
  foundedYear: z.string().trim().regex(/^(\d{4})?$/, "Use a four-digit year").optional(),
  locations: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  benefits: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  culture: z.string().trim().max(1500).optional().or(z.literal("")),
  lookingFor: z.string().trim().max(1500).optional().or(z.literal("")),
  name: z.string().trim().min(2, "Enter the company name").max(160),
  industry: optionalText(120),
  location: optionalText(160),
  website: z
    .string()
    .trim()
    .url("Enter a valid website, e.g. https://example.co.zw")
    .refine((v) => /^https?:\/\//i.test(v), "Use http:// or https://")
    .optional()
    .or(z.literal("")),
  description: optionalText(2000),
  registrationNumber: optionalText(60),
  registrationDetails: optionalText(1000),
  repName: optionalText(120),
  repTitle: optionalText(120),
  repPhone: phoneSchema,
  repEmail: z.string().trim().email("Enter a valid email").max(254).optional().or(z.literal("")),
});
export type CompanyProfileValues = z.infer<typeof companyProfileSchema>;
