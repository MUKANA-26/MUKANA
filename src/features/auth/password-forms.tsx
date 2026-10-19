"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { useHydrated } from "@/lib/use-hydrated";
import { forgotPasswordAction, resendVerificationAction, resetPasswordAction } from "./actions";
import { Turnstile, captchaEnabled } from "./turnstile";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordValues,
  type ResetPasswordValues,
} from "./schemas";

export function ForgotPasswordForm() {
  const hydrated = useHydrated();
  const [done, setDone] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [captcha, setCaptcha] = React.useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = React.useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  if (done) {
    return (
      <p role="status" className="rounded-lg bg-success-soft px-3 py-3 text-sm font-medium text-success-soft-foreground">
        {done}
      </p>
    );
  }
  return (
    <form
      method="post"
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((values) =>
        startTransition(async () => {
          const r = await forgotPasswordAction({ ...values, captchaToken: captcha ?? undefined });
          if (r.ok) setDone(r.message ?? "Check your email.");
          else {
            setCaptcha(null);
            setCaptchaKey((k) => k + 1);
            toast.error(r.error ?? "Something went wrong");
          }
        }),
      )}
    >
      <Field label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" inputMode="email" {...register("email")} />
      </Field>
      {captchaEnabled ? <Turnstile key={captchaKey} onToken={setCaptcha} /> : null}
      <Button type="submit" variant="cta" size="lg" className="w-full" loading={pending} disabled={!hydrated || (captchaEnabled && !captcha)}>
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, startTransition] = React.useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });

  return (
    <form
      method="post"
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((values) =>
        startTransition(async () => {
          const r = await resetPasswordAction(values);
          if (!r.ok) return void toast.error(r.error ?? "Could not update password");
          toast.success("Password updated");
          router.replace(r.redirectTo ?? "/");
          router.refresh();
        }),
      )}
    >
      <Field label="New password" htmlFor="password" error={errors.password?.message} required>
        <PasswordInput id="password" autoComplete="new-password" {...register("password")} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
        <PasswordInput id="confirmPassword" autoComplete="new-password" {...register("confirmPassword")} />
      </Field>
      <Button type="submit" variant="cta" size="lg" className="w-full" loading={pending} disabled={!hydrated}>
        Update password
      </Button>
    </form>
  );
}

export function ResendVerification({ email }: { email: string }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      loading={pending}
      disabled={!email}
      onClick={() =>
        startTransition(async () => {
          const r = await resendVerificationAction(email);
          if (r.ok) toast.success(r.message ?? "Sent");
          else toast.error(r.error ?? "Could not resend");
        })
      }
    >
      Resend verification email
    </Button>
  );
}
