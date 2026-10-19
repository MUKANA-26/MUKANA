"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedComment, FeedPerson, FeedPost } from "./types";

export const FEED_PAGE = 10;

export type FeedMode = "for_you" | "latest" | "following" | "saved";

async function signAvatars(supabase: SupabaseClient, people: FeedPerson[]): Promise<Record<string, string>> {
  const paths = [...new Set(people.map((p) => p.avatar_path).filter((p): p is string => Boolean(p)))];
  if (!paths.length) return {};
  const { data } = await supabase.storage.from("avatars").createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl;
  return out;
}

async function loadPeople(supabase: SupabaseClient, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, FeedPerson>();
  const { data } = await supabase.from("feed_people").select("id, full_name, role, avatar_path, headline, company_id, company_name, verified_badge, open_to_work").in("id", unique);
  return new Map(((data ?? []) as FeedPerson[]).map((p) => [p.id, p]));
}

const POST_COLS = "id, author_id, body, status, like_count, comment_count, created_at, edited_at, repost_of, hashtags, post_media(id, kind, path, position)";
type Row = Omit<FeedPost, "media" | "author" | "avatarUrl" | "likedByMe" | "savedByMe" | "original"> & { post_media: FeedPost["media"] };

interface Options {
  /** Page number (0-based). */
  page?: number;
  mode?: FeedMode;
  tag?: string | null;
  search?: string | null;
  authorId?: string;
  postId?: string;
}

/** Turns raw rows into posts: authors, photos, the viewer's likes/saves and the original of every repost. */
async function hydrate(supabase: SupabaseClient, userId: string, rows: Row[]): Promise<FeedPost[]> {
  const originalIds = [...new Set(rows.map((r) => r.repost_of).filter((x): x is string => Boolean(x)))];
  const originalRows: Row[] = originalIds.length
    ? (((await supabase.from("posts").select(POST_COLS).in("id", originalIds).eq("status", "published")).data ?? []) as unknown as Row[])
    : [];
  const all = [...rows, ...originalRows];
  const ids = all.map((r) => r.id);
  const [people, likes, saves] = await Promise.all([
    loadPeople(supabase, all.map((r) => r.author_id)),
    ids.length ? supabase.from("post_likes").select("post_id").eq("user_id", userId).in("post_id", ids) : Promise.resolve({ data: [] as { post_id: string }[] }),
    ids.length ? supabase.from("post_bookmarks").select("post_id").eq("user_id", userId).in("post_id", ids) : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);
  const avatars = await signAvatars(supabase, [...people.values()]);
  const liked = new Set((likes.data ?? []).map((l) => l.post_id));
  const saved = new Set((saves.data ?? []).map((l) => l.post_id));

  const build = (r: Row, original: FeedPost | null): FeedPost => {
    const { post_media, ...rest } = r;
    const author = people.get(r.author_id) ?? null;
    return {
      ...rest,
      media: [...(post_media ?? [])].sort((a, b) => a.position - b.position),
      author,
      avatarUrl: author?.avatar_path ? (avatars[author.avatar_path] ?? null) : null,
      likedByMe: liked.has(r.id),
      savedByMe: saved.has(r.id),
      original,
    };
  };
  const originals = new Map(originalRows.map((r) => [r.id, build(r, null)]));
  return rows.map((r) => build(r, r.repost_of ? (originals.get(r.repost_of) ?? null) : null));
}

/** One page of posts. Modes use the server-side ranking; author, single-post and search views are plain lists. */
export async function fetchPosts(supabase: SupabaseClient, userId: string, { page = 0, mode = "latest", tag, search, authorId, postId }: Options): Promise<{ posts: FeedPost[]; next: number | null }> {
  const from = page * FEED_PAGE;
  let rows: Row[] = [];

  if (authorId || postId || (search && search.trim().length >= 2)) {
    let q = supabase.from("posts").select(POST_COLS).eq("status", "published").order("created_at", { ascending: false }).range(from, from + FEED_PAGE - 1);
    if (authorId) q = q.eq("author_id", authorId);
    if (postId) q = q.eq("id", postId);
    if (search && search.trim().length >= 2) q = q.ilike("body", `%${search.trim().replace(/[%_\\]/g, "")}%`);
    const { data, error } = await q;
    if (error) throw error;
    rows = (data ?? []) as unknown as Row[];
  } else {
    const { data: idRows, error } = await supabase.rpc("home_feed", { p_mode: tag ? "tag" : mode, p_offset: from, p_limit: FEED_PAGE, p_tag: tag ?? null });
    if (error) throw error;
    const ids = ((idRows ?? []) as { id: string }[]).map((r) => r.id);
    if (ids.length) {
      const { data, error: e2 } = await supabase.from("posts").select(POST_COLS).in("id", ids);
      if (e2) throw e2;
      const byId = new Map(((data ?? []) as unknown as Row[]).map((r) => [r.id, r]));
      rows = ids.map((id) => byId.get(id)).filter((r): r is Row => Boolean(r));
    }
    return { posts: await hydrate(supabase, userId, rows), next: ids.length === FEED_PAGE ? page + 1 : null };
  }
  return { posts: await hydrate(supabase, userId, rows), next: rows.length === FEED_PAGE ? page + 1 : null };
}

export async function fetchComments(supabase: SupabaseClient, postId: string): Promise<FeedComment[]> {
  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, author_id, body, created_at")
    .eq("post_id", postId)
    .eq("status", "published")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as Omit<FeedComment, "author" | "avatarUrl">[];
  const people = await loadPeople(supabase, rows.map((r) => r.author_id));
  const avatars = await signAvatars(supabase, [...people.values()]);
  return rows.map((r) => {
    const author = people.get(r.author_id) ?? null;
    return { ...r, author, avatarUrl: author?.avatar_path ? (avatars[author.avatar_path] ?? null) : null };
  });
}

export async function fetchTrending(supabase: SupabaseClient): Promise<{ tag: string; uses: number }[]> {
  const { data } = await supabase.rpc("trending_hashtags", { p_limit: 8 });
  return ((data ?? []) as { tag: string; uses: number | string }[]).map((t) => ({ tag: t.tag, uses: Number(t.uses) }));
}

export function mediaUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-media/${path}`;
}
