"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { AvatarUploader } from "@/features/profile/avatar-uploader";
import { changePasswordAction, updateAccountAction } from "./account-actions";

export function AccountPanel({
  userId,
  fullName,
  phone,
  email,
  avatarUrl,
  hasPhoto,
}: {
  userId: string;
  fullName: string;
  phone: string;
  email: string;
  avatarUrl: string | null;
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(fullName);
  const [tel, setTel] = React.useState(phone);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [saving, startSave] = React.useTransition();
  const [changing, startChange] = React.useTransition();
  const [pwError, setPwError] = React.useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Your photo and sign-in details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-5">
          <AvatarUploader userId={userId} url={avatarUrl} name={name} size="lg" hasPhoto={hasPhoto} />
          <div className="min-w-0 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Profile photo</p>
            <p>Shown in the corner of the app and to employers you apply to. JPG, PNG or WebP, up to 2MB.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="acc-name">
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="Phone" htmlFor="acc-phone">
            <Input id="acc-phone" type="tel" value={tel} onChange={(e) => setTel(e.target.value)} autoComplete="tel" placeholder="+263 77 123 4567" />
          </Field>
          <Field label="Email" htmlFor="acc-email" hint="Your sign-in email.">
            <Input id="acc-email" value={email} disabled readOnly />
          </Field>
          <div className="flex items-end">
            <Button
              variant="cta"
              loading={saving}
              onClick={() =>
                startSave(async () => {
                  const r = await updateAccountAction({ fullName: name, phone: tel });
                  if (r.ok) {
                    toast.success(r.message ?? "Saved");
                    router.refresh();
                  } else toast.error(r.error ?? "Could not save");
                })
              }
            >
              Save details
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="font-semibold">Change password</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Current password" htmlFor="pw-current">
              <PasswordInput id="pw-current" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="New password" htmlFor="pw-new" hint="At least 8 characters with a letter and a number.">
              <PasswordInput id="pw-new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
          </div>
          {pwError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {pwError}
            </p>
          ) : null}
          <Button
            variant="outline"
            loading={changing}
            disabled={!current || !next}
            onClick={() =>
              startChange(async () => {
                setPwError(null);
                const r = await changePasswordAction(current, next);
                if (r.ok) {
                  toast.success("Password changed");
                  setCurrent("");
                  setNext("");
                } else setPwError(r.error ?? "Could not change your password");
              })
            }
          >
            Update password
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
