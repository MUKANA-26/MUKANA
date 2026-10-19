import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { signAvatarUrls } from "@/lib/avatars";
import { createClient } from "@/lib/supabase/server";
import { FeedList } from "@/features/feed/feed-list";
import { ProfileView, type PersonProfile, type ProfileViews } from "@/features/network/profile-view";

export const metadata: Metadata = { title: "Member" };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const supabase = await createClient();
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const { data } = valid ? await supabase.rpc("get_person", { p_id: id }) : { data: null };
  const person = (data ?? null) as PersonProfile | null;

  if (person && !person.relation.self) await supabase.rpc("record_profile_view", { p_id: id });
  const views = person?.relation.self ? (((await supabase.rpc("my_profile_views", { p_days: 30 })).data ?? null) as ProfileViews | null) : null;
  const urls = await signAvatarUrls([session.avatar_path, person?.avatar_path, person?.cover_path]);
  const myAvatar = session.avatar_path ? (urls[session.avatar_path] ?? null) : null;

  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <Link href="/network" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> My network
        </Link>
        {!person ? (
          <EmptyState title="Member not found" description="This profile isn't available. They may have left Mukana or restricted who can see it." action={<Button asChild variant="outline"><Link href="/network">Find people</Link></Button>} />
        ) : (
          <>
            <ProfileView
              person={person}
              me={session.id}
              avatarUrl={person.avatar_path ? (urls[person.avatar_path] ?? null) : null}
              coverUrl={person.cover_path ? (urls[person.cover_path] ?? null) : null}
              views={views}
            />
            <h2 className="mb-3 mt-6 font-heading text-lg font-semibold">Posts</h2>
            <FeedList userId={session.id} role={session.role} name={session.full_name || session.email} avatarUrl={myAvatar} authorId={person.id} emptyText="No posts yet." />
          </>
        )}
      </div>
    </AdaptiveLayout>
  );
}
