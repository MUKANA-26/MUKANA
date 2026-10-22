"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Bookmark, Ellipsis, Heart, MessageCircle, Pencil, Repeat2, Share2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { cn, timeAgo } from "@/lib/utils";
import { useLowData, useT } from "@/components/prefs-provider";
import { ReasonButton } from "@/features/admin/reason-dialog";
import { moderatePostAction } from "@/features/admin/actions";
import { ReportButton } from "@/features/opportunities/opportunity-buttons";
import { deletePostAction, editPostAction, repostAction } from "./actions";
import { MentionTextarea } from "./mention-textarea";
import { MENTION_RE, plainText, withTokens } from "./mentions";
import { Comments } from "./comments";
import { PostBody } from "./post-body";
import { mediaUrl } from "./queries";
import type { FeedMedia, FeedPerson, FeedPost } from "./types";

type Page = { posts: FeedPost[]; next: number | null };

export function PersonLine({ person, time }: { person: FeedPerson | null; time: string }) {
  if (!person) return <p className="text-sm font-semibold">Member</p>;
  const sub = person.role === "employer" ? `Employer${person.company_name ? ` · ${person.company_name}` : ""}` : person.role === "admin" ? "Mukana team" : person.headline;
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold leading-tight">
        <Link href={`/people/${person.id}`} className="hover:underline">
          {person.full_name}
        </Link>
        {person.verified_badge ? <BadgeCheck className="size-4 text-link" aria-label="Verified" /> : null}
        {person.role === "admin" ? <Badge variant="cta">Team</Badge> : null}
        {person.open_to_work ? <Badge variant="success">Open to work</Badge> : null}
      </p>
      {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
      <p className="text-xs text-muted-foreground">{time}</p>
    </div>
  );
}

/** Name, verified mark, subtitle and time on one flowing line (timeline style). */
function PostHeader({ person, time }: { person: FeedPerson | null; time: string }) {
  if (!person) return <p className="text-[15px] font-bold">Member</p>;
  const sub = person.role === "employer" ? person.company_name ?? "Employer" : person.role === "admin" ? "Mukana team" : person.headline;
  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[15px] leading-5">
      <Link href={`/people/${person.id}`} className="max-w-full truncate font-bold hover:underline">
        {person.full_name}
      </Link>
      {person.verified_badge ? <BadgeCheck className="size-4 shrink-0 translate-y-0.5 text-link" aria-label="Verified" /> : null}
      {person.role === "admin" ? <span className="rounded bg-cta px-1.5 text-[11px] font-bold text-cta-foreground">Team</span> : null}
      {sub ? <span className="min-w-0 max-w-[14rem] truncate text-muted-foreground">{sub}</span> : null}
      <span className="text-muted-foreground">· {time}</span>
    </p>
  );
}

