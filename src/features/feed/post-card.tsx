"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ellipsis, MessageCircle, Share2, ThumbsUp, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { cn, timeAgo } from "@/lib/utils";
import { ReasonButton } from "@/features/admin/reason-dialog";
import { moderatePostAction } from "@/features/admin/actions";
import { ReportButton } from "@/features/opportunities/opportunity-buttons";
import { deletePostAction } from "./actions";
import { Comments } from "./comments";
import { PostBody } from "./post-body";
import { mediaUrl } from "./queries";
import type { FeedMedia, FeedPerson, FeedPost } from "./types";

type Page = { posts: FeedPost[]; next: string | null };

export function PersonLine({ person, time }: { person: FeedPerson | null; time: string }) {
  if (!person) return <p className="text-sm font-semibold">Member</p>;
  const sub = person.role === "employer" ? `Employer${person.company_name ? ` · ${person.company_name}` : ""}` : person.role === "admin" ? "Mukana team" : person.headline;
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold leading-tight">
        <Link href={`/people/${person.id}`} className="hover:underline">
          {person.full_name}
        </Link>
        {person.role === "admin" ? <Badge variant="cta">Team</Badge> : null}
      </p>
      {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
      <p className="text-xs text-muted-foreground">{time}</p>
    </div>
  );
}

function MediaGrid({ media }: { media: FeedMedia[] }) {
  const [open, setOpen] = React.useState<string | null>(null);
  if (!media.length) return null;
  const video = media.find((m) => m.kind === "video");
  if (video) {
    return <video src={mediaUrl(video.path)} controls playsInline preload="metadata" className="mt-3 max-h-[70vh] w-full rounded-lg bg-black" />;
  }
  return (
    <>
      <ul className={cn("mt-3 grid gap-1.5 overflow-hidden rounded-lg", media.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
        {media.map((m, i) => (
          <li key={m.id} className={cn(media.length === 3 && i === 0 && "col-span-2")}>
            <button type="button" onClick={() => setOpen(m.path)} className="block w-full" aria-label="Open photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(m.path)} alt="Photo in post" loading="lazy" className={cn("w-full bg-surface-muted object-cover", media.length === 1 ? "max-h-[32rem]" : "h-56")} />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={open !== null} onClose={() => setOpen(null)} title="Photo" className="max-w-3xl">
        {open ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(open)} alt="Photo in post" className="max-h-[75dvh] w-full rounded-lg object-contain" />
        ) : null}
      </Dialog>
    </>
  );
}

export function PostCard({
  post,
  userId,
  role,
  myName,
  myAvatar,
  openComments = false,
}: {
  post: FeedPost;
  userId: string;
  role: "candidate" | "employer" | "admin";
  myName: string;
  myAvatar: string | null;
  openComments?: boolean;
}) {
  const queryClient = useQueryClient();
  const supabase = React.useMemo(() => createClient(), []);
  const [showComments, setShowComments] = React.useState(openComments);
  const [menu, setMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const mine = post.author_id === userId;

  React.useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const patch = (fn: (p: FeedPost) => FeedPost) =>
    queryClient.setQueriesData<InfiniteData<Page>>({ queryKey: ["feed", "posts"] }, (old) =>
      old ? { ...old, pages: old.pages.map((pg) => ({ ...pg, posts: pg.posts.map((p) => (p.id === post.id ? fn(p) : p)) })) } : old,
    );

  const like = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = next
        ? await supabase.from("post_likes").insert({ post_id: post.id, user_id: userId })
        : await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", userId);
      if (error && error.code !== "23505") throw error;
    },
    onMutate: (next) => patch((p) => ({ ...p, likedByMe: next, like_count: Math.max(0, p.like_count + (next ? 1 : -1)) })),
    onError: (_e, next) => {
      patch((p) => ({ ...p, likedByMe: !next, like_count: Math.max(0, p.like_count + (next ? -1 : 1)) }));
      toast.error("Couldn't update your like");
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const r = await deletePostAction(post.id);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Post deleted");
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const share = async () => {
    const url = `${window.location.origin}/feed/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${post.author?.full_name ?? "A member"} on Mukana`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <article className="rounded-xl border border-border bg-surface p-3 shadow-sm sm:p-4">
      <header className="flex items-start gap-3">
        <Avatar url={post.avatarUrl} name={post.author?.full_name} size="md" />
        <div className="min-w-0 flex-1">
          <PersonLine person={post.author} time={timeAgo(post.created_at)} />
        </div>
        <div ref={menuRef} className="relative">
          <button type="button" onClick={() => setMenu((m) => !m)} aria-label="Post options" aria-expanded={menu} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-muted">
            <Ellipsis className="size-5" aria-hidden />
          </button>
          {menu ? (
            <div role="menu" className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-border bg-surface p-1.5 shadow-xl">
              {mine ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    if (window.confirm("Delete this post? This can't be undone.")) del.mutate();
                  }}
                  className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-danger hover:bg-surface-muted"
                >
                  <Trash2 className="size-4" aria-hidden /> Delete post
                </button>
              ) : (
                <div className="flex flex-col">
                  {role !== "admin" ? <ReportButton targetType="post" targetId={post.id} label="Report post" /> : null}
                  {role === "admin" ? (
                    <ReasonButton label="Remove post" title="Remove this post" description="It disappears for everyone and the author is told why." confirmLabel="Remove" variant="destructive" required run={(reason) => moderatePostAction(post.id, "remove", reason)} />
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {post.body ? <PostBody body={post.body} className="mt-3 whitespace-pre-line break-words text-sm leading-6" /> : null}
      <MediaGrid media={post.media} />

      {post.like_count > 0 || post.comment_count > 0 ? (
        <p className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{post.like_count > 0 ? `${post.like_count} like${post.like_count === 1 ? "" : "s"}` : ""}</span>
          {post.comment_count > 0 ? (
            <button type="button" onClick={() => setShowComments(true)} className="hover:underline">
              {post.comment_count} comment{post.comment_count === 1 ? "" : "s"}
            </button>
          ) : null}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-1 border-t border-border pt-1.5">
        <Button type="button" variant="ghost" size="sm" aria-pressed={post.likedByMe} onClick={() => like.mutate(!post.likedByMe)} className={cn(post.likedByMe && "text-link")}>
          <ThumbsUp className={cn(post.likedByMe && "fill-current")} aria-hidden /> Like
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowComments((s) => !s)} aria-expanded={showComments}>
          <MessageCircle aria-hidden /> Comment
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void share()}>
          <Share2 aria-hidden /> Share
        </Button>
      </div>

      {showComments ? (
        <div className="mt-2">
          <Comments postId={post.id} postAuthorId={post.author_id} userId={userId} myName={myName} myAvatar={myAvatar} />
        </div>
      ) : null}
    </article>
  );
}
