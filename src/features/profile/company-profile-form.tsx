"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FileUploader } from "@/features/files/file-uploader";
import { TagInput } from "@/components/ui/tag-input";
import { GalleryManager } from "./gallery-manager";
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
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyProfileValues>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      name: company.name,
      tagline: company.tagline ?? "",
      sizeBand: (company.size_band ?? "") as CompanyProfileValues["sizeBand"],
      foundedYear: company.founded_year ? String(company.founded_year) : "",
      locations: company.locations ?? [],
      benefits: company.benefits ?? [],
      culture: company.culture ?? "",
      lookingFor: company.looking_for ?? "",
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
          <CardTitle>Public company page</CardTitle>
          <CardDescription>Candidates see this on your page in the Companies directory. Be honest and specific.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Tagline" htmlFor="tagline" error={errors.tagline?.message} hint="One line about what you do, up to 160 characters.">
              <Input id="tagline" maxLength={160} {...register("tagline")} />
            </Field>
          </div>
          <Field label="Company size" htmlFor="sizeBand" error={errors.sizeBand?.message}>
            <Select id="sizeBand" {...register("sizeBand")}>
              <option value="">Not shown</option>
              {["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"].map((b) => (
                <option key={b} value={b}>
                  {b} employees
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Year founded" htmlFor="foundedYear" error={errors.foundedYear?.message}>
            <Input id="foundedYear" inputMode="numeric" maxLength={4} placeholder="e.g. 1998" {...register("foundedYear")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Office and site locations" htmlFor="locations" hint="Press Enter or comma after each place.">
              <Controller control={control} name="locations" render={({ field }) => <TagInput id="locations" value={field.value ?? []} onChange={field.onChange} placeholder="e.g. Harare, Bulawayo, Hwange" />} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Benefits and support for attachees and trainees" htmlFor="benefits" hint="For example: transport allowance, lunch, mentorship, certificates, medical aid.">
              <Controller
                control={control}
                name="benefits"
                render={({ field }) => (
                  <TagInput id="benefits" value={field.value ?? []} onChange={field.onChange} suggestions={["Allowance", "Transport", "Lunch", "Mentorship", "Training", "Certificate of attachment", "Medical aid", "Accommodation", "Laptop provided"]} placeholder="Add a benefit" />
                )}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Culture" htmlFor="culture" error={errors.culture?.message} hint="How people work together at your company.">
              <Textarea id="culture" rows={3} {...register("culture")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="What we look for in attachees and graduates" htmlFor="lookingFor" error={errors.lookingFor?.message}>
              <Textarea id="lookingFor" rows={3} {...register("lookingFor")} />
            </Field>
          </div>
          <GalleryManager companyId={company.id} paths={company.gallery_paths ?? []} />
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
