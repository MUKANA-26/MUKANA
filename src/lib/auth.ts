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

type ProfileRow = Omit<SessionProfile, "emailVerified" | "onboarded"> & { onboarded?: boolean | null };

interface Loaded {
  user: User;
  claims: { aal?: string; app_metadata?: { role?: unknown } } | undefined;
  profile: ProfileRow | null;
}

/**
 * Everything a page needs to know about the caller, loaded once per request.
 * The JWT is checked locally first (fast), then the user record and the profile are fetched IN PARALLEL: one network round trip
 * instead of three in a row.
 */
const load = cache(async (): Promise<Loaded | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as ({ sub?: string; aal?: string; app_metadata?: { role?: unknown } }) | undefined;
  if (!claims?.sub) return null;

  const profileQuery = async (): Promise<ProfileRow | null> => {
    // `onboarded` arrives with the network migration; tolerate a database that does not have it yet.
    const full = await supabase.from("profiles").select("id, role, status, full_name, email, phone, avatar_path, onboarded").eq("id", claims.sub!).maybeSingle();
    if (full.data) return full.data as ProfileRow;
    const basic = await supabase.from("profiles").select("id, role, status, full_name, email, phone, avatar_path").eq("id", claims.sub!).maybeSingle();
    return (basic.data as ProfileRow | null) ?? null;
  };
  const [{ data: userData }, profile] = await Promise.all([supabase.auth.getUser(), profileQuery()]);
  if (!userData.user) return null;
  return { user: userData.user, claims, profile };
});

/** The signed-in auth user and whether the second step (two-step verification) is still outstanding. */
export const getAuthState = cache(async (): Promise<{ user: User; mfaPending: boolean; role: Role | null } | null> => {
  const loaded = await load();
  if (!loaded) return null;
  const hasVerifiedFactor = (loaded.user.factors ?? []).some((f) => f.status === "verified");
  const role = isRole(loaded.claims?.app_metadata?.role) ? (loaded.claims!.app_metadata!.role as Role) : null;
  return { user: loaded.user, mfaPending: hasVerifiedFactor && loaded.claims?.aal !== "aal2", role };
});

/** The verified current user plus their profile, or null. Cached per request. */
export const getSession = cache(async (): Promise<SessionProfile | null> => {
  const loaded = await load();
  const auth = await getAuthState();
  if (!loaded || !auth || auth.mfaPending) return null;
  const profile = loaded.profile;
  if (!profile || !isRole(profile.role)) return null;
  return {
    ...profile,
    role: profile.role,
    emailVerified: Boolean(loaded.user.email_confirmed_at),
    onboarded: profile.onboarded !== false,
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
