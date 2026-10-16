import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";

export const metadata: Metadata = { title: "Email verified" };

export default async function VerifiedPage() {
  const session = await getSession();
  return (
    <div className="text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success-soft-foreground">
        <BadgeCheck className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 font-heading text-2xl font-semibold">Email verified</h1>
      <p className="mt-2 text-sm text-muted-foreground">Thanks! Your email address is confirmed.</p>
      <Button asChild variant="cta" size="lg" className="mt-5 w-full">
        <Link href={session ? ROLE_HOME[session.role] : "/sign-in"}>{session ? "Go to my dashboard" : "Sign in"}</Link>
      </Button>
    </div>
  );
}
