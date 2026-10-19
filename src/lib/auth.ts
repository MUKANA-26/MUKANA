import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, isRole, type Role } from "@/lib/roles";

export interface SessionProfile {
  id: string;
  role: Role;
  status: "active" | "suspended";
  full_name: string;
  email: string;
  phone: string | null;
  avatar_path: string | null;
  emailVerified: boolean;
  /** False for a first-time Google sign-in that has not chosen candidate/employer yet. */
  onboarded: boolean;
}

/** The signed-in auth user and whether the second step (two-step verification) is still outstanding. */
export const getAuthState = cache(async (): Promise<{ user: User; mfaPending: boolean; role: Role | null } | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as { aal?: string; app_metadata?: { role?: unknown } } | undefined;
  const hasVerifiedFactor = (user.factors ?? []).some((f) => f.status === "verified");
  const role = isRole(claims?.app_metadata?.role) ? claims!.app_metadata!.role : null;
  return { user, mfaPending: hasVerifiedFactor && claims?.aal !== "aal2", role: role as Role | null };
});

/** The verified current user plus their profile, or null. Cached per request. */
export const getSession = cache(async (): Promise<SessionProfile | null> => {
  const auth = await getAuthState();
  if (!auth || auth.mfaPending) return null;
  const supabase = await createClient();
  const user = auth.user;
  // `onboarded` arrives with the network migration; tolerate a database that does not have it yet.
  let { data: profile } = await supabase
    .from("profiles")
    .select("id, role, status, full_name, email, phone, avatar_path, onboarded")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    const retry = await supabase.from("profiles").select("id, role, status, full_name, email, phone, avatar_path").eq("id", user.id).maybeSingle();
    profile = retry.data ? { ...retry.data, onboarded: true } : null;
  }
  if (!profile || !isRole(profile.role)) return null;
  return {
    ...(profile as Omit<SessionProfile, "emailVerified" | "onboarded">),
    role: profile.role,
    emailVerified: Boolean(user.email_confirmed_at),
    onboarded: (profile as { onboarded?: boolean | null }).onboarded !== false,
  };
});

export async function requireUser(): Promise<SessionProfile> {
  const session = await getSession();
  if (!session) {
    const auth = await getAuthState();
    redirect(auth?.mfaPending ? "/sign-in/verify" : "/sign-in");
  }
  if (session.status === "suspended") redirect("/suspended");
  if (!session.onboarded) redirect("/welcome");
  return session;
}

/** Page-level guard (the proxy already redirects; this is the defence-in-depth check). */
export async function requireRole(role: Role): Promise<SessionProfile> {
  const session = await requireUser();
  if (session.role !== role) redirect(ROLE_HOME[session.role]);
  return session;
}
