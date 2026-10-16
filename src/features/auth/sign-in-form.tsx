"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { useHydrated } from "@/lib/use-hydrated";
import { signInAction } from "./actions";
import { signInSchema, type SignInValues } from "./schemas";

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await signInAction(values, next);
      if (!result.ok) return setError(result.error ?? "Could not sign in");
      router.replace(result.redirectTo ?? "/");
      router.refresh();
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message} required>
        <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-link hover:underline">
          Forgot password?
        </Link>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="cta" size="lg" className="w-full" loading={pending} disabled={!hydrated}>
        Sign in
      </Button>
    </form>
  );
}
