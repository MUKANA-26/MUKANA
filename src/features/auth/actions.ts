"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, isRole, safeNext } from "@/lib/roles";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordValues,
  type ResetPasswordValues,
  type SignInValues,
  type SignUpValues,
} from "./schemas";

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Where the client should navigate next. */
  redirectTo?: string;
  message?: string;
}

async function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Please verify your email first. Check your inbox for the confirmation link.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("password")) return message;
  return "Something went wrong. Please try again.";
}

export async function signInAction(values: SignInValues, next?: string): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };

  const supabase = await createClient();
  const { captchaToken, ...credentials } = parsed.data;
  const { data, error } = await supabase.auth.signInWithPassword({ ...credentials, options: captchaToken ? { captchaToken } : undefined });
  if (error || !data.user) return { ok: false, error: friendlyAuthError(error?.message ?? "") };

  // Two-step verification: with a password-only session the database serves nothing, so continue at the code screen.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const wanted = safeNext(next, "");
    return { ok: true, redirectTo: wanted ? `/sign-in/verify?next=${encodeURIComponent(wanted)}` : "/sign-in/verify" };
  }

  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", data.user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { ok: false, error: "We couldn't find your account profile. Contact support." };
  }
  if (profile.status === "suspended") {
    await supabase.auth.signOut();
    return { ok: false, error: "This account has been suspended. Contact support if you think this is a mistake." };
  }
  const role = isRole(profile.role) ? profile.role : "candidate";
  const home = ROLE_HOME[role];
  const target = safeNext(next, home);
  // Only follow ?next= when it belongs to this user's area (or is a public page).
  const allowed = target === home || target.startsWith(`${home}/`) || !/^\/(candidate|employer|admin)(\/|$)/.test(target);
  return { ok: true, redirectTo: allowed ? target : home };
}

export async function signUpAction(values: SignUpValues): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=/verified`,
      captchaToken: v.captchaToken || undefined,
      data: {
        full_name: v.fullName,
        role: v.role,
        candidate_type: v.candidateType,
        company_name: v.role === "employer" ? v.companyName : undefined,
        consent: true,
      },
    },
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };

  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, error: "An account with this email already exists. Try signing in." };
  }
  if (data.session) {
    // Email confirmation is switched off in this project; go straight to the dashboard.
    return { ok: true, redirectTo: ROLE_HOME[v.role] };
  }
  return { ok: true, redirectTo: `/verify-email?email=${encodeURIComponent(v.email)}` };
}

export async function resendVerificationAction(email: string): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) return { ok: false, error: "Enter a valid email address" };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${await siteUrl()}/auth/callback?next=/verified` },
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true, message: "Verification email sent." };
}

export async function forgotPasswordAction(values: ForgotPasswordValues): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Enter a valid email address" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password`,
    captchaToken: parsed.data.captchaToken || undefined,
  });
  // Always report success so the form can't be used to discover which emails are registered.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPasswordAction(values: ResetPasswordValues): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password" };
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true, redirectTo: "/", message: "Password updated." };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
