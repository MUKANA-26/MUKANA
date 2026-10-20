"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";

let cached: Promise<boolean> | null = null;

/**
 * Whether Google sign-in is switched on in the Supabase project. Asked once per page load, so the button
 * appears by itself the moment the Google provider is enabled (NEXT_PUBLIC_GOOGLE_AUTH=false hides it).
 */
function googleAvailable(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH === "false") return Promise.resolve(false);
  cached ??= fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { external?: { google?: boolean } } | null) => j?.external?.google === true)
    .catch(() => false);
  return cached;
}

export function GoogleButton({ next, label = "Continue with Google" }: { next?: string; label?: string }) {
  const hydrated = useHydrated();
  const [enabled, setEnabled] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    void googleAvailable().then((v) => live && setEnabled(v));
    return () => {
      live = false;
    };
  }, []);
  if (!enabled) return null;
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        loading={pending}
        disabled={!hydrated}
        onClick={async () => {
          setPending(true);
          setError(null);
          const { error: e } = await createClient().auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next && next.startsWith("/") ? next : "/")}` },
          });
          if (e) {
            setPending(false);
            setError("Google sign-in is not available right now.");
          }
        }}
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
        </svg>
        {label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <p className="text-center text-xs text-muted-foreground">
        By continuing with Google you agree to our{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