function MediaGrid({ media }: { media: FeedMedia[] }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const lowData = useLowData();
  const [loaded, setLoaded] = React.useState(false);
  if (!media.length) return null;
  if (lowData && !loaded) {
    return (
      <button type="button" onClick={() => setLoaded(true)} className="mt-2 flex h-24 w-full items-center justify-center rounded-2xl border border-dashed border-border text-sm font-medium text-muted-foreground">
        Low-data mode: tap to load {media.some((m) => m.kind === "video") ? "the video" : media.length === 1 ? "the photo" : `${media.length} photos`}
      </button>
    );
  }
  const video = media.find((m) => m.kind === "video");
  if (video) {
    return <video src={mediaUrl(video.path)} controls playsInline preload={lowData ? "none" : "metadata"} className="mt-2 max-h-[70vh] w-full rounded-2xl border border-border bg-black" />;
  }
  return (
    <>
      <ul className={cn("mt-2 grid gap-0.5 overflow-hidden rounded-2xl border border-border", media.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
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
  const t = useT();
  const supabase = React.useMemo(() => createClient(), []);
  const [showComments, setShowComments] = React.useState(openComments);
  const [menu, setMenu] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [draftMentions, setDraftMentions] = React.useState<Record<string, string>>({});
  const [reposting, setReposting] = React.useState(false);
  const [repostText, setRepostText] = React.useState("");
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

  const save = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = next
        ? await supabase.from("post_bookmarks").insert({ post_id: post.id, user_id: userId })
        : await supabase.from("post_bookmarks").delete().eq("post_id", post.id).eq("user_id", userId);
      if (error && error.code !== "23505") throw error;
    },
    onMutate: (next) => patch((p) => ({ ...p, savedByMe: next })),
    onSuccess: (_d, next) => {
      toast.success(next ? "Saved to your bookmarks" : "Removed from bookmarks");
      void queryClient.invalidateQueries({ queryKey: ["feed", "posts"] });
    },
    onError: (_e, next) => {
      patch((p) => ({ ...p, savedByMe: !next }));
      toast.error("Couldn't update your bookmarks");
    },
  });

  const edit = useMutation({
    mutationFn: async () => {
      const r = await editPostAction(post.id, withTokens(draft.trim(), draftMentions));
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setEditing(false);
      toast.success("Post updated");
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const repost = useMutation({
    mutationFn: async () => {
      const r = await repostAction(post.id, repostText.trim());
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setReposting(false);
      setRepostText("");
      toast.success("Reposted");
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

  const when = `${timeAgo(post.created_at)}${post.edited_at ? " · edited" : ""}`;
  const action = "group inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-[13px] text-muted-foreground transition-colors";

  return (
    <article className="px-4 pb-1 pt-3 transition-colors hover:bg-surface-muted/30">
      {post.repost_of ? (
        <p className="mb-1 flex items-center gap-2 pl-[52px] text-xs font-semibold text-muted-foreground">
          <Repeat2 className="size-3.5" aria-hidden /> {mine ? "You" : (post.author?.full_name ?? "Member")} reposted
        </p>
      ) : null}
      <div className="flex gap-3">
        <Link href={post.author ? `/people/${post.author.id}` : "#"} className="shrink-0" aria-label={`View ${post.author?.full_name ?? "member"}'s profile`}>
          <Avatar url={post.avatarUrl} name={post.author?.full_name} size="sm" className="size-10" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <PostHeader person={post.author} time={when} />
            </div>
            <div ref={menuRef} className="relative -mr-2 -mt-1">
              <button type="button" onClick={() => setMenu((m) => !m)} aria-label="Post options" aria-expanded={menu} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-link/10 hover:text-link">
                <Ellipsis className="size-5" aria-hidden />
              </button>
              {menu ? (
                <div role="menu" className="absolute right-0 top-9 z-20 w-48 rounded-xl border border-border bg-surface p-1.5 shadow-xl">
                  {mine ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(false);
                          setDraft(plainText(post.body));
                          setDraftMentions(Object.fromEntries([...post.body.matchAll(MENTION_RE)].map((m) => [m[1]!, m[2]!])));
                          setEditing(true);
                        }}
                        className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted"
                      >
                        <Pencil className="size-4" aria-hidden /> Edit post
                      </button>
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
                    </>
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
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <MentionTextarea
                aria-label="Edit your post"
                value={draft}
                onChange={setDraft}
                mentions={draftMentions}
                onMention={(n, id) => setDraftMentions((m) => ({ ...m, [n]: id }))}
                rows={4}
                onSubmitShortcut={() => edit.mutate()}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="cta" size="sm" loading={edit.isPending} disabled={!draft.trim() && post.media.length === 0 && !post.repost_of} onClick={() => edit.mutate()}>
                  Save changes
                </Button>
              </div>
            </div>
          ) : post.body ? (
            <PostBody body={post.body} className="mt-0.5 whitespace-pre-line break-words text-[15px] leading-6" />
          ) : null}

          <MediaGrid media={post.media} />

          {post.repost_of ? (
            post.original ? (
              <div className="mt-2 rounded-2xl border border-border p-3">
                <div className="flex items-start gap-2">
                  <Avatar url={post.original.avatarUrl} name={post.original.author?.full_name} size="xs" />
                  <div className="min-w-0 flex-1">
                    <PostHeader person={post.original.author} time={timeAgo(post.original.created_at)} />
                  </div>
                </div>
                {post.original.body ? <PostBody body={post.original.body} className="mt-1 whitespace-pre-line break-words text-[15px] leading-6" /> : null}
                <MediaGrid media={post.original.media} />
                <Link href={`/feed/${post.original.id}`} className="mt-1 inline-block text-xs font-medium text-link hover:underline">
                  View original post
                </Link>
              </div>
            ) : (
              <p className="mt-2 rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">The original post isn&apos;t available any more.</p>
            )
          ) : null}

          <div className="-ml-2 mt-1 flex max-w-md items-center justify-between">
            <button type="button" onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} aria-label={t("Comment")} title={t("Comment")} className={cn(action, "hover:bg-link/10 hover:text-link", showComments && "text-link")}>
              <MessageCircle className="size-[18px]" aria-hidden />
              {post.comment_count > 0 ? <span>{post.comment_count}</span> : null}
            </button>
            <button type="button" onClick={() => setReposting(true)} aria-label={t("Repost")} title={t("Repost")} className={cn(action, "hover:bg-success/10 hover:text-success")}>
              <Repeat2 className="size-[18px]" aria-hidden />
            </button>
            <button type="button" aria-pressed={post.likedByMe} onClick={() => like.mutate(!post.likedByMe)} aria-label={post.likedByMe ? "Unlike" : t("Like")} title={t("Like")} className={cn(action, "hover:bg-danger/10 hover:text-danger", post.likedByMe && "text-danger")}>
              <Heart className={cn("size-[18px]", post.likedByMe && "fill-current")} aria-hidden />
              {post.like_count > 0 ? <span>{post.like_count}</span> : null}
            </button>
            <button type="button" aria-pressed={post.savedByMe} onClick={() => save.mutate(!post.savedByMe)} aria-label={post.savedByMe ? "Remove from bookmarks" : "Save post"} title="Save" className={cn(action, "hover:bg-link/10 hover:text-link", post.savedByMe && "text-link")}>
              <Bookmark className={cn("size-[18px]", post.savedByMe && "fill-current")} aria-hidden />
            </button>
            <button type="button" onClick={() => void share()} aria-label={t("Share")} title={t("Share")} className={cn(action, "hover:bg-link/10 hover:text-link")}>
              <Share2 className="size-[18px]" aria-hidden />
            </button>
          </div>

          {showComments ? (
            <div className="pb-2">
              <Comments postId={post.id} postAuthorId={post.author_id} userId={userId} myName={myName} myAvatar={myAvatar} />
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={reposting} onClose={() => setReposting(false)} title="Repost" className="max-w-lg">
        <div className="space-y-3">
          <textarea
            aria-label="Add your thoughts (optional)"
            value={repostText}
            onChange={(e) => setRepostText(e.target.value)}
            maxLength={3000}
            rows={3}
            placeholder="Add your thoughts (optional)"
            className="w-full rounded-lg border border-input bg-surface-muted p-3 text-sm"
          />
          <p className="line-clamp-3 rounded-lg border border-border p-2 text-xs text-muted-foreground">{plainText(post.body) || "Shared post"}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setReposting(false)}>
              Cancel
            </Button>
            <Button type="button" variant="cta" loading={repost.isPending} onClick={() => repost.mutate()}>
              Repost
            </Button>
          </div>
        </div>
      </Dialog>
    </article>
  );
}
