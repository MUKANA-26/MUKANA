import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/features/auth/sign-up-form";
import { GoogleButton } from "@/features/auth/google-button";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold">Create your account</h1>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">Free for attachees, graduate trainees and employers.</p>
      <div className="mb-4">
        <GoogleButton label="Sign up with Google" />
      </div>
      <SignUpForm defaultRole={role === "employer" ? "employer" : "candidate"} />
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-link hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
