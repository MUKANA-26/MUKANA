"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, LogOut } from "lucide-react";
import { HeaderLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallButton } from "@/components/pwa/pwa-provider";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { AccountMenu } from "@/components/layout/account-menu";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { MessageBell } from "@/features/messages/message-bell";
import { PushForeground } from "@/features/notifications/push-foreground";
import { signOutAction } from "@/features/auth/actions";
import { clearOfflineCache } from "@/lib/offline-cache";
import { NAV, type NavItem } from "@/lib/nav";
import { ROLE_HOME, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useT } from "@/components/prefs-provider";

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const roleLabel: Record<Role, string> = { candidate: "Candidate", employer: "Employer", admin: "Admin" };

export function AppShell({
  role,
  userId,
  userName,
  userEmail = "",
  avatarUrl = null,
  children,
}: {
  role: Role;
  userId: string;
  userName: string;
  userEmail?: string;
  avatarUrl?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useT();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const items = NAV[role];
  const mobileItems = items.filter((i) => i.mobile).slice(0, 4);
  const moreItems = items.filter((i) => !mobileItems.includes(i));
  const moreActive = moreItems.some((i) => isActive(pathname, i));

  React.useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      {/* Sidebar: tablet and desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-16 items-center px-4">
          <HeaderLogo href={ROLE_HOME[role]} />
        </div>
        <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-info-soft text-info-soft-foreground" : "text-foreground hover:bg-surface-muted",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {t(item.label)}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg bg-surface-muted p-2.5">
            <Avatar url={avatarUrl} name={userName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel[role]}</p>
            </div>
          </div>
          <InstallButton size="sm" className="w-full" />
          <form action={signOutAction} onSubmit={() => clearOfflineCache()}>
            <button
              type="submit"
              className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              <LogOut className="size-5" aria-hidden /> {t("Sign out")}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-border bg-background/90 px-4 backdrop-blur safe-top">
          <div className="md:hidden">
            <HeaderLogo href={ROLE_HOME[role]} />
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Badge variant="info">{roleLabel[role]}</Badge>
          </div>
          <div className="flex items-center gap-1">
            {role !== "admin" ? <MessageBell userId={userId} /> : null}
            <NotificationBell userId={userId} href={`${ROLE_HOME[role]}/notifications`} />
            <ThemeToggle />
            <AccountMenu role={role} userId={userId} name={userName} email={userEmail} avatarUrl={avatarUrl} />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-28 md:pb-8">
          {children}
        </main>
        <PushForeground />
      </div>

      {/* Bottom navigation: mobile */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur safe-bottom md:hidden"
      >
        {mobileItems.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                active ? "text-link" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {t(item.label)}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
            moreActive ? "text-link" : "text-muted-foreground",
          )}
        >
          <Ellipsis className="size-5" aria-hidden />
          {t("More")}
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <ul className="space-y-1">
          {moreItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted"
              >
                <item.icon className="size-5" aria-hidden /> {t(item.label)}
              </Link>
            </li>
          ))}
          <li>
            <InstallButton variant="secondary" className="mt-2 w-full" />
          </li>
          <li>
            <form action={signOutAction} onSubmit={() => clearOfflineCache()}>
              <button
                type="submit"
                className="mt-1 flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted"
              >
                <LogOut className="size-5" aria-hidden /> {t("Sign out")}
              </button>
            </form>
          </li>
        </ul>
      </Dialog>
    </div>
  );
}
