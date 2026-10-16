"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FileUploader } from "@/features/files/file-uploader";
import { INDUSTRIES } from "@/lib/zimbabwe";
import { companyLogoUrl } from "@/lib/storage";
import type { CompanyPrivateRow, CompanyRow } from "@/types/db";
import { saveCompanyProfileAction } from "./actions";
import { companyProfileSchema, type CompanyProfileValues } from "./schemas";

export function CompanyProfileForm({ company, priv }: { company: CompanyRow; priv: CompanyPrivateRow | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyProfileValues>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      name: company.name,
      industry: company.industry ?? "",
      location: company.location ?? "",
      website: company.website ?? "",
      description: company.description ?? "",
      registrationNumber: priv?.registration_number ?? "",
      registrationDetails: priv?.registration_details ?? "",
      repName: priv?.rep_name ?? "",
      repTitle: priv?.rep_title ?? "",
      repPhone: priv?.rep_phone ?? "",
      repEmail: priv?.rep_email ?? "",
    },
  });
  const logo = companyLogoUrl(company.logo_path);

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit(
        (values) =>
          startTransition(async () => {
            const r = await saveCompanyProfileAction(values);
            if (r.ok) {
              toast.success(r.message ?? "Saved");
              router.refresh();
            } else toast.error(r.error ?? "Could not save");
          }),
        () => toast.error("Please fix the highlighted fields"),
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>Company details</CardTitle>
          <CardDescription>Shown publicly on your opportunities.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white">
              {logo ? <Image src={logo} alt={`${company.name} logo`} width={64} height={64} className="size-16 object-contain" /> : <Building2 className="size-7 text-muted-foreground" aria-hidden />}
            </div>
            <div className="min-w-0 flex-1">
              <FileUploader kind="company_logo" ownerId={company.id} currentPath={company.logo_path} compact />
            </div>
          </div>
          <Field label="Company name" htmlFor="name" error={errors.name?.message} required>
            <Input id="name" autoComplete="organization" {...register("name")} />
          </Field>
          <Field label="Industry" htmlFor="industry" error={errors.industry?.message} required>
            <Select id="industry" {...register("industry")}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Location" htmlFor="location" error={errors.location?.message} hint="City and province, e.g. Harare, Harare" required>
            <Input id="location" {...register("location")} />
          </Field>
          <Field label="Website" htmlFor="website" error={errors.website?.message}>
            <Input id="website" type="url" inputMode="url" placeholder="https://" {...register("website")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="About the company" htmlFor="description" error={errors.description?.message}>
              <Textarea id="description" rows={4} {...register("description")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registration and representative</CardTitle>
          <CardDescription>Private. Only you and Mukana administrators can see this.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Company registration number" htmlFor="registrationNumber" error={errors.registrationNumber?.message}>
            <Input id="registrationNumber" {...register("registrationNumber")} />
          </Field>
          <Field label="Registration details" htmlFor="registrationDetails" error={errors.registrationDetails?.message} hint="e.g. Registered with the Registrar of Companies, year, type">
            <Input id="registrationDetails" {...register("registrationDetails")} />
          </Field>
          <Field label="Authorised representative" htmlFor="repName" error={errors.repName?.message}>
            <Input id="repName" {...register("repName")} />
          </Field>
          <Field label="Position" htmlFor="repTitle" error={errors.repTitle?.message}>
            <Input id="repTitle" {...register("repTitle")} />
          </Field>
          <Field label="Representative phone" htmlFor="repPhone" error={errors.repPhone?.message}>
            <Input id="repPhone" type="tel" placeholder="+263 77 123 4567" {...register("repPhone")} />
          </Field>
          <Field label="Representative email" htmlFor="repEmail" error={errors.repEmail?.message}>
            <Input id="repEmail" type="email" {...register("repEmail")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" variant="cta" size="lg" loading={pending}>
          Save company profile
        </Button>
      </div>
    </form>
  );
}
