"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { FIELDS_OF_STUDY, LEVELS, PROVINCES, QUALIFICATION_LEVELS } from "@/lib/zimbabwe";
import { OPPORTUNITY_TYPES, showsMinLevel, showsMinQualification } from "@/lib/opportunity-types";
import type { OpportunityRow } from "@/types/db";
import { saveOpportunityAction } from "./actions";
import { opportunitySchema, type OpportunityValues } from "./schemas";

function toDefaults(o: OpportunityRow | null): OpportunityValues {
  if (!o) {
    return {
      type: "industrial_attachment",
      title: "",
      department: "",
      description: "",
      requirements: "",
      skills: [],
      eligibleFields: [],
      minLevel: "",
      minQualification: "",
      slots: "1",
      location: "",
      province: "",
      mode: "on_site",
      startDate: "",
      durationMonths: "",
      stipendType: "unpaid",
      stipendAmount: "",
      stipendCurrency: "USD",
      deadline: "",
    };
  }
  return {
    type: o.type,
    title: o.title,
    department: o.department ?? "",
    description: o.description,
    requirements: o.requirements ?? "",
    skills: o.skills,
    eligibleFields: o.eligible_fields,
    minLevel: o.min_level != null ? Number(o.min_level).toFixed(1) : "",
    minQualification: o.min_qualification ?? "",
    slots: String(o.slots),
    location: o.location,
    province: o.province ?? "",
    mode: o.mode,
    startDate: o.start_date ?? "",
    durationMonths: o.duration_months != null ? String(o.duration_months) : "",
    stipendType: o.stipend_type,
    stipendAmount: o.stipend_amount != null ? String(o.stipend_amount) : "",
    stipendCurrency: o.stipend_currency ?? "USD",
    deadline: o.deadline,
  };
}

export function OpportunityForm({
  opportunity,
  verified,
}: {
  opportunity: OpportunityRow | null;
  /** Whether the company is verified (only verified companies can publish). */
  verified: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [intent, setIntent] = React.useState<"draft" | "publish">("draft");
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<OpportunityValues>({ resolver: zodResolver(opportunitySchema), defaultValues: toDefaults(opportunity) });
  const type = watch("type");
  const stipendType = watch("stipendType");
  const alreadyPublished = opportunity?.status === "published";

  const submit = (which: "draft" | "publish") => {
    setIntent(which);
    return handleSubmit(
      (values) =>
        startTransition(async () => {
          const r = await saveOpportunityAction(opportunity?.id ?? null, values, which);
          if (!r.ok) return void toast.error(r.error ?? "Could not save");
          toast.success(r.message ?? "Saved");
          router.push("/employer/opportunities");
          router.refresh();
        }),
      () => toast.error("Please fix the highlighted fields"),
    )();
  };

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-5">
      {!verified ? (
        <div role="note" className="flex gap-3 rounded-xl border border-warning bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            Your company isn&apos;t verified yet, so you can save drafts but not publish. <a href="/employer/company" className="font-semibold underline">Request verification</a>.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>The role</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="type" required>
            <Select id="type" {...register("type")} disabled={alreadyPublished}>
              {OPPORTUNITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.formLabel}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department" htmlFor="department" error={errors.department?.message}>
            <Input id="department" {...register("department")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Title" htmlFor="title" error={errors.title?.message} required>
              <Input id="title" placeholder="e.g. Software Development Attachee" {...register("title")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="description" error={errors.description?.message} required>
              <Textarea id="description" rows={6} {...register("description")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Requirements" htmlFor="requirements" error={errors.requirements?.message}>
              <Textarea id="requirements" rows={4} {...register("requirements")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who can apply</CardTitle>
          <CardDescription>These drive the match score candidates and you see.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Required skills" htmlFor="skills" error={errors.skills?.message as string | undefined} hint="Press Enter or comma after each skill.">
              <Controller control={control} name="skills" render={({ field }) => <TagInput id="skills" value={field.value} onChange={field.onChange} placeholder="e.g. Excel, AutoCAD, Python" />} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Eligible programmes / fields" htmlFor="eligibleFields" hint="Leave empty to welcome all fields.">
              <Controller
                control={control}
                name="eligibleFields"
                render={({ field }) => <TagInput id="eligibleFields" value={field.value} onChange={field.onChange} suggestions={FIELDS_OF_STUDY} placeholder="e.g. Computer Science" />}
              />
            </Field>
          </div>
          {showsMinLevel(type) ? (
            <Field label="Minimum level" htmlFor="minLevel" error={errors.minLevel?.message} hint="Part and semester, e.g. 2.2">
              <Select id="minLevel" {...register("minLevel")}>
                <option value="">No minimum</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {showsMinQualification(type) ? (
            <Field label="Minimum qualification" htmlFor="minQualification" error={errors.minQualification?.message}>
              <Select id="minQualification" {...register("minQualification")}>
                <option value="">No minimum</option>
                {QUALIFICATION_LEVELS.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Number of slots" htmlFor="slots" error={errors.slots?.message} required>
            <Input id="slots" inputMode="numeric" {...register("slots")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where, when and pay</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Location (city / town)" htmlFor="location" error={errors.location?.message} required>
            <Input id="location" {...register("location")} />
          </Field>
          <Field label="Province" htmlFor="province" error={errors.province?.message}>
            <Select id="province" {...register("province")}>
              <option value="">Select province</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Work mode" htmlFor="mode" required>
            <Select id="mode" {...register("mode")}>
              <option value="on_site">On-site</option>
              <option value="hybrid">Hybrid</option>
            </Select>
          </Field>
          <Field label="Duration (months)" htmlFor="durationMonths" error={errors.durationMonths?.message}>
            <Input id="durationMonths" inputMode="numeric" placeholder="e.g. 6" {...register("durationMonths")} />
          </Field>
          <Field label="Start date" htmlFor="startDate" error={errors.startDate?.message}>
            <Input id="startDate" type="date" {...register("startDate")} />
          </Field>
          <Field label="Application deadline" htmlFor="deadline" error={errors.deadline?.message} hint="The opportunity closes automatically after this date." required>
            <Input id="deadline" type="date" {...register("deadline")} />
          </Field>
          <Field label="Stipend" htmlFor="stipendType" required>
            <Select id="stipendType" {...register("stipendType")}>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </Select>
          </Field>
          {stipendType === "paid" ? (
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <Field label="Monthly amount (optional)" htmlFor="stipendAmount" error={errors.stipendAmount?.message}>
                <Input id="stipendAmount" inputMode="decimal" placeholder="e.g. 150" {...register("stipendAmount")} />
              </Field>
              <Field label="Currency" htmlFor="stipendCurrency">
                <Select id="stipendCurrency" {...register("stipendCurrency")}>
                  <option value="USD">USD</option>
                  <option value="ZiG">ZiG</option>
                </Select>
              </Field>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-20 flex flex-wrap justify-end gap-2 md:bottom-4">
        <Button type="button" variant="outline" size="lg" className="bg-surface shadow-lg" loading={pending && intent === "draft"} disabled={pending || alreadyPublished} onClick={() => void submit("draft")}>
          Save draft
        </Button>
        <Button
          type="button"
          variant="cta"
          size="lg"
          className="shadow-lg"
          loading={pending && intent === "publish"}
          disabled={pending || (!verified && !alreadyPublished)}
          onClick={() => void submit(alreadyPublished ? "publish" : "publish")}
        >
          {alreadyPublished ? "Save changes" : "Publish"}
        </Button>
      </div>
    </form>
  );
}
