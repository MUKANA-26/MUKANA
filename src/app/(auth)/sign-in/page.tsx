import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold">Welcome back</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">Sign in to continue to Mukana.</p>
      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          {error === "callback" ? "That link is invalid or has expired. Please try again." : "Please sign in again."}
        </p>
      ) : null}
      <SignInForm next={next} />
      <p className="mt-5 text-center text-sm text-muted-foreground">
        New to Mukana?{" "}
        <Link href="/sign-up" className="font-semibold text-link hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
