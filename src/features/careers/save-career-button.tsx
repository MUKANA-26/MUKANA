"use client";

import * as React from "react";
import { toast } from "sonner";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Keep a career on your list. */
export function SaveCareerButton({ careerId, userId, initiallySaved }: { careerId: string; userId: string; initiallySaved: boolean }) {
  const [saved, setSaved] = React.useState(initiallySaved);
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant={saved ? "secondary" : "outline"}
      size="sm"
      aria-pressed={saved}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const supabase = createClient();
        const { error } = saved
          ? await supabase.from("saved_careers").delete().eq("user_id", userId).eq("career_id", careerId)
          : await supabase.from("saved_careers").upsert({ user_id: userId, career_id: careerId }, { onConflict: "user_id,career_id" });
        setBusy(false);
        if (error) return void toast.error("Could not update your list");
        setSaved(!saved);
        toast.success(saved ? "Removed from your careers" : "Saved to your careers");
      }}
    >
      <Bookmark className={cn(saved && "fill-current")} aria-hidden /> {saved ? "Saved" : "Save career"}
    </Button>
  );
}
