"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  member_count: number | string;
  is_member: boolean;
  is_owner: boolean;
}
const clean = (m: string) => m.replace(/^.*?:\s*/, "");

/** Join, leave and delete buttons for one group. */
export function GroupActions({ group, afterDelete }: { group: GroupRow; afterDelete?: () => void }) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string, then?: () => void) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return void toast.error(clean(error.message));
    toast.success(ok);
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    router.refresh();
    then?.();
  };
  return (
    <div className="flex items-center gap-2">
      {group.is_owner ? (
        <Button size="sm" variant="ghost" className="text-danger" loading={busy} onClick={() => window.confirm("Delete this group and all its posts?") && void run(() => supabase.rpc("delete_group", { p_group: group.id }), "Group deleted", afterDelete)}>
          Delete group
        </Button>
      ) : group.is_member ? (
        <Button size="sm" variant="outline" loading={busy} onClick={() => void run(() => supabase.rpc("join_group", { p_group: group.id, p_join: false }), "You left the group")}>
          Leave
        </Button>
      ) : (
        <Button size="sm" variant="cta" loading={busy} onClick={() => void run(() => supabase.rpc("join_group", { p_group: group.id, p_join: true }), "Welcome to the group")}>
          Join
        </Button>
      )}
    </div>
  );
}

export function GroupBrowser() {
  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mine, setMine] = React.useState(false);
  const [term, setTerm] = React.useState("");
  const [q, setQ] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setQ(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const groups = useQuery({
    queryKey: ["groups", mine, q],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_groups", { p_q: q || null, p_mine: mine });
      if (error) throw error;
      return (data ?? []) as GroupRow[];
    },
    staleTime: 15_000,
  });

  const create = async () => {
    setPending(true);
    const { data, error } = await supabase.rpc("create_group", { p_name: name, p_description: desc || null });
    setPending(false);
    if (error) return void toast.error(clean(error.message));
    setCreating(false);
    setName("");
    setDesc("");
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    router.push(`/groups/${data as string}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search groups" aria-label="Search groups" className="h-11 w-full rounded-xl border border-input bg-surface pl-9 pr-3 text-sm" />
        </div>
        <Button variant="cta" size="sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden /> New group
        </Button>
      </div>
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Groups">
        {[
          { v: false, l: "Discover" },
          { v: true, l: "My groups" },
        ].map((t) => (
          <button key={t.l} type="button" role="tab" aria-selected={mine === t.v} onClick={() => setMine(t.v)} className={cn("h-9 flex-1 rounded-lg px-3 text-sm font-medium", mine === t.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted")}>
            {t.l}
          </button>
        ))}
      </div>
      {groups.isLoading ? (
        <SkeletonList count={3} />
      ) : (groups.data ?? []).length === 0 ? (
        <EmptyState icon={<Users aria-hidden />} title={mine ? "You have not joined any groups" : "No groups yet"} description="Groups bring people together around a school, a skill or an industry. Start the first one!" />
      ) : (
        <ul className="space-y-3">
          {(groups.data ?? []).map((g) => (
            <li key={g.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/groups/${g.id}`} className="font-heading text-base font-semibold hover:underline">
                    {g.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{Number(g.member_count)} member{Number(g.member_count) === 1 ? "" : "s"}</p>
                  {g.description ? <p className="mt-1 line-clamp-2 text-sm">{g.description}</p> : null}
                </div>
                <GroupActions group={g} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={creating} onClose={() => setCreating(false)} title="Start a group" description="Anyone on Mukana can find and join it.">
        <div className="space-y-3">
          <Field label="Group name" htmlFor="grp-name" required>
            <Input id="grp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. UZ Computer Science 2026" />
          </Field>
          <Field label="What is it about?" htmlFor="grp-desc">
            <Textarea id="grp-desc" rows={3} maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="cta" loading={pending} disabled={name.trim().length < 3} onClick={() => void create()}>
              Create group
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
