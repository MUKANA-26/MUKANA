import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/features/auth/password-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in?error=callback");
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold">Choose a new password</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">Use at least 8 characters with a letter and a number.</p>
      <ResetPasswordForm />
    </>
  );
}
