"use client";

import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { GroupActions, type GroupRow } from "./group-list";

/** Group title bar with join / leave / delete. */
export function GroupHeader({ group }: { group: GroupRow }) {
  const router = useRouter();
  return (
    <header className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-heading text-xl font-semibold">
            <Users className="size-5 text-link" aria-hidden /> {group.name}
          </h1>
          <p className="text-sm text-muted-foreground">{Number(group.member_count)} member{Number(group.member_count) === 1 ? "" : "s"}</p>
          {group.description ? <p className="mt-2 whitespace-pre-line text-sm">{group.description}</p> : null}
        </div>
        <GroupActions group={group} afterDelete={() => router.push("/groups")} />
      </div>
    </header>
  );
}
