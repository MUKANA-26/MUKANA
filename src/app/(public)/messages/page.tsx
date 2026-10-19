import type { Metadata } from "next";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { ConversationList } from "@/features/messages/conversation-list";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  await requireUser();
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Messages" description="Chat with your connections, and with employers or applicants." />
        <ConversationList />
      </div>
    </AdaptiveLayout>
  );
}
