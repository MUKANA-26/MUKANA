"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "./actions";

/** Second step of sign-in: the 6-digit code from the member's authenticator app. */
export function Verify2faForm({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const submit = async () => {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f: { status: string }) => f.status === "verified");
    if (!factor) {
      setPending(false);
      return setError("No authenticator is set up for this account.");
    }
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    if (e) {
      setPending(false);
      return setError("That code is not right, or it has expired. Check the code in your authenticator app and try again.");
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <div className="space-y-4">
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-info-soft text-info-soft-foreground">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-heading text-xl font-semibold">Two-step verification</h1>
          <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
        </div>
      </div>
      <Field label="Code" htmlFor="mfa-code" error={error ?? undefined}>
        <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
      </Field>
      <Button type="submit" variant="cta" size="lg" className="w-full" loading={pending} disabled={code.length !== 6}>
        Verify and continue
      </Button>
    </form>
      <form action={signOutAction}>
        <button type="submit" className="block w-full text-center text-sm font-medium text-link hover:underline">
          Use a different account
        </button>
      </form>
    </div>
  );
}
