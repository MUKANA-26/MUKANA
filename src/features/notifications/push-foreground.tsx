"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listenForeground } from "@/lib/firebase/messaging";

/** Shows pushes that arrive while the app is open as in-app toasts (the bell updates via Realtime). */
export function PushForeground() {
  const router = useRouter();
  const queryClient = useQueryClient();
  React.useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    void listenForeground((title, body, url) => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast(title, { description: body, action: url ? { label: "Open", onClick: () => router.push(url) } : undefined });
    }).then((fn) => {
      if (cancelled) fn();
      else off = fn;
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [router, queryClient]);
  return null;
}
