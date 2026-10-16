import type { Metadata } from "next";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { requireUser } from "@/lib/auth";
import { signAvatarUrl } from "@/lib/avatars";
import { FeedList } from "@/features/feed/feed-list";

export const metadata: Metadata = { title: "Feed" };

export default async function FeedPage() {
  const session = await requireUser();
  const avatarUrl = await signAvatarUrl(session.avatar_path);
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <h1 className="sr-only">Feed</h1>
        <FeedList userId={session.id} role={session.role} name={session.full_name || session.email} avatarUrl={avatarUrl} showComposer />
      </div>
    </AdaptiveLayout>
  );
}