"use client";

import * as React from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";

interface Enrolment {
  factorId: string;
  qr: string;
  secret: string;
}

/** Turn two-step verification (authenticator app codes) on or off. */
export function TwoFactorPanel() {
  const supabase = React.useMemo(() => createClient(), []);
  const [loading, setLoading] = React.useState(true);
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [enrolment, setEnrolment] = React.useState<Enrolment | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find((f: { status: string }) => f.status === "verified");
    setFactorId(verified?.id ?? null);
    setLoading(false);
  }, [supabase]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setBusy(true);
    // Remove any half-finished set-up first.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of (existing?.all ?? []) as { id: string; status: string; factor_type: string }[]) {
      if (f.status !== "verified" && f.factor_type === "totp") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Mukana ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error || !data) return void toast.error("Could not start set-up. Please try again.");
    setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirm = async () => {
    if (!enrolment) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code: code.trim() });
    setBusy(false);
    if (error) return void toast.error("That code is not right. Check your authenticator app and try again.");
    toast.success("Two-step verification is on");
    setEnrolment(null);
    setCode("");
    void load();
  };

  const turnOff = async () => {
    if (!factorId || !window.confirm("Turn off two-step verification? Your account will be protected by your password only.")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) return void toast.error("Could not turn it off. Sign in again and retry.");
    toast.success("Two-step verification is off");
    void load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-step verification</CardTitle>
        <CardDescription>Protect your account with a 6-digit code from an authenticator app (such as Google Authenticator or Microsoft Authenticator) in addition to your password.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking…</p>
        ) : factorId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-success">
              <ShieldCheck className="size-5" aria-hidden /> On. You will be asked for a code when you sign in.
            </p>
            <Button variant="outline" loading={busy} onClick={() => void turnOff()}>
              <ShieldOff aria-hidden /> Turn off
            </Button>
          </div>
        ) : enrolment ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Open your authenticator app and scan this code.</li>
              <li>Type the 6-digit code it shows below.</li>
            </ol>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrolment.qr} alt="QR code to add Mukana to your authenticator app" className="size-44 rounded-lg border border-border bg-white p-2" />
            <p className="break-all text-xs text-muted-foreground">
              Cannot scan? Enter this key manually: <span className="font-mono font-semibold text-foreground">{enrolment.secret}</span>
            </p>
            <Field label="6-digit code" htmlFor="tf-code">
              <Input id="tf-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <div className="flex gap-2">
              <Button variant="cta" loading={busy} disabled={code.length !== 6} onClick={() => void confirm()}>
                Turn on
              </Button>
              <Button variant="outline" onClick={() => setEnrolment(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="cta" loading={busy} onClick={() => void start()}>
            <ShieldCheck aria-hidden /> Set up two-step verification
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
