"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export const UNREAD_MESSAGES_KEY = ["messages", "unread"] as const;

/** Header icon with the number of conversations that have unread messages, kept live through Realtime. */
export function MessageBell({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { data: unread = 0 } = useQuery({
    queryKey: [...UNREAD_MESSAGES_KEY, userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("unread_message_count");
      if (error) throw error;
      return Number(data ?? 0);
    },
    staleTime: 60_000,
    retry: false,
  });

  React.useEffect(() => {
    const channel = supabase
      .channel(`messages-bell:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: [...UNREAD_MESSAGES_KEY, userId] });
        void queryClient.invalidateQueries({ queryKey: ["messages", "list"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, queryClient]);

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href="/messages" aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}>
        <MessageCircle aria-hidden />
        {unread > 0 ? (
          <span aria-hidden className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-cta px-1 text-[11px] font-bold leading-5 text-cta-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
