import type { Metadata } from "next";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { requireUser } from "@/lib/auth";
import { signAvatarUrl } from "@/lib/avatars";
import { FeedList } from "@/features/feed/feed-list";

export const metadata: Metadata = { title: "Feed" };

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const session = await requireUser();
  const avatarUrl = await signAvatarUrl(session.avatar_path);
  const cleanTag = tag && /^[a-zA-Z0-9_]{2,40}$/.test(tag) ? tag.toLowerCase() : undefined;
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <h1 className="sr-only">Feed</h1>
        <FeedList key={cleanTag ?? "all"} userId={session.id} role={session.role} name={session.full_name || session.email} avatarUrl={avatarUrl} tag={cleanTag} showComposer showTabs />
      </div>
    </AdaptiveLayout>
  );
}
