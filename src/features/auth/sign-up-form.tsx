"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BriefcaseBusiness, Building2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import { signUpAction } from "./actions";
import { signUpSchema, type SignUpValues } from "./schemas";

function Segment<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon: React.ComponentType<{ className?: string }> }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted",
            )}
          >
            <o.icon className="size-4" /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SignUpForm({ defaultRole = "candidate" }: { defaultRole?: "candidate" | "employer" }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      role: defaultRole,
      candidateType: "attachee",
      fullName: "",
      companyName: "",
      email: "",
      password: "",
      confirmPassword: "",
      consent: false,
    },
  });
  const role = watch("role");

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await signUpAction(values);
      if (!result.ok) return setError(result.error ?? "Could not create your account");
      router.replace(result.redirectTo ?? "/");
      router.refresh();
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">I am a…</p>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Segment
              label="Account type"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "candidate", label: "Candidate", icon: GraduationCap },
                { value: "employer", label: "Employer", icon: Building2 },
              ]}
            />
          )}
        />
      </div>

      {role === "candidate" ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">I am looking for…</p>
          <Controller
            control={control}
            name="candidateType"
            render={({ field }) => (
              <Segment
                label="Candidate type"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "attachee", label: "Attachment", icon: BriefcaseBusiness },
                  { value: "graduate_trainee", label: "Trainee programme", icon: GraduationCap },
                ]}
              />
            )}
          />
        </div>
      ) : null}

      <Field label={role === "employer" ? "Your full name" : "Full name"} htmlFor="fullName" error={errors.fullName?.message} required>
        <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} {...register("fullName")} />
      </Field>
      {role === "employer" ? (
        <Field label="Company name" htmlFor="companyName" error={errors.companyName?.message} required>
          <Input id="companyName" autoComplete="organization" aria-invalid={!!errors.companyName} {...register("companyName")} />
        </Field>
      ) : null}
      <Field label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters with a letter and a number." required>
        <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
        <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
      </Field>

      <div className="space-y-1.5">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox className="mt-0.5" aria-invalid={!!errors.consent} {...register("consent")} />
          <span>
            I have read and agree to the{" "}
            <Link href="/privacy" target="_blank" className="font-medium text-link underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" target="_blank" className="font-medium text-link underline">
              Terms of Use
            </Link>
            , and I consent to Mukana processing my personal data under Zimbabwe&apos;s Cyber and Data Protection Act.
          </span>
        </label>
        {errors.consent ? (
          <p role="alert" className="text-xs font-medium text-danger">
            {errors.consent.message}
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="cta" size="lg" className="w-full" loading={pending} disabled={!hydrated}>
        Create account
      </Button>
    </form>
  );
}
