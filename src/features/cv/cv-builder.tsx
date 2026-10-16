"use client";

import * as React from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Eye, FileDown, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { PdfCanvas } from "@/features/files/pdf-canvas";
import { PdfViewerDialog, type PdfTarget } from "@/features/files/pdf-viewer-dialog";
import { UploadError, uploadFile } from "@/features/files/upload";
import { cn, formatDate } from "@/lib/utils";
import { deleteBuiltCvAction, listBuiltCvsAction, saveCvDraftAction, setMainCvAction, type BuiltCv } from "./actions";
import { CvDocument } from "./cv-document";
import { cvSchema, type CvData } from "./types";

async function renderPdf(data: CvData): Promise<Blob> {
  const { pdf } = await import("@react-pdf/renderer");
  return pdf(<CvDocument data={data} />).toBlob();
}

export function CvBuilder({ userId, initial, built: initialBuilt }: { userId: string; initial: CvData; built: BuiltCv[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"edit" | "preview">("edit");
  const [bytes, setBytes] = React.useState<Uint8Array | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [exporting, setExporting] = React.useState(false);
  const [justBuilt, setJustBuilt] = React.useState<string | null>(null);
  const [library, setLibrary] = React.useState<BuiltCv[]>(initialBuilt);
  const [viewer, setViewer] = React.useState<PdfTarget | null>(null);
  const [settingMain, startSettingMain] = React.useTransition();

  const form = useForm<CvData>({ resolver: zodResolver(cvSchema), defaultValues: initial, mode: "onChange" });
  const { register, control, handleSubmit, formState } = form;
  const { errors } = formState;
  const education = useFieldArray({ control, name: "education" });
  const projects = useFieldArray({ control, name: "projects" });
  const volunteer = useFieldArray({ control, name: "volunteer" });
  const certifications = useFieldArray({ control, name: "certifications" });
  const values = useWatch({ control }) as CvData;

  // Live preview + autosave, debounced.
  const renderToken = React.useRef(0);
  React.useEffect(() => {
    const token = ++renderToken.current;
    const timer = setTimeout(async () => {
      try {
        const blob = await renderPdf(values);
        if (token !== renderToken.current) return;
        setBytes(new Uint8Array(await blob.arrayBuffer()));
        setPreviewError(null);
      } catch {
        if (token === renderToken.current) setPreviewError("Couldn't draw the preview. Check the fields and try again.");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [values]);

  const firstSave = React.useRef(true);
  React.useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(async () => {
      const r = await saveCvDraftAction(values);
      setSaveState(r.ok ? "saved" : "idle");
    }, 1500);
    return () => clearTimeout(timer);
  }, [values]);

  const refreshLibrary = async () => setLibrary(await listBuiltCvsAction());

  const exportPdf = handleSubmit(
    async (data) => {
      setExporting(true);
      try {
        const blob = await renderPdf(data);
        const safeName = (data.fullName || "CV").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const file = new File([blob], `${safeName}-CV.pdf`, { type: "application/pdf" });
        const path = await uploadFile("cv_builder", file, userId);
        setJustBuilt(path);
        await refreshLibrary();
      } catch (e) {
        toast.error(e instanceof UploadError ? e.message : "Couldn't save your CV. Please try again.");
      } finally {
        setExporting(false);
      }
    },
    () => {
      setTab("edit");
      toast.error("Please fix the highlighted fields first");
    },
  );

  const setMain = (path: string) =>
    startSettingMain(async () => {
      const r = await setMainCvAction(path);
      if (r.ok) {
        toast.success(r.message ?? "Done");
        setJustBuilt(null);
        await refreshLibrary();
        router.refresh();
      } else toast.error(r.error ?? "Could not update");
    });

  const editor = (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Template</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="template"
            render={({ field }) => (
              <div role="radiogroup" aria-label="CV template" className="grid grid-cols-2 gap-3">
                {(
                  [
                    { v: "classic", name: "Classic", hint: "Single column, easy to read" },
                    { v: "modern", name: "Modern", hint: "Navy sidebar with a skills column" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    role="radio"
                    aria-checked={field.value === t.v}
                    onClick={() => field.onChange(t.v)}
                    className={cn("rounded-xl border-2 p-3 text-left transition-colors", field.value === t.v ? "border-cta bg-warning-soft" : "border-border bg-surface hover:bg-surface-muted")}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {field.value === t.v ? <Check className="size-4" aria-hidden /> : null} {t.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.hint}</span>
                  </button>
                ))}
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
          <CardDescription>Pre-filled from your profile. Edits here only change this CV.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="cv-name" error={errors.fullName?.message} required>
            <Input id="cv-name" {...register("fullName")} />
          </Field>
          <Field label="Headline" htmlFor="cv-headline" hint="e.g. Final-year Computer Science student">
            <Input id="cv-headline" {...register("headline")} />
          </Field>
          <Field label="Email" htmlFor="cv-email">
            <Input id="cv-email" type="email" {...register("email")} />
          </Field>
          <Field label="Phone" htmlFor="cv-phone">
            <Input id="cv-phone" type="tel" {...register("phone")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Location" htmlFor="cv-location">
              <Input id="cv-location" {...register("location")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Profile summary" htmlFor="cv-summary" hint="2-4 sentences: who you are, what you study, what you want to learn.">
              <Textarea id="cv-summary" rows={4} maxLength={1200} {...register("summary")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Education</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={() => education.append({ institution: "", qualification: "", period: "", details: "" })}>
            <Plus aria-hidden /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {education.fields.map((f, i) => (
            <div key={f.id} className="space-y-3 rounded-xl border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Field label="Institution" htmlFor={`edu-${i}-i`} error={errors.education?.[i]?.institution?.message}>
                  <Input id={`edu-${i}-i`} {...register(`education.${i}.institution`)} />
                </Field>
                <Field label="Period" htmlFor={`edu-${i}-p`}>
                  <Input id={`edu-${i}-p`} placeholder="2023 – 2027" {...register(`education.${i}.period`)} />
                </Field>
                <Button type="button" size="icon" variant="ghost" className="self-end" aria-label="Remove education" onClick={() => education.remove(i)}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <Field label="Qualification" htmlFor={`edu-${i}-q`}>
                <Input id={`edu-${i}-q`} {...register(`education.${i}.qualification`)} />
              </Field>
              <Field label="Highlights" htmlFor={`edu-${i}-d`} hint="One per line: achievements, prizes, group projects.">
                <Textarea id={`edu-${i}-d`} rows={2} {...register(`education.${i}.details`)} />
              </Field>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills and coursework</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Skills" htmlFor="cv-skills">
            <Controller control={control} name="skills" render={({ field }) => <TagInput id="cv-skills" value={field.value} onChange={field.onChange} placeholder="Add a skill" />} />
          </Field>
          <Field label="Relevant coursework" htmlFor="cv-coursework" hint="Modules that show what you've learned, e.g. Database Systems.">
            <Controller control={control} name="coursework" render={({ field }) => <TagInput id="cv-coursework" value={field.value} onChange={field.onChange} max={30} placeholder="Add a module" />} />
          </Field>
          <Field label="Languages" htmlFor="cv-langs">
            <Controller control={control} name="languages" render={({ field }) => <TagInput id="cv-langs" value={field.value} onChange={field.onChange} max={10} placeholder="e.g. English, Shona, Ndebele" />} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Academic projects</CardTitle>
            <CardDescription>No work experience? Projects are your best evidence.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => projects.append({ title: "", description: "", url: "" })}>
            <Plus aria-hidden /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {projects.fields.map((f, i) => (
            <div key={f.id} className="space-y-3 rounded-xl border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Field label="Title" htmlFor={`pr-${i}-t`} error={errors.projects?.[i]?.title?.message}>
                  <Input id={`pr-${i}-t`} {...register(`projects.${i}.title`)} />
                </Field>
                <Field label="Link (optional)" htmlFor={`pr-${i}-u`}>
                  <Input id={`pr-${i}-u`} type="url" placeholder="https://" {...register(`projects.${i}.url`)} />
                </Field>
                <Button type="button" size="icon" variant="ghost" className="self-end" aria-label="Remove project" onClick={() => projects.remove(i)}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <Field label="What you did and learned" htmlFor={`pr-${i}-d`}>
                <Textarea id={`pr-${i}-d`} rows={2} {...register(`projects.${i}.description`)} />
              </Field>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Volunteer work and activities</CardTitle>
            <CardDescription>Clubs, societies, community service, leadership.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => volunteer.append({ role: "", organisation: "", description: "" })}>
            <Plus aria-hidden /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {volunteer.fields.map((f, i) => (
            <div key={f.id} className="space-y-3 rounded-xl border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Field label="Role" htmlFor={`vo-${i}-r`} error={errors.volunteer?.[i]?.role?.message}>
                  <Input id={`vo-${i}-r`} {...register(`volunteer.${i}.role`)} />
                </Field>
                <Field label="Organisation" htmlFor={`vo-${i}-o`}>
                  <Input id={`vo-${i}-o`} {...register(`volunteer.${i}.organisation`)} />
                </Field>
                <Button type="button" size="icon" variant="ghost" className="self-end" aria-label="Remove entry" onClick={() => volunteer.remove(i)}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <Field label="Description" htmlFor={`vo-${i}-d`}>
                <Textarea id={`vo-${i}-d`} rows={2} {...register(`volunteer.${i}.description`)} />
              </Field>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Certifications</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={() => certifications.append({ name: "", issuer: "", year: "" })}>
            <Plus aria-hidden /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {certifications.fields.map((f, i) => (
            <div key={f.id} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[2fr_2fr_1fr_auto]">
              <Field label="Name" htmlFor={`ce-${i}-n`} error={errors.certifications?.[i]?.name?.message}>
                <Input id={`ce-${i}-n`} {...register(`certifications.${i}.name`)} />
              </Field>
              <Field label="Issuer" htmlFor={`ce-${i}-i`}>
                <Input id={`ce-${i}-i`} {...register(`certifications.${i}.issuer`)} />
              </Field>
              <Field label="Year" htmlFor={`ce-${i}-y`}>
                <Input id={`ce-${i}-y`} inputMode="numeric" maxLength={4} {...register(`certifications.${i}.year`)} />
              </Field>
              <Button type="button" size="icon" variant="ghost" className="self-end" aria-label="Remove certification" onClick={() => certifications.remove(i)}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </form>
  );

  const preview = (
    <div className="flex h-[70dvh] min-h-96 flex-col overflow-hidden rounded-xl border border-border bg-surface lg:sticky lg:top-20 lg:h-[calc(100dvh-8rem)]">
      <PdfCanvas bytes={bytes} error={previewError} />
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {saveState === "saving" ? "Saving draft…" : saveState === "saved" ? "Draft saved" : "Changes are saved automatically"}
        </p>
        <Button type="button" variant="cta" size="lg" loading={exporting} onClick={() => void exportPdf()}>
          <FileDown aria-hidden /> Save as PDF
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:hidden" role="tablist" aria-label="Editor or preview">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            type="button"
            onClick={() => setTab(t)}
            className={cn("flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold", tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface")}
          >
            {t === "edit" ? <Pencil className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />} {t === "edit" ? "Edit" : "Live preview"}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cn(tab === "preview" && "hidden lg:block")}>{editor}</div>
        <div className={cn(tab === "edit" && "hidden lg:block")}>{preview}</div>
      </div>

      <section className="mt-8" aria-labelledby="my-cvs">
        <h2 id="my-cvs" className="font-heading text-lg font-semibold">
          My generated CVs
        </h2>
        {library.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing saved yet. Tap “Save as PDF” to store your CV privately in your account.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
            {library.map((c) => (
              <li key={c.path} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name.replace(/^cv_builder-/, "").slice(0, 8)}… · {c.createdAt ? formatDate(c.createdAt) : "CV"}</p>
                  {c.isMain ? <p className="text-xs font-semibold text-success-soft-foreground">Main CV</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setViewer({ bucket: "cvs", path: c.path, title: "Generated CV" })}>
                    View
                  </Button>
                  {!c.isMain ? (
                    <>
                      <Button size="sm" variant="secondary" loading={settingMain} onClick={() => setMain(c.path)}>
                        Set as main CV
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete this CV"
                        onClick={async () => {
                          const r = await deleteBuiltCvAction(c.path);
                          if (r.ok) {
                            toast.success("Deleted");
                            await refreshLibrary();
                          } else toast.error(r.error ?? "Could not delete");
                        }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={justBuilt !== null} onClose={() => setJustBuilt(null)} title="Your CV is saved" description="Do you want to use it as the CV that employers see when you apply?">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setJustBuilt(null)}>
            Not now
          </Button>
          <Button variant="cta" loading={settingMain} onClick={() => justBuilt && setMain(justBuilt)}>
            Set as my main CV
          </Button>
        </div>
      </Dialog>
      <PdfViewerDialog target={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
