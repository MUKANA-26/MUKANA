import "@/lib/zod-setup";
import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");
// Numbers are kept as strings in the form and converted by the server action.
const wholeNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number`)
    .refine((s) => Number(s) >= min && Number(s) <= max, `${label} must be between ${min} and ${max}`);

export const opportunitySchema = z
  .object({
    type: z.enum(["industrial_attachment", "internship", "graduate_trainee", "entry_level"]),
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
    department: optionalText(120),
    description: z.string().trim().min(20, "Describe the opportunity (at least 20 characters)").max(8000),
    requirements: optionalText(4000),
    skills: z.array(z.string().trim().min(1).max(60)).max(30),
    eligibleFields: z.array(z.string().trim().min(1).max(80)).max(30),
    minLevel: z.string().regex(/^[1-6]\.[1-2]$/, "Use the format 2.2").optional().or(z.literal("")),
    minQualification: z.enum(["certificate", "diploma", "bachelors", "honours", "masters", "phd"]).optional().or(z.literal("")),
    slots: wholeNumber(1, 1000, "Slots"),
    location: z.string().trim().min(2, "Enter the location").max(160),
    province: optionalText(80),
    mode: z.enum(["on_site", "hybrid"]),
    startDate: dateString.optional().or(z.literal("")),
    durationMonths: wholeNumber(1, 36, "Duration").optional().or(z.literal("")),
    stipendType: z.enum(["paid", "unpaid"]),
    stipendAmount: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount such as 150 or 150.50")
      .optional()
      .or(z.literal("")),
    stipendCurrency: z.enum(["USD", "ZiG"]).optional().or(z.literal("")),
    deadline: dateString,
    noExperience: z.boolean().optional(),
  })
  .refine((v) => !v.startDate || v.deadline <= v.startDate, {
    path: ["deadline"],
    message: "The deadline should be on or before the start date",
  });

export type OpportunityValues = z.infer<typeof opportunitySchema>;
