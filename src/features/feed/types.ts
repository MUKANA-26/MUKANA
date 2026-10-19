export interface FeedPerson {
  id: string;
  full_name: string;
  role: "candidate" | "employer" | "admin";
  avatar_path: string | null;
  headline: string | null;
  company_id: string | null;
  company_name: string | null;
  verified_badge?: boolean;
  open_to_work?: boolean;
}

export interface FeedMedia {
  id: string;
  kind: "image" | "video";
  path: string;
  position: number;
}

export interface FeedPost {
  id: string;
  author_id: string;
  body: string;
  status: "published" | "removed";
  like_count: number;
  comment_count: number;
  created_at: string;
  edited_at: string | null;
  repost_of: string | null;
  hashtags: string[];
  media: FeedMedia[];
  author: FeedPerson | null;
  /** Signed URL for the author's photo, when visible. */
  avatarUrl: string | null;
  likedByMe: boolean;
  savedByMe: boolean;
  /** The original post when this one is a repost. */
  original: FeedPost | null;
}

export interface FeedComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: FeedPerson | null;
  avatarUrl: string | null;
}

export interface PersonSuggestion {
  id: string;
  full_name: string;
  role: "candidate" | "employer" | "admin";
  headline: string | null;
  company_name: string | null;
}