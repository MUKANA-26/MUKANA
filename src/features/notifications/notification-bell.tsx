"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export const UNREAD_KEY = ["notifications", "unread"] as const;

/** Bell with an unread-count badge, kept live through Supabase Realtime. */
export function NotificationBell({ userId, href }: { userId: string; href: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();

  const { data: unread = 0 } = useQuery({
    queryKey: [...UNREAD_KEY, userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  React.useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: [...UNREAD_KEY, userId] });
          void queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, queryClient]);

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href={href} aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
        <Bell aria-hidden />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-cta px-1 text-[11px] font-bold leading-5 text-cta-foreground"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
