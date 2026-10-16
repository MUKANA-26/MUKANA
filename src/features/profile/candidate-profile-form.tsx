"use client";

import * as React from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { FileUploader } from "@/features/files/file-uploader";
import { PdfViewerDialog, type PdfTarget } from "@/features/files/pdf-viewer-dialog";
import { DEGREE_CLASSES, FIELDS_OF_STUDY, INSTITUTIONS, LEVELS, PROVINCES, QUALIFICATION_LEVELS } from "@/lib/zimbabwe";
import type { CandidateProfileRow } from "@/types/db";
import { saveCandidateProfileAction } from "./actions";
import { candidateProfileSchema, type CandidateProfileValues } from "./schemas";

export interface CandidateProfileInitial {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  profile: CandidateProfileRow;
}

function toDefaults(i: CandidateProfileInitial): CandidateProfileValues {
  const p = i.profile;
  return {
    fullName: i.fullName,
    phone: i.phone,
    city: p.city ?? "",
    province: p.province ?? "",
    bio: p.bio ?? "",
    candidateType: p.candidate_type,
    institution: p.institution ?? "",
    programme: p.programme ?? "",
    currentLevel: p.current_level != null ? p.current_level.toFixed(1) : "",
    registrationNumber: p.registration_number ?? "",
    attachmentStart: p.attachment_start ?? "",
    attachmentEnd: p.attachment_end ?? "",
    qualification: p.qualification ?? "",
    qualificationLevel: p.qualification_level ?? "",
    degreeClass: p.degree_class ?? "",
    graduationYear: p.graduation_year != null ? String(p.graduation_year) : "",
    availabilityDate: p.availability_date ?? "",
    skills: p.skills ?? [],
    certifications: (p.certifications ?? []).map((c) => ({ name: c.name, issuer: c.issuer ?? "", year: c.year ? String(c.year) : "" })),
    projects: (p.projects ?? []).map((x) => ({ title: x.title, description: x.description ?? "", url: x.url ?? "" })),
  };
}

