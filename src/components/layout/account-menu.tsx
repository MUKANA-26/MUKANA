"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, LogOut, Settings, UserRound, Building2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { signOutAction } from "@/features/auth/actions";
import { clearOfflineCache } from "@/lib/offline-cache";
import type { Role } from "@/lib/roles";

const ROLE_LABEL: Record<Role, string> = { candidate: "Candidate", employer: "Employer", admin: "Admin" };

/** LinkedIn-style "Me" menu on the corner photo: profile, settings, help and sign out. */
export function AccountMenu({ role, name, email, avatarUrl }: { role: Role; name: string; email: string; avatarUrl: string | null }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  React.useEffect(() => setOpen(false), [pathname]);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items =
    role === "candidate"
      ? [
          { href: "/candidate/profile", label: "View my profile", icon: UserRound },
          { href: "/candidate/settings", label: "Settings & privacy", icon: Settings },
        ]
      : role === "employer"
        ? [
            { href: "/employer/company", label: "Company profile", icon: Building2 },
            { href: "/employer/settings", label: "Settings & privacy", icon: Settings },
          ]
        : [{ href: "/admin/settings", label: "Account settings", icon: Settings }];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className="ml-1 grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Avatar url={avatarUrl} name={name} size="sm" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <Avatar url={avatarUrl} name={name} size="md" />
            <div className="min-w-0">
              <p className="truncate font-heading font-semibold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              <Badge variant="info" className="mt-1">
                {ROLE_LABEL[role]}
              </Badge>
            </div>
          </div>
          <div className="p-1.5">
            {items.map((i) => (
              <Link key={i.href} href={i.href} role="menuitem" className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted">
                <i.icon className="size-4" aria-hidden /> {i.label}
              </Link>
            ))}
            <Link href="/help" role="menuitem" className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted">
              <CircleHelp className="size-4" aria-hidden /> Help
            </Link>
            <form action={signOutAction} onSubmit={() => clearOfflineCache()}>
              <button type="submit" role="menuitem" className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted">
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
