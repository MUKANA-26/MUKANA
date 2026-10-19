import type { Metadata } from "next";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { NetworkHub } from "@/features/network/network-hub";

export const metadata: Metadata = { title: "My network" };

export default async function NetworkPage() {
  await requireUser();
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-2xl">
        <PageHeader title="My network" description="Connect with classmates, colleagues and employers." />
        <NetworkHub />
      </div>
    </AdaptiveLayout>
  );
}
