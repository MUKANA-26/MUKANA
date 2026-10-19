import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";
import { ResourceBody } from "@/features/learning/resource-body";

export const metadata: Metadata = { title: "Guide" };

export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = /^[0-9a-f-]{36}$/i.test(id) ? await supabase.from("resources").select("id, title, summary, body").eq("id", id).eq("published", true).maybeSingle() : { data: null };
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <Link href="/learn" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Learn
        </Link>
        {!data ? (
          <EmptyState title="Guide not found" action={<Button asChild variant="outline"><Link href="/learn">See all guides</Link></Button>} />
        ) : (
          <article className="rounded-xl border border-border bg-surface p-5 shadow-sm sm:p-6">
            <h1 className="font-heading text-2xl font-semibold">{data.title}</h1>
            {data.summary ? <p className="mt-1 text-muted-foreground">{data.summary}</p> : null}
            <ResourceBody body={data.body} />
          </article>
        )}
      </div>
    </AdaptiveLayout>
  );
}
