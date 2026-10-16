import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/password-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold">Reset your password</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
      <ForgotPasswordForm />
      <p className="mt-5 text-center text-sm">
        <Link href="/sign-in" className="font-semibold text-link hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
