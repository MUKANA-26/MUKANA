import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, isRole, safeNext } from "@/lib/roles";
import { WelcomeForm } from "@/features/auth/welcome-form";

export const metadata: Metadata = { title: "Welcome to Mukana" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const auth = await getAuthState();
  if (!auth) redirect("/sign-in");
  if (auth.mfaPending) redirect("/sign-in/verify");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role, full_name, onboarded").eq("id", auth.user.id).maybeSingle();
  if (!profile) redirect("/sign-in");
  if (profile.onboarded !== false) redirect(safeNext(next, isRole(profile.role) ? ROLE_HOME[profile.role] : "/"));
  return <WelcomeForm name={profile.full_name || ""} />;
}
