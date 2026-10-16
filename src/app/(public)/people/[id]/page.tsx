import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronLeft, GraduationCap } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { signAvatarUrl } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import { FeedList } from "@/features/feed/feed-list";
import type { FeedPerson } from "@/features/feed/types";

export const metadata: Metadata = { title: "Member" };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const supabase = await createClient();
  const { data } = /^[0-9a-f-]{36}$/i.test(id)
    ? await supabase.from("feed_people").select("id, full_name, role, avatar_path, headline, company_id, company_name").eq("id", id).maybeSingle()
    : { data: null };
  const person = data as FeedPerson | null;
  const [myAvatar, theirAvatar] = await Promise.all([signAvatarUrl(session.avatar_path), signAvatarUrl(person?.avatar_path)]);
  const mine = person?.id === session.id;

  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <Link href="/feed" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> Back to feed
        </Link>
        {!person ? (
          <EmptyState title="Nothing to show yet" description="This member hasn't posted, commented or been tagged, so there's no public page for them." action={<Button asChild variant="outline"><Link href="/feed">Go to the feed</Link></Button>} />
        ) : (
          <>
            <header className="mb-4 flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
              <Avatar url={theirAvatar} name={person.full_name} size="lg" />
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-xl font-semibold">{person.full_name}</h1>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant={person.role === "employer" ? "info" : person.role === "admin" ? "cta" : "neutral"}>{person.role === "admin" ? "Mukana team" : person.role === "employer" ? "Employer" : "Candidate"}</Badge>
                  {person.headline ? (
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap className="size-4" aria-hidden /> {person.headline}
                    </span>
                  ) : null}
                  {person.company_id ? (
                    <Link href={`/companies/${person.company_id}`} className="inline-flex items-center gap-1.5 text-link hover:underline">
                      <Building2 className="size-4" aria-hidden /> {person.company_name}
                    </Link>
                  ) : null}
                </p>
              </div>
              {mine && session.role === "candidate" ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/candidate/profile">My profile</Link>
                </Button>
              ) : null}
            </header>
            <h2 className="mb-3 font-heading text-lg font-semibold">Posts</h2>
            <FeedList userId={session.id} role={session.role} name={session.full_name || session.email} avatarUrl={myAvatar} authorId={person.id} emptyText="No posts yet." />
          </>
        )}
      </div>
    </AdaptiveLayout>
  );
}