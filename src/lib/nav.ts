import {
  BarChart3,
  Bell,
  BookmarkCheck,
  Building2,
  CalendarClock,
  ClipboardList,
  FileText,
  Flag,
  LayoutDashboard,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/roles";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar (max 4; the 5th slot is always "More"). */
  mobile?: boolean;
  /** Match the path exactly for the active state. */
  exact?: boolean;
}

export const NAV: Record<Role, NavItem[]> = {
  candidate: [
    { href: "/candidate", label: "Home", icon: LayoutDashboard, mobile: true, exact: true },
    { href: "/candidate/opportunities", label: "Browse", icon: Search, mobile: true },
    { href: "/candidate/applications", label: "Applications", icon: ClipboardList, mobile: true },
    { href: "/candidate/saved", label: "Saved", icon: BookmarkCheck, mobile: true },
    { href: "/candidate/recommended", label: "Recommended", icon: Sparkles },
    { href: "/candidate/profile", label: "Profile", icon: UserRound },
    { href: "/candidate/cv-builder", label: "CV builder", icon: FileText },
    { href: "/candidate/notifications", label: "Notifications", icon: Bell },
    { href: "/candidate/settings", label: "Settings", icon: Settings },
  ],
  employer: [
    { href: "/employer", label: "Home", icon: LayoutDashboard, mobile: true, exact: true },
    { href: "/employer/opportunities", label: "Opportunities", icon: ClipboardList, mobile: true },
    { href: "/employer/applicants", label: "Applicants", icon: Users, mobile: true },
    { href: "/employer/interviews", label: "Interviews", icon: CalendarClock, mobile: true },
    { href: "/employer/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/employer/company", label: "Company", icon: Building2 },
    { href: "/employer/templates", label: "Templates", icon: FileText },
    { href: "/employer/notifications", label: "Notifications", icon: Bell },
    { href: "/employer/settings", label: "Settings", icon: Settings },
  ],
  admin: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard, mobile: true, exact: true },
    { href: "/admin/verifications", label: "Verifications", icon: ShieldCheck, mobile: true },
    { href: "/admin/reports", label: "Reports", icon: Flag, mobile: true },
    { href: "/admin/users", label: "Users", icon: Users, mobile: true },
    { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
    { href: "/admin/notifications", label: "Notifications", icon: Bell },
  ],
};
