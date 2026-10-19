"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export interface PersonRowData {
  id: string;
  full_name: string;
  role: "candidate" | "employer" | "admin";
  headline: string | null;
  company_name: string | null;
  avatar_path: string | null;
  verified_badge?: boolean | null;
  open_to_work?: boolean | null;
  reason?: string | null;
}

/** A member in a list: photo, name, headline and a slot for action buttons. */
export function PersonRow({ person, avatarUrl, children }: { person: PersonRowData; avatarUrl: string | null; children?: React.ReactNode }) {
  const sub = person.role === "employer" ? [person.headline && person.headline !== person.company_name ? person.headline : "Employer", person.company_name].filter(Boolean).join(" · ") : person.headline;
  return (
    <div className="flex items-center gap-3 p-3 sm:p-4">
      <Link href={`/people/${person.id}`} aria-label={`View ${person.full_name}'s profile`}>
        <Avatar url={avatarUrl} name={person.full_name} size="md" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold leading-tight">
          <Link href={`/people/${person.id}`} className="hover:underline">
            {person.full_name}
          </Link>
          {person.verified_badge ? <BadgeCheck className="size-4 text-link" aria-label="Verified" /> : null}
          {person.open_to_work ? <Badge variant="success">Open to work</Badge> : null}
        </p>
        {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
        {person.reason ? <p className="text-xs text-muted-foreground">{person.reason}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div> : null}
    </div>
  );
}
