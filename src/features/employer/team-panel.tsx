"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

export interface TeamMember {
  user_id: string;
  full_name: string;
  email: string | null;
  is_owner: boolean;
}

const clean = (m: string) => m.replace(/^.*?:\s*/, "");

/** The hiring team: the owner adds recruiters (existing employer accounts) who can manage opportunities and applicants. */
export function TeamPanel({ members, me, isOwner }: { members: TeamMember[]; me: string; isOwner: boolean }) {
  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const add = async () => {
    setBusy("add");
    const { error } = await supabase.rpc("add_recruiter", { p_email: email });
    setBusy(null);
    if (error) return void toast.error(clean(error.message));
    toast.success("Recruiter added to your hiring team");
    setEmail("");
    router.refresh();
  };
  const remove = async (userId: string, leaving: boolean) => {
    if (!window.confirm(leaving ? "Leave this hiring team? You will lose access to its opportunities and applicants." : "Remove this recruiter from your team?")) return;
    setBusy(userId);
    const { error } = await supabase.rpc("remove_recruiter", { p_user: userId });
    setBusy(null);
    if (error) return void toast.error(clean(error.message));
    toast.success(leaving ? "You left the team" : "Recruiter removed");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hiring team</CardTitle>
        <CardDescription>Recruiters can post opportunities, review applicants and schedule interviews. Only the owner edits the company profile and verification.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul className="divide-y divide-border rounded-xl border border-border">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {m.full_name || "Recruiter"} {m.is_owner ? <Badge variant="info">Owner</Badge> : <Badge variant="neutral">Recruiter</Badge>}
                  {m.user_id === me ? <span className="text-xs font-normal text-muted-foreground">(you)</span> : null}
                </p>
                {m.email ? <p className="truncate text-xs text-muted-foreground">{m.email}</p> : null}
              </div>
              {!m.is_owner && (isOwner || m.user_id === me) ? (
                <Button size="sm" variant="outline" loading={busy === m.user_id} onClick={() => void remove(m.user_id, m.user_id === me)}>
                  <UserMinus aria-hidden /> {m.user_id === me ? "Leave team" : "Remove"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        {isOwner ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <Field label="Add a recruiter by email" htmlFor="team-email" hint="They need a Mukana employer account first. They must not already manage their own opportunities.">
              <Input id="team-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="recruiter@company.co.zw" />
            </Field>
            <Button type="submit" variant="cta" loading={busy === "add"} disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)}>
              <UserPlus aria-hidden /> Add to team
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
