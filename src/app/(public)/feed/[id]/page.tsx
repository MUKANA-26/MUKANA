import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { requireUser } from "@/lib/auth";
import { signAvatarUrl } from "@/lib/avatars";
import { FeedList } from "@/features/feed/feed-list";

export const metadata: Metadata = { title: "Post" };

export default async function SinglePostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await requireUser();
  const avatarUrl = await signAvatarUrl(session.avatar_path);
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <Link href="/feed" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Back to feed
        </Link>
        <h1 className="sr-only">Post</h1>
        <FeedList userId={session.id} role={session.role} name={session.full_name || session.email} avatarUrl={avatarUrl} postId={id} />
      </div>
    </AdaptiveLayout>
  );
}