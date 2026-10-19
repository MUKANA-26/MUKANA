"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** Signed URLs (1 hour) for profile photos; storage RLS leaves out photos the viewer may not see (initials are shown instead). */
export function useAvatarUrls(paths: (string | null | undefined)[]): Record<string, string> {
  const unique = React.useMemo(() => [...new Set(paths.filter((p): p is string => Boolean(p)))].sort(), [paths]);
  const { data } = useQuery({
    queryKey: ["avatars", unique.join("|")],
    enabled: unique.length > 0,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data: rows } = await supabase.storage.from("avatars").createSignedUrls(unique, 3600);
      const out: Record<string, string> = {};
      for (const item of rows ?? []) if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl;
      return out;
    },
  });
  return data ?? {};
}
