import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { signAvatarUrl } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import { FeedList } from "@/features/feed/feed-list";
import { GroupHeader } from "@/features/groups/group-header";
import type { GroupRow } from "@/features/groups/group-list";

export const metadata: Metadata = { title: "Group" };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const supabase = await createClient();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await supabase.rpc("get_group", { p_id: id }) : { data: null };
  const group = ((data ?? []) as GroupRow[])[0];
  const avatarUrl = await signAvatarUrl(session.avatar_path);
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/groups" className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Groups
        </Link>
        {!group ? (
          <EmptyState title="Group not found" description="It may have been deleted." action={<Button asChild variant="outline"><Link href="/groups">See groups</Link></Button>} />
        ) : (
          <>
            <GroupHeader group={group} />
            {group.is_member || session.role === "admin" ? (
              <FeedList key={group.id} userId={session.id} role={session.role} name={session.full_name || session.email} avatarUrl={avatarUrl} groupId={group.id} showComposer={group.is_member} emptyText="No posts in this group yet. Say hello!" />
            ) : (
              <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">Join this group to read and write posts.</p>
            )}
          </>
        )}
      </div>
    </AdaptiveLayout>
  );
}
