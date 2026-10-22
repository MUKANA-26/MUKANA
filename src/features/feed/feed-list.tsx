"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Hash, Newspaper, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useT } from "@/components/prefs-provider";
import { Composer } from "./composer";
import { PostCard } from "./post-card";
import { FeedSuggestions } from "./suggestions";
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
  const t = useT();
  const [mode, setMode] = React.useState<FeedMode>("for_you");
  // A new random seed on every page load and refresh: the "For you" order changes each time.
  const [seed, setSeed] = React.useState(() => Math.floor(Math.random() * 1_000_000));
  const lastRefresh = React.useRef(Date.now());
  const refreshFeed = React.useCallback(() => {
    lastRefresh.current = Date.now();
    setSeed(Math.floor(Math.random() * 1_000_000));
  }, []);
  const [term, setTerm] = React.useState("");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setSearch(term.trim()), 350);
    return () => clearTimeout(t);
  }, [term]);

  const searching = search.length >= 2;
  const query = useInfiniteQuery({
    queryKey: ["feed", "posts", { authorId: authorId ?? null, postId: postId ?? null, groupId: groupId ?? null, mode, tag: tag ?? null, search: searching ? search : null, seed }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPosts(supabase, userId, { page: pageParam, mode, tag, search: searching ? search : null, authorId, postId, groupId, seed }),
    getNextPageParam: (last) => last.next,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  // Coming back to the app after a few minutes gives a fresh mix.
  React.useEffect(() => {
    if (!showTabs) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > 5 * 60_000) refreshFeed();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [showTabs, refreshFeed]);

  // Remember which posts were shown so the next refresh leads with new ones.
  const recorded = React.useRef<Set<string>>(new Set());
  React.useEffect(() => {
    if (!showTabs || mode !== "for_you" || tag || searching) return;
    const ids = (query.data?.pages.flatMap((p) => p.posts) ?? []).map((p) => p.id).filter((id) => !recorded.current.has(id));
    if (!ids.length || query.isPlaceholderData) return;
    const timer = setTimeout(() => {
      ids.forEach((id) => recorded.current.add(id));
      void supabase.rpc("record_impressions", { p_posts: ids });
    }, 2000);
    return () => clearTimeout(timer);
  }, [query.data, query.isPlaceholderData, showTabs, mode, tag, searching, supabase]);

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
    <div className="overflow-hidden sm:border-x sm:border-border">
      {showComposer && !tag ? <Composer userId={userId} name={name} avatarUrl={avatarUrl} groupId={groupId} /> : null}

      {showTabs ? (
        <div>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(term.trim());
            }}
            className="relative border-b border-border px-4 py-2.5"
          >
            <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t("Search posts")}
              aria-label={t("Search posts")}
              className="h-10 w-full rounded-full border-0 bg-surface-muted pl-10 pr-9 text-sm focus-visible:outline-2"
            />
            {term ? (
              <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-6 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-surface">
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </form>

          {tag ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
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
            <div className="flex overflow-x-auto border-b border-border" role="tablist" aria-label="Feed view">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={cn("relative h-12 flex-1 whitespace-nowrap px-3 text-[15px] transition-colors hover:bg-surface-muted/60", mode === m.id ? "font-bold text-foreground after:absolute after:bottom-0 after:left-1/2 after:h-1 after:w-12 after:-translate-x-1/2 after:rounded-full after:bg-link" : "font-medium text-muted-foreground")}
                >
                  {t(m.label)}
                </button>
              ))}
            </div>
          ) : null}

          {!tag && !searching && trending.data?.length ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2.5" aria-label="Trending topics">
              <span className="text-xs font-medium text-muted-foreground">Trending</span>
              {trending.data.map((t) => (
                <Link key={t.tag} href={`/feed?tag=${encodeURIComponent(t.tag)}`} className="text-sm font-medium text-link hover:underline">
                  #{t.tag}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showTabs && mode === "for_you" && !tag && !searching ? <FeedSuggestions role={role} /> : null}

      {query.isLoading ? (
        <div className="px-4 py-3">
          <SkeletonList count={3} />
        </div>
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
            <div className="flex justify-end border-b border-border px-2 py-0.5">
              <Button variant="ghost" size="sm" onClick={refreshFeed} loading={query.isFetching && !query.isFetchingNextPage}>
                <RefreshCw aria-hidden /> {t("Refresh")}
              </Button>
            </div>
          ) : null}
          <ul className="divide-y divide-border border-b border-border">
            {posts.map((p) => (
              <li key={p.id}>
                <PostCard post={p} userId={userId} role={role} myName={name} myAvatar={avatarUrl} openComments={Boolean(postId)} />
              </li>
            ))}
          </ul>
          {query.hasNextPage ? (
            <div className="flex justify-center py-4">
              <Button variant="ghost" loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                {t("Load more")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