export function CandidateProfileForm({ initial }: { initial: CandidateProfileInitial }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [viewer, setViewer] = React.useState<PdfTarget | null>(null);
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CandidateProfileValues>({ resolver: zodResolver(candidateProfileSchema), defaultValues: toDefaults(initial) });
  const certs = useFieldArray({ control, name: "certifications" });
  const projects = useFieldArray({ control, name: "projects" });
  const type = watch("candidateType");

  const onSubmit = handleSubmit(
    (values) =>
      startTransition(async () => {
        const r = await saveCandidateProfileAction(values);
        if (r.ok) {
          toast.success(r.message ?? "Saved");
          router.refresh();
        } else toast.error(r.error ?? "Could not save");
      }),
    () => toast.error("Please fix the highlighted fields"),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
            <Input id="fullName" autoComplete="name" {...register("fullName")} />
          </Field>
          <Field label="Email" htmlFor="email" hint="Your sign-in email. It can't be changed here.">
            <Input id="email" value={initial.email} readOnly disabled />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone?.message} required>
            <Input id="phone" type="tel" autoComplete="tel" placeholder="+263 77 123 4567" {...register("phone")} />
          </Field>
          <Field label="City / town" htmlFor="city" error={errors.city?.message} required>
            <Input id="city" autoComplete="address-level2" {...register("city")} />
          </Field>
          <Field label="Province" htmlFor="province" error={errors.province?.message} required>
            <Select id="province" {...register("province")}>
              <option value="">Select province</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="About you" htmlFor="bio" error={errors.bio?.message} hint="Optional. A short introduction (max 1000 characters).">
              <Textarea id="bio" rows={3} {...register("bio")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <FileUploader kind="avatar" ownerId={initial.userId} label="Profile photo (optional)" compact removable />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Education</CardTitle>
          <CardDescription>This is what employers and the matching score use.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="I am a…" htmlFor="candidateType" required>
            <Select id="candidateType" {...register("candidateType")}>
              <option value="attachee">Attachee (looking for industrial attachment)</option>
              <option value="graduate_trainee">Graduate trainee (recent graduate)</option>
            </Select>
          </Field>
          <Field label="Institution" htmlFor="institution" error={errors.institution?.message} required>
            <Input id="institution" list="institutions" {...register("institution")} />
            <datalist id="institutions">
              {INSTITUTIONS.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </Field>

          {type === "attachee" ? (
            <>
              <Field label="Programme" htmlFor="programme" error={errors.programme?.message} required>
                <Input id="programme" list="fields" placeholder="e.g. Computer Science" {...register("programme")} />
              </Field>
              <Field label="Current level" htmlFor="currentLevel" error={errors.currentLevel?.message} hint="Part and semester, e.g. 2.2" required>
                <Select id="currentLevel" {...register("currentLevel")}>
                  <option value="">Select level</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Registration number" htmlFor="registrationNumber" error={errors.registrationNumber?.message} required>
                <Input id="registrationNumber" {...register("registrationNumber")} />
              </Field>
              <div className="hidden sm:block" />
              <Field label="Attachment start date" htmlFor="attachmentStart" error={errors.attachmentStart?.message} required>
                <Input id="attachmentStart" type="date" {...register("attachmentStart")} />
              </Field>
              <Field label="Attachment end date" htmlFor="attachmentEnd" error={errors.attachmentEnd?.message} required>
                <Input id="attachmentEnd" type="date" {...register("attachmentEnd")} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Qualification" htmlFor="qualification" error={errors.qualification?.message} required>
                <Input id="qualification" list="fields" placeholder="e.g. BSc Computer Science" {...register("qualification")} />
              </Field>
              <Field label="Qualification level" htmlFor="qualificationLevel" error={errors.qualificationLevel?.message} required>
                <Select id="qualificationLevel" {...register("qualificationLevel")}>
                  <option value="">Select level</option>
                  {QUALIFICATION_LEVELS.map((q) => (
                    <option key={q.value} value={q.value}>
                      {q.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Degree class" htmlFor="degreeClass" error={errors.degreeClass?.message} required>
                <Select id="degreeClass" {...register("degreeClass")}>
                  <option value="">Select class</option>
                  {DEGREE_CLASSES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Graduation year" htmlFor="graduationYear" error={errors.graduationYear?.message} required>
                <Input id="graduationYear" inputMode="numeric" maxLength={4} placeholder="2026" {...register("graduationYear")} />
              </Field>
              <Field label="Available from" htmlFor="availabilityDate" error={errors.availabilityDate?.message} required>
                <Input id="availabilityDate" type="date" {...register("availabilityDate")} />
              </Field>
            </>
          )}
          <datalist id="fields">
            {FIELDS_OF_STUDY.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills, certifications and projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Skills" htmlFor="skills" error={errors.skills?.message as string | undefined} hint="Add at least 3. Press Enter or comma after each one." required>
            <Controller
              control={control}
              name="skills"
              render={({ field }) => <TagInput id="skills" value={field.value} onChange={field.onChange} placeholder="e.g. Excel, Python, Public speaking" />}
            />
          </Field>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Certifications</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => certs.append({ name: "", issuer: "", year: "" })}>
                <Plus aria-hidden /> Add
              </Button>
            </div>
            {certs.fields.length === 0 ? <p className="text-sm text-muted-foreground">Optional. Add short courses and certificates.</p> : null}
            {certs.fields.map((f, i) => (
              <div key={f.id} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
                <Field label="Name" htmlFor={`cert-${i}-name`} error={errors.certifications?.[i]?.name?.message}>
                  <Input id={`cert-${i}-name`} {...register(`certifications.${i}.name`)} />
                </Field>
                <Field label="Issuer" htmlFor={`cert-${i}-issuer`}>
                  <Input id={`cert-${i}-issuer`} {...register(`certifications.${i}.issuer`)} />
                </Field>
                <Field label="Year" htmlFor={`cert-${i}-year`} error={errors.certifications?.[i]?.year?.message}>
                  <Input id={`cert-${i}-year`} inputMode="numeric" maxLength={4} {...register(`certifications.${i}.year`)} />
                </Field>
                <Button type="button" size="icon" variant="ghost" className="self-end" aria-label="Remove certification" onClick={() => certs.remove(i)}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Projects</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => projects.append({ title: "", description: "", url: "" })}>
                <Plus aria-hidden /> Add
              </Button>
            </div>
            {projects.fields.length === 0 ? <p className="text-sm text-muted-foreground">Optional. Academic or personal projects show initiative.</p> : null}
            {projects.fields.map((f, i) => (
              <div key={f.id} className="space-y-3 rounded-xl border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label="Title" htmlFor={`proj-${i}-title`} error={errors.projects?.[i]?.title?.message}>
                    <Input id={`proj-${i}-title`} {...register(`projects.${i}.title`)} />
                  </Field>
                  <Field label="Link (optional)" htmlFor={`proj-${i}-url`} error={errors.projects?.[i]?.url?.message}>
                    <Input id={`proj-${i}-url`} type="url" inputMode="url" placeholder="https://" {...register(`projects.${i}.url`)} />
                  </Field>
                  <Button type="button" size="icon" variant="ghost" className="self-end" aria-label="Remove project" onClick={() => projects.remove(i)}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
                <Field label="Description" htmlFor={`proj-${i}-desc`} error={errors.projects?.[i]?.description?.message}>
                  <Textarea id={`proj-${i}-desc`} rows={2} {...register(`projects.${i}.description`)} />
                </Field>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>PDF only, maximum 5MB. Stored privately; only employers you apply to can open them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploader
            kind="cv"
            ownerId={initial.userId}
            label="CV *"
            currentPath={initial.profile.cv_path}
            onView={(path) => setViewer({ bucket: "cvs", path, title: "My CV" })}
          />
          {type === "attachee" ? (
            <FileUploader
              kind="placement_letter"
              ownerId={initial.userId}
              label="Institution placement letter (optional)"
              currentPath={initial.profile.placement_letter_path}
              removable
              onView={(path) => setViewer({ bucket: "placement-letters", path, title: "Placement letter" })}
            />
          ) : null}
          <p className="text-xs text-muted-foreground">
            No CV yet? Use the <a href="/candidate/cv-builder" className="font-medium text-link underline">CV builder</a>.
          </p>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-20 flex justify-end md:bottom-4">
        <Button type="submit" variant="cta" size="lg" loading={pending} className="shadow-lg">
          {isDirty ? "Save changes" : "Save profile"}
        </Button>
      </div>

      <PdfViewerDialog target={viewer} onClose={() => setViewer(null)} />
    </form>
  );
}
