"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Hash, Newspaper, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { PostCard } from "./post-card";
import { fetchPosts, fetchTrending, type FeedMode } from "./queries";

const MODES: { id: FeedMode; label: string }[] = [
  { id: "for_you", label: "For you" },
  { id: "latest", label: "Latest" },
  { id: "following", label: "Following" },
  { id: "saved", label: "Saved" },
];

/** The feed (with tabs, search and topics), one member's posts (authorId) or a single post (postId). */
export function FeedList({
  userId,
  role,
  name,
  avatarUrl,
  authorId,
  postId,
  groupId,
  tag,
  showComposer = false,
  showTabs = false,
  emptyText = "No posts yet. Be the first to share something!",
}: {
  userId: string;
  role: "candidate" | "employer" | "admin";
  name: string;
  avatarUrl: string | null;
  authorId?: string;
  postId?: string;
  groupId?: string;
  tag?: string;
  showComposer?: boolean;
  showTabs?: boolean;
  emptyText?: string;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();
  const [mode, setMode] = React.useState<FeedMode>("for_you");
  const [term, setTerm] = React.useState("");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setSearch(term.trim()), 350);
    return () => clearTimeout(t);
  }, [term]);

  const searching = search.length >= 2;
  const query = useInfiniteQuery({
    queryKey: ["feed", "posts", { authorId: authorId ?? null, postId: postId ?? null, groupId: groupId ?? null, mode, tag: tag ?? null, search: searching ? search : null }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPosts(supabase, userId, { page: pageParam, mode, tag, search: searching ? search : null, authorId, postId, groupId }),
    getNextPageParam: (last) => last.next,
    staleTime: 20_000,
  });

  const trending = useQuery({ queryKey: ["feed", "trending"], queryFn: () => fetchTrending(supabase), enabled: showTabs, staleTime: 120_000 });
  const following = useQuery({
    queryKey: ["feed", "tag-follow", tag],
    enabled: Boolean(tag),
    queryFn: async () => {
      const { data } = await supabase.from("hashtag_follows").select("tag").eq("user_id", userId).eq("tag", tag!);
      return Boolean(data?.length);
    },
  });

  const toggleTag = async () => {
    if (!tag) return;
    const next = !following.data;
    const { error } = next ? await supabase.from("hashtag_follows").insert({ user_id: userId, tag }) : await supabase.from("hashtag_follows").delete().eq("user_id", userId).eq("tag", tag);
    if (error && error.code !== "23505") return void toast.error("Couldn't update that topic");
    toast.success(next ? `Following #${tag}. Those posts are boosted in your feed.` : `Unfollowed #${tag}`);
    void following.refetch();
  };

  const posts = query.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className="space-y-4">
      {showComposer && !tag ? <Composer userId={userId} name={name} avatarUrl={avatarUrl} groupId={groupId} /> : null}

      {showTabs ? (
        <div className="space-y-3">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(term.trim());
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search posts"
              aria-label="Search posts"
              className="h-11 w-full rounded-xl border border-input bg-surface pl-9 pr-9 text-sm"
            />
            {term ? (
              <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-surface-muted">
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </form>

          {tag ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Hash className="size-4 text-link" aria-hidden />
                {tag}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant={following.data ? "outline" : "cta"} onClick={() => void toggleTag()}>
                  {following.data ? "Following" : "Follow topic"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => router.push("/feed")}>
                  All posts
                </Button>
              </div>
            </div>
          ) : !searching ? (
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Feed view">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={cn("h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium", mode === m.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted")}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : null}

          {!tag && !searching && trending.data?.length ? (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Trending topics">
              <span className="text-xs font-medium text-muted-foreground">Trending</span>
              {trending.data.map((t) => (
                <Link key={t.tag} href={`/feed?tag=${encodeURIComponent(t.tag)}`} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-link hover:bg-surface-muted">
                  #{t.tag}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {query.isLoading ? (
        <SkeletonList count={3} />
      ) : query.isError ? (
        <EmptyState title="Couldn't load the feed" description="Check your connection and try again." action={<Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Newspaper aria-hidden />}
          title={postId ? "This post isn't available" : searching ? "No posts match your search" : mode === "saved" && showTabs ? "Nothing saved yet" : mode === "following" && showTabs ? "Nobody to follow yet" : "Nothing here yet"}
          description={
            postId
              ? "It may have been deleted or removed."
              : searching
                ? "Try different words, or search a #topic."
                : mode === "saved" && showTabs
                  ? "Tap the bookmark on a post to keep it here."
                  : mode === "following" && showTabs
                    ? "Follow people or connect with them and their posts will show here."
                    : emptyText
          }
        />
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
