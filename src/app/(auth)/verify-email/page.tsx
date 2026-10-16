import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ResendVerification } from "@/features/auth/password-forms";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = "" } = await searchParams;
  return (
    <div className="text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-info-soft text-info-soft-foreground">
        <MailCheck className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 font-heading text-2xl font-semibold">Check your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a confirmation link{email ? <> to <strong className="text-foreground">{email}</strong></> : null}. Open it to
        verify your address. You must verify your email before you can apply or publish opportunities.
      </p>
      <div className="mt-5 flex flex-col items-center gap-3">
        <ResendVerification email={email} />
        <Link href="/sign-in" className="text-sm font-semibold text-link hover:underline">
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
