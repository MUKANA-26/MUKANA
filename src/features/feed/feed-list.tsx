"use client";

import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Newspaper, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { Composer } from "./composer";
import { PostCard } from "./post-card";
import { fetchPosts } from "./queries";

/** The feed (everyone), one member's posts (authorId) or a single post (postId). */
export function FeedList({
  userId,
  role,
  name,
  avatarUrl,
  authorId,
  postId,
  showComposer = false,
  emptyText = "No posts yet. Be the first to share something!",
}: {
  userId: string;
  role: "candidate" | "employer" | "admin";
  name: string;
  avatarUrl: string | null;
  authorId?: string;
  postId?: string;
  showComposer?: boolean;
  emptyText?: string;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const query = useInfiniteQuery({
    queryKey: ["feed", "posts", { authorId: authorId ?? null, postId: postId ?? null }],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchPosts(supabase, userId, { cursor: pageParam, authorId, postId }),
    getNextPageParam: (last) => last.next,
    staleTime: 20_000,
  });

  const posts = query.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className="space-y-4">
      {showComposer ? <Composer userId={userId} name={name} avatarUrl={avatarUrl} /> : null}
      {query.isLoading ? (
        <SkeletonList count={3} />
      ) : query.isError ? (
        <EmptyState title="Couldn't load the feed" description="Check your connection and try again." action={<Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>} />
      ) : posts.length === 0 ? (
        <EmptyState icon={<Newspaper aria-hidden />} title={postId ? "This post isn't available" : "Nothing here yet"} description={postId ? "It may have been deleted or removed." : emptyText} />
      ) : (
        <>
          {!postId ? (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => void query.refetch()} loading={query.isRefetching}>
                <RefreshCw aria-hidden /> Refresh
              </Button>
            </div>
          ) : null}
          <ul className="space-y-4">
            {posts.map((p) => (
              <li key={p.id}>
                <PostCard post={p} userId={userId} role={role} myName={name} myAvatar={avatarUrl} openComments={Boolean(postId)} />
              </li>
            ))}
          </ul>
          {query.hasNextPage ? (
            <div className="flex justify-center">
              <Button variant="outline" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
