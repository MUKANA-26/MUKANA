import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Account suspended" };

export default function SuspendedPage() {
  return (
    <div className="text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-danger-soft text-danger-soft-foreground">
        <ShieldAlert className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 font-heading text-2xl font-semibold">Account suspended</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This account has been suspended by a Mukana moderator. If you believe this is a mistake, please contact support.
      </p>
      <form action={signOutAction}>
        <Button type="submit" variant="outline" className="mt-5">
          Sign out
        </Button>
      </form>
    </div>
  );
}
