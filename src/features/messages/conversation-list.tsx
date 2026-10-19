"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { useAvatarUrls } from "@/lib/avatars-client";
import { createClient } from "@/lib/supabase/client";
import { cn, timeAgo } from "@/lib/utils";

export interface ConversationRow {
  id: string;
  is_group: boolean;
  title: string | null;
  other_id: string | null;
  other_name: string | null;
  other_avatar: string | null;
  other_headline: string | null;
  member_count: number;
  last_body: string | null;
  last_at: string;
  unread: boolean;
}

export function useConversations() {
  const supabase = React.useMemo(() => createClient(), []);
  return useQuery({
    queryKey: ["messages", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_conversations");
      if (error) throw error;
      return (data ?? []) as ConversationRow[];
    },
    staleTime: 10_000,
  });
}

function NewGroup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [chosen, setChosen] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState(false);
  const { data: people = [] } = useQuery({
    queryKey: ["network", "connections", "accepted"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.rpc("list_connections", { p_kind: "accepted" });
      return (data ?? []) as { user_id: string; full_name: string; headline: string | null }[];
    },
  });
  const toggle = (id: string) =>
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < 19) n.add(id);
      return n;
    });
  const create = async () => {
    setPending(true);
    const { data, error } = await supabase.rpc("create_group_chat", { p_title: title, p_members: [...chosen] });
    setPending(false);
    if (error) return void toast.error(error.message.replace(/^.*?:\s*/, ""));
    onClose();
    router.push(`/messages/${data as string}`);
  };
  return (
    <Dialog open={open} onClose={onClose} title="New group chat" description="Add up to 19 people you are connected with.">
      <div className="space-y-3">
        <Input aria-label="Group name" placeholder="Group name" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
        {people.length === 0 ? (
          <p className="rounded-lg bg-surface-muted p-3 text-sm text-muted-foreground">You need connections first. Find people in My network.</p>
        ) : (
          <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {people.map((p) => (
              <li key={p.user_id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-muted">
                  <input type="checkbox" className="size-4" checked={chosen.has(p.user_id)} onChange={() => toggle(p.user_id)} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.full_name}</span>
                    {p.headline ? <span className="block truncate text-xs text-muted-foreground">{p.headline}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="cta" loading={pending} disabled={!title.trim() || chosen.size === 0} onClick={() => void create()}>
            Create ({chosen.size})
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function ConversationList() {
  const query = useConversations();
  const [groupOpen, setGroupOpen] = React.useState(false);
  const rows = query.data ?? [];
  const avatars = useAvatarUrls(rows.map((r) => r.other_avatar));
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setGroupOpen(true)}>
          <Users aria-hidden /> New group chat
        </Button>
      </div>
      {query.isLoading ? (
        <SkeletonList count={4} />
      ) : query.isError ? (
        <EmptyState title="Couldn't load your messages" description="Check your connection and try again." action={<Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<MessageCircle aria-hidden />} title="No conversations yet" description="Open someone's profile and tap Message, or start from My network." action={<Button asChild variant="outline"><Link href="/network">My network</Link></Button>} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((c) => {
            const name = c.is_group ? (c.title ?? "Group chat") : (c.other_name ?? "Member");
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-surface-muted sm:p-4">
                  {c.is_group ? (
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-info-soft text-info-soft-foreground">
                      <Users className="size-5" aria-hidden />
                    </span>
                  ) : (
                    <Avatar url={c.other_avatar ? (avatars[c.other_avatar] ?? null) : null} name={name} size="md" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", c.unread ? "font-bold" : "font-semibold")}>{name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.last_at)}</span>
                    </p>
                    <p className={cn("truncate text-sm", c.unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                      {c.last_body ?? (c.is_group ? `${c.member_count} people` : (c.other_headline ?? "Say hello"))}
                    </p>
                  </div>
                  {c.unread ? <span className="size-2.5 shrink-0 rounded-full bg-cta" aria-label="Unread" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <NewGroup open={groupOpen} onClose={() => setGroupOpen(false)} />
    </div>
  );
}
