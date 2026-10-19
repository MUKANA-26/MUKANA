"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { LANGS, type Lang } from "@/lib/i18n";
import { usePrefs } from "@/components/prefs-provider";
import { savePreferencesAction } from "./preferences-actions";

/** Language (English, chiShona, isiNdebele) and low-data mode. */
export function PreferencesPanel() {
  const router = useRouter();
  const prefs = usePrefs();
  const [lang, setLang] = React.useState<Lang>(prefs.lang);
  const [lowData, setLowData] = React.useState(prefs.lowData);
  const [pending, startTransition] = React.useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Language and data</CardTitle>
        <CardDescription>Choose your language and save mobile data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Language" htmlFor="pref-lang" hint="Main menus and buttons are available in chiShona and isiNdebele. More screens are being translated.">
          <Select id="pref-lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
          <input type="checkbox" className="mt-1 size-4" checked={lowData} onChange={(e) => setLowData(e.target.checked)} />
          <span>
            <span className="block text-sm font-semibold">Low-data mode</span>
            <span className="block text-sm text-muted-foreground">Photos and videos load only when you tap them, and the opening animation is skipped.</span>
          </span>
        </label>
        <Button
          variant="cta"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await savePreferencesAction({ lang, lowData });
              if (r.ok) {
                toast.success(r.message ?? "Saved");
                router.refresh();
              } else toast.error(r.error ?? "Could not save");
            })
          }
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
