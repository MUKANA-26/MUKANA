"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { resetTemplateAction, saveTemplateAction } from "@/features/applications/actions";
import { DEFAULT_TEMPLATES, PLACEHOLDERS, TEMPLATE_LABEL, type MessageTemplate, type TemplateKind } from "@/features/applications/templates";

function TemplateCard({ template, customised }: { template: MessageTemplate; customised: boolean }) {
  const router = useRouter();
  const [subject, setSubject] = React.useState(template.subject);
  const [body, setBody] = React.useState(template.body);
  const [pending, startTransition] = React.useTransition();
  const dirty = subject !== template.subject || body !== template.body;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TEMPLATE_LABEL[template.kind]}</CardTitle>
        <CardDescription>{customised ? "Customised" : "Default template"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="Subject" htmlFor={`${template.kind}-subject`}>
          <Input id={`${template.kind}-subject`} value={subject} maxLength={160} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Message" htmlFor={`${template.kind}-body`}>
          <Textarea id={`${template.kind}-body`} rows={8} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="cta"
            disabled={!dirty}
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await saveTemplateAction({ kind: template.kind, subject, body });
                if (r.ok) {
                  toast.success(r.message ?? "Saved");
                  router.refresh();
                } else toast.error(r.error ?? "Could not save");
              })
            }
          >
            Save template
          </Button>
          {customised ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await resetTemplateAction(template.kind);
                  if (r.ok) {
                    setSubject(DEFAULT_TEMPLATES[template.kind].subject);
                    setBody(DEFAULT_TEMPLATES[template.kind].body);
                    toast.success(r.message ?? "Reset");
                    router.refresh();
                  }
                })
              }
            >
              Reset to default
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function TemplateEditor({ templates, customised }: { templates: Record<TemplateKind, MessageTemplate>; customised: TemplateKind[] }) {
  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-info-soft p-3 text-sm text-info-soft-foreground">
        You can use these placeholders: {PLACEHOLDERS.map((p) => `${p.token} (${p.label.toLowerCase()})`).join(", ")}. They are filled in for each candidate, and you can still edit every message before sending.
      </p>
      {(Object.keys(TEMPLATE_LABEL) as TemplateKind[]).map((k) => (
        <TemplateCard key={`${k}-${templates[k].subject}-${templates[k].body.length}`} template={templates[k]} customised={customised.includes(k)} />
      ))}
    </div>
  );
}
