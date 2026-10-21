"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellPlus, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function FollowCompanyButton({ companyId, userId, initiallyFollowing, followers }: { companyId: string; userId: string | null; initiallyFollowing: boolean; followers: number }) {
  const router = useRouter();
  const [following, setFollowing] = React.useState(initiallyFollowing);
  const [count, setCount] = React.useState(followers);
  const [busy, setBusy] = React.useState(false);
  if (!userId) {
    return (
      <Button variant="outline" size="sm" onClick={() => router.push(`/sign-in?next=/companies/${companyId}`)}>
        <BellPlus aria-hidden /> Follow
      </Button>
    );
  }
  return (
    <Button
      variant={following ? "secondary" : "cta"}
      size="sm"
      aria-pressed={following}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const supabase = createClient();
        const { error } = following
          ? await supabase.from("company_follows").delete().eq("user_id", userId).eq("company_id", companyId)
          : await supabase.from("company_follows").upsert({ user_id: userId, company_id: companyId }, { onConflict: "user_id,company_id" });
        setBusy(false);
        if (error) return void toast.error("Could not update that");
        setFollowing(!following);
        setCount((c) => Math.max(0, c + (following ? -1 : 1)));
        toast.success(following ? "Unfollowed" : "You are following this company");
      }}
    >
      {following ? <BellRing aria-hidden /> : <BellPlus aria-hidden />} {following ? "Following" : "Follow"} · {count}
    </Button>
  );
}
