import "@/lib/zod-setup";
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

/** Cloudflare Turnstile token, present only when CAPTCHA is switched on for the site. */
const captcha = z.string().max(4096).optional();

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
  captchaToken: captcha,
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    role: z.enum(["candidate", "employer"]),
    candidateType: z.enum(["attachee", "graduate_trainee"]),
    fullName: z.string().trim().min(2, "Enter your full name").max(120),
    companyName: z.string().trim().max(160).optional().or(z.literal("")),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    consent: z.boolean().refine((v) => v === true, {
      message: "You must accept the Privacy Policy and Terms to continue",
    }),
    captchaToken: captcha,
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((v) => v.role !== "employer" || (v.companyName ?? "").trim().length >= 2, {
    path: ["companyName"],
    message: "Enter your company name",
  });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema, captchaToken: captcha });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
