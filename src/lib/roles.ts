export type Role = "candidate" | "employer" | "admin";

export const ROLE_HOME: Record<Role, string> = {
  candidate: "/candidate",
  employer: "/employer",
  admin: "/admin",
};

export function isRole(value: unknown): value is Role {
  return value === "candidate" || value === "employer" || value === "admin";
}

/** Which role may access a protected path prefix. */
export function roleForPath(pathname: string): Role | null {
  if (pathname === "/candidate" || pathname.startsWith("/candidate/")) return "candidate";
  if (pathname === "/employer" || pathname.startsWith("/employer/")) return "employer";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  return null;
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
