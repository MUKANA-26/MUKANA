"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const clean = (m: string) => m.replace(/^.*?:\s*/, "");

/** Connection, follow, block and chat-start actions. Each one calls a database function that enforces the rules. */
export function useNetworkActions(onChange?: () => void) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  const run = async (key: string, fn: () => PromiseLike<{ error: { message: string } | null }>, success?: string) => {
    setBusy(key);
    try {
      const { error } = await fn();
      if (error) {
        toast.error(clean(error.message));
        return false;
      }
      if (success) toast.success(success);
      void queryClient.invalidateQueries({ queryKey: ["network"] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      onChange?.();
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  };

  return {
    busy,
    connect: (id: string) => run(`connect:${id}`, () => supabase.rpc("connect_request", { p_user: id }), "Invitation sent"),
    respond: (connectionId: string, accept: boolean) => run(`respond:${connectionId}`, () => supabase.rpc("connection_respond", { p_id: connectionId, p_accept: accept }), accept ? "You're now connected" : "Invitation declined"),
    remove: (userId: string, message = "Connection removed") => run(`remove:${userId}`, () => supabase.rpc("connection_remove", { p_user: userId }), message),
    follow: async (me: string, id: string, on: boolean) =>
      run(`follow:${id}`, () => (on ? supabase.from("follows").insert({ follower_id: me, followee_id: id }) : supabase.from("follows").delete().eq("follower_id", me).eq("followee_id", id)), on ? "Following" : "Unfollowed"),
    block: async (me: string, id: string, on: boolean) =>
      run(`block:${id}`, () => (on ? supabase.from("blocks").insert({ blocker_id: me, blocked_id: id }) : supabase.from("blocks").delete().eq("blocker_id", me).eq("blocked_id", id)), on ? "Member blocked" : "Member unblocked"),
    message: async (id: string) => {
      setBusy(`message:${id}`);
      try {
        const { data, error } = await supabase.rpc("start_direct_conversation", { p_user: id });
        if (error) return void toast.error(clean(error.message));
        router.push(`/messages/${data as string}`);
      } finally {
        setBusy(null);
      }
    },
  };
}
