import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Chat } from "@/features/messages/chat";
import type { ConversationRow } from "@/features/messages/conversation-list";

export const metadata: Metadata = { title: "Chat" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_conversations");
  const conv = ((data ?? []) as ConversationRow[]).find((c) => c.id === id);

  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        {!conv ? (
          <EmptyState title="Conversation not found" description="You may have left this group, or the link is wrong." action={<Button asChild variant="outline"><Link href="/messages">Back to messages</Link></Button>} />
        ) : (
          <Chat
            conversationId={conv.id}
            userId={session.id}
            title={conv.is_group ? (conv.title ?? "Group chat") : (conv.other_name ?? "Member")}
            isGroup={conv.is_group}
            otherId={conv.other_id}
            otherAvatarPath={conv.other_avatar}
          />
        )}
      </div>
    </AdaptiveLayout>
  );
}
