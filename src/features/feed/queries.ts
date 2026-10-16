"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedComment, FeedPerson, FeedPost } from "./types";

export const FEED_PAGE = 10;

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
  const { data } = await supabase.from("feed_people").select("id, full_name, role, avatar_path, headline, company_id, company_name").in("id", unique);
  return new Map(((data ?? []) as FeedPerson[]).map((p) => [p.id, p]));
}

interface Options {
  cursor?: string | null;
  authorId?: string;
  postId?: string;
}

/** One page of posts (newest first) with media, authors, photos and the viewer's likes. */
export async function fetchPosts(supabase: SupabaseClient, userId: string, { cursor, authorId, postId }: Options): Promise<{ posts: FeedPost[]; next: string | null }> {
  let q = supabase
    .from("posts")
    .select("id, author_id, body, status, like_count, comment_count, created_at, post_media(id, kind, path, position)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(FEED_PAGE);
  if (cursor) q = q.lt("created_at", cursor);
  if (authorId) q = q.eq("author_id", authorId);
  if (postId) q = q.eq("id", postId);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Omit<FeedPost, "media" | "author" | "avatarUrl" | "likedByMe"> & { post_media: FeedPost["media"] })[];

  const [people, likes] = await Promise.all([
    loadPeople(supabase, rows.map((r) => r.author_id)),
    rows.length ? supabase.from("post_likes").select("post_id").eq("user_id", userId).in("post_id", rows.map((r) => r.id)) : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);
  const avatars = await signAvatars(supabase, [...people.values()]);
  const liked = new Set((likes.data ?? []).map((l) => l.post_id));

  const posts: FeedPost[] = rows.map(({ post_media, ...r }) => {
    const author = people.get(r.author_id) ?? null;
    return {
      ...r,
      media: [...(post_media ?? [])].sort((a, b) => a.position - b.position),
      author,
      avatarUrl: author?.avatar_path ? (avatars[author.avatar_path] ?? null) : null,
      likedByMe: liked.has(r.id),
    };
  });
  return { posts, next: rows.length === FEED_PAGE ? rows[rows.length - 1]!.created_at : null };
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

export function mediaUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-media/${path}`;
}
