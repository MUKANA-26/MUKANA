"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CalendarClock, CheckCheck, FileCheck2, Gavel, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { cn, timeAgo } from "@/lib/utils";
import type { NotificationRow, NotificationType } from "@/types/db";
import { UNREAD_KEY } from "./notification-bell";

const PAGE = 20;
const ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  application_received: UserRoundCheck,
  application_status: FileCheck2,
  interview_invite: CalendarClock,
  interview_update: CalendarClock,
  interview_reminder: CalendarClock,
  offer: Gavel,
  offer_response: Gavel,
  deadline_reminder: BellRing,
  verification: ShieldCheck,
  report: ShieldCheck,
  system: Sparkles,
};

export function NotificationCenter({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["notifications", "list", userId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, body, url, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE - 1);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: [...UNREAD_KEY, userId] });
    },
  });

  if (query.isLoading) return <SkeletonList count={5} />;
  const items = query.data?.pages.flat() ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  if (items.length === 0) {
    return <EmptyState icon={<Bell aria-hidden />} title="You're all caught up" description="Status changes, interview invitations, offers and deadline reminders will show up here." />;
  }

  return (
    <div className="space-y-3">
      {unread > 0 ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" loading={markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck aria-hidden /> Mark all as read
          </Button>
        </div>
      ) : null}
      <ul className="space-y-2">
        {items.map((n) => {
          const Icon = ICON[n.type] ?? Bell;
          const content = (
            <>
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", n.read_at ? "bg-surface-muted text-muted-foreground" : "bg-info-soft text-info-soft-foreground")}>
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", n.read_at ? "font-medium" : "font-semibold")}>{n.title}</p>
                {n.body ? <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read_at ? <span className="mt-1 size-2.5 shrink-0 rounded-full bg-cta" aria-label="Unread" /> : null}
            </>
          );
          const cls = cn("flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-surface-muted", n.read_at ? "bg-surface" : "bg-surface ring-1 ring-cta/40");
          return (
            <li key={n.id}>
              {n.url ? (
                <Link href={n.url} className={cls} onClick={() => !n.read_at && markRead.mutate(n.id)}>
                  {content}
                </Link>
              ) : (
                <button type="button" className={cls} onClick={() => !n.read_at && markRead.mutate(n.id)}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
