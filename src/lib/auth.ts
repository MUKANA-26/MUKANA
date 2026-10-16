import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
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
}

/** The verified current user plus their profile, or null. Cached per request. */
export const getSession = cache(async (): Promise<SessionProfile | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, status, full_name, email, phone, avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isRole(profile.role)) return null;
  return { ...(profile as Omit<SessionProfile, "emailVerified">), role: profile.role, emailVerified: Boolean(user.email_confirmed_at) };
});

export async function requireUser(): Promise<SessionProfile> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.status === "suspended") redirect("/suspended");
  return session;
}

/** Page-level guard (the proxy already redirects; this is the defence-in-depth check). */
export async function requireRole(role: Role): Promise<SessionProfile> {
  const session = await requireUser();
  if (session.role !== role) redirect(ROLE_HOME[session.role]);
  return session;
}
