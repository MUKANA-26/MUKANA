"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, LogOut, SendHorizontal, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/ui/misc";
import { useAvatarUrls } from "@/lib/avatars-client";
import { createClient } from "@/lib/supabase/client";
import { cn, timeAgo } from "@/lib/utils";
import { UNREAD_MESSAGES_KEY } from "./message-bell";

interface Message {
  id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
}
interface Member {
  id: string;
  full_name: string;
  avatar_path: string | null;
}

/** One conversation: history, live updates through Realtime, and a composer. */
export function Chat({
  conversationId,
  userId,
  title,
  isGroup,
  otherId,
  otherAvatarPath,
}: {
  conversationId: string;
  userId: string;
  title: string;
  isGroup: boolean;
  otherId: string | null;
  otherAvatarPath: string | null;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  const key = React.useMemo(() => ["messages", "thread", conversationId] as const, [conversationId]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("id, sender_id, body, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return ((data ?? []) as Message[]).reverse();
    },
    staleTime: 5_000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["messages", "members", conversationId],
    enabled: isGroup,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: m } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", conversationId);
      const ids = (m ?? []).map((x: { user_id: string }) => x.user_id);
      if (!ids.length) return [] as Member[];
      const { data } = await supabase.from("feed_people").select("id, full_name, avatar_path").in("id", ids);
      return (data ?? []) as Member[];
    },
  });
  const names = React.useMemo(() => new Map(members.map((m) => [m.id, m.full_name])), [members]);
  const avatars = useAvatarUrls([otherAvatarPath]);

  const markRead = React.useCallback(async () => {
    await supabase.rpc("mark_conversation_read", { p_conv: conversationId });
    void queryClient.invalidateQueries({ queryKey: [...UNREAD_MESSAGES_KEY, userId] });
    void queryClient.invalidateQueries({ queryKey: ["messages", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [supabase, conversationId, queryClient, userId]);

  React.useEffect(() => {
    void markRead();
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload: { new: unknown }) => {
        const m = payload.new as Message;
        queryClient.setQueryData<Message[]>(key, (old) => (old?.some((x) => x.id === m.id) ? old : [...(old ?? []), m]));
        if (m.sender_id !== userId) void markRead();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, queryClient, key, userId, markRead]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase.rpc("send_message", { p_conv: conversationId, p_body: body });
    setSending(false);
    if (error) return void toast.error(error.message.replace(/^.*?:\s*/, ""));
    setText("");
    queryClient.setQueryData<Message[]>(key, (old) => (old?.some((x) => x.id === data) ? old : [...(old ?? []), { id: data as string, sender_id: userId, body, created_at: new Date().toISOString() }]));
    void queryClient.invalidateQueries({ queryKey: ["messages", "list"] });
  };

  const leave = async () => {
    if (!window.confirm("Leave this group chat?")) return;
    const { error } = await supabase.rpc("leave_conversation", { p_conv: conversationId });
    if (error) return void toast.error(error.message);
    void queryClient.invalidateQueries({ queryKey: ["messages"] });
    router.push("/messages");
  };

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-96 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm md:h-[calc(100dvh-9rem)]">
      <header className="flex items-center gap-3 border-b border-border p-3">
        <Link href="/messages" aria-label="Back to messages" className="grid size-9 place-items-center rounded-full hover:bg-surface-muted">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        {isGroup ? (
          <span className="grid size-10 place-items-center rounded-full bg-info-soft text-info-soft-foreground">
            <Users className="size-5" aria-hidden />
          </span>
        ) : (
          <Avatar url={otherAvatarPath ? (avatars[otherAvatarPath] ?? null) : null} name={title} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          {otherId ? (
            <Link href={`/people/${otherId}`} className="block truncate text-sm font-semibold hover:underline">{title}</Link>
          ) : (
            <p className="truncate text-sm font-semibold">{title}</p>
          )}
          {isGroup ? <p className="text-xs text-muted-foreground">{members.length ? `${members.length} people` : "Group chat"}</p> : null}
        </div>
        {isGroup ? (
          <Button variant="ghost" size="sm" onClick={() => void leave()}>
            <LogOut aria-hidden /> Leave
          </Button>
        ) : null}
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
        {isLoading ? (
          <SkeletonList count={3} />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-surface-muted")}>
                  {isGroup && !mine ? <p className="mb-0.5 text-xs font-semibold opacity-80">{names.get(m.sender_id ?? "") ?? "Member"}</p> : null}
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                  <p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{timeAgo(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Write a message"
          aria-label="Message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-input bg-surface-muted px-3 py-2.5 text-sm"
        />
        <Button type="submit" variant="cta" size="icon" loading={sending} disabled={!text.trim()} aria-label="Send message">
          <SendHorizontal aria-hidden />
        </Button>
      </form>
    </div>
  );
}
