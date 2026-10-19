"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Building2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";
import { ROLE_HOME } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Choice = "attachee" | "graduate_trainee" | "employer";
const CHOICES: { value: Choice; title: string; text: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "attachee", title: "I am a student looking for attachment", text: "Industrial attachment or internship while studying.", icon: GraduationCap },
  { value: "graduate_trainee", title: "I am a graduate", text: "Graduate trainee programmes, internships and entry-level jobs.", icon: BriefcaseBusiness },
  { value: "employer", title: "I represent an employer", text: "Post opportunities and find talent.", icon: Building2 },
];

/** First sign-in with Google: pick what you are, once. */
export function WelcomeForm({ name }: { name: string }) {
  const router = useRouter();
  const [choice, setChoice] = React.useState<Choice>("attachee");
  const [company, setCompany] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const role = choice === "employer" ? "employer" : "candidate";
    const { error: e } = await supabase.rpc("complete_onboarding", { p_role: role, p_candidate_type: choice === "employer" ? "attachee" : choice, p_company_name: choice === "employer" ? company : null });
    if (e) {
      setPending(false);
      return setError(e.message.replace(/^.*?:\s*/, ""));
    }
    await supabase.auth.refreshSession(); // picks up the new role in the session token
    router.replace(ROLE_HOME[role]);
    router.refresh();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div>
        <h1 className="font-heading text-2xl font-semibold">Welcome{name ? `, ${name.split(" ")[0]}` : ""}!</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tell us who you are so we can set up Mukana for you. You can do this once.</p>
      </div>
      <div role="radiogroup" aria-label="I am" className="space-y-2">
        {CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={choice === c.value}
            onClick={() => setChoice(c.value)}
            className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left", choice === c.value ? "border-primary bg-info-soft" : "border-border hover:bg-surface-muted")}
          >
            <c.icon className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="block text-sm font-semibold">{c.title}</span>
              <span className="block text-xs text-muted-foreground">{c.text}</span>
            </span>
          </button>
        ))}
      </div>
      {choice === "employer" ? (
        <Field label="Company name" htmlFor="welcome-company" required>
          <Input id="welcome-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={160} />
        </Field>
      ) : null}
      {error ? <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-soft-foreground">{error}</p> : null}
      <Button type="submit" variant="cta" size="lg" className="w-full" loading={pending} disabled={choice === "employer" && company.trim().length < 2}>
        Continue
      </Button>
    </form>
  );
}
