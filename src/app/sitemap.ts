import type { MetadataRoute } from "next";
import { createAnonClient } from "@/lib/supabase/server";

const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = ["", "/opportunities", "/privacy", "/terms"].map((p) => ({ url: `${base}${p}`, changeFrequency: "daily", priority: p === "" ? 1 : 0.6 }));
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return entries;
  try {
    const { data } = await createAnonClient()
      .from("opportunities")
      .select("id, updated_at")
      .eq("status", "published")
      .gte("deadline", new Date().toISOString().slice(0, 10))
      .order("published_at", { ascending: false })
      .limit(1000);
    for (const o of data ?? []) entries.push({ url: `${base}/opportunities/${o.id}`, lastModified: o.updated_at, priority: 0.8 });
  } catch {
    // The sitemap still lists the static pages when the database is unreachable.
  }
  return entries;
}
