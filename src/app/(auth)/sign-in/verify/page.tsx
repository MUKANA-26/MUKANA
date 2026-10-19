import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth";
import { ROLE_HOME, safeNext } from "@/lib/roles";
import { Verify2faForm } from "@/features/auth/verify-2fa-form";

export const metadata: Metadata = { title: "Two-step verification" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const auth = await getAuthState();
  if (!auth) redirect("/sign-in");
  const home = auth.role ? ROLE_HOME[auth.role] : "/";
  if (!auth.mfaPending) redirect(safeNext(next, home));
  return <Verify2faForm next={safeNext(next, home)} />;
}
