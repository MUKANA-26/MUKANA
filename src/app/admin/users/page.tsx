import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { ActionButton, ReasonButton } from "@/features/admin/reason-dialog";
import { makeAdminAction, setUserStatusAction } from "@/features/admin/actions";
import { DeleteUserButton } from "@/features/admin/delete-user-button";

export const metadata: Metadata = { title: "Users" };

const PAGE = 20;
interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: "candidate" | "employer" | "admin";
  status: "active" | "suspended";
  created_at: string;
  company_name: string | null;
  total: number;
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const session = await requireRole("admin");
  const { q = "", role = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_users", {
    p_search: q.trim() || null,
    p_role: ["candidate", "employer", "admin"].includes(role) ? role : null,
    p_limit: PAGE,
    p_offset: (page - 1) * PAGE,
  });
  const users = (data ?? []) as UserRow[];
  const total = Number(users[0]?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (role) sp.set("role", role);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };

  return (
    <>
      <PageHeader title="Users" description="Search, suspend, restore or permanently delete accounts. Every change is logged." />
      <form method="get" className="mb-5 flex flex-wrap gap-2" role="search">
        <div className="min-w-48 flex-1">
          <label className="sr-only" htmlFor="user-q">Search users</label>
          <Input id="user-q" name="q" defaultValue={q} placeholder="Search by name or email" />
        </div>
        <div className="w-40">
          <label className="sr-only" htmlFor="user-role">Role</label>
          <Select id="user-role" name="role" defaultValue={role}>
            <option value="">All roles</option>
            <option value="candidate">Candidates</option>
            <option value="employer">Employers</option>
            <option value="admin">Admins</option>
          </Select>
        </div>
        <Button type="submit">Search</Button>
      </form>

      {users.length === 0 ? (
        <EmptyState icon={<UserCog aria-hidden />} title="No users found" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {u.full_name || "(no name)"}
                  <Badge variant={u.role === "admin" ? "cta" : u.role === "employer" ? "info" : "neutral"}>{u.role}</Badge>
                  {u.status === "suspended" ? <Badge variant="danger">Suspended</Badge> : null}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {u.email}
                  {u.company_name ? ` · ${u.company_name}` : ""} · joined {formatDate(u.created_at)}
                </p>
              </div>
              {u.id !== session.id && u.role !== "admin" ? (
                <div className="flex flex-wrap gap-2">
                  {u.status === "suspended" ? (
                    <ActionButton label="Restore" run={setUserStatusAction.bind(null, u.id, "active")} />
                  ) : (
                    <ReasonButton label="Suspend" title={`Suspend ${u.full_name || u.email}?`} description="They can no longer sign in or use Mukana until restored." confirmLabel="Suspend user" variant="outline" required run={setUserStatusAction.bind(null, u.id, "suspended")} />
                  )}
                  <DeleteUserButton userId={u.id} name={u.full_name} email={u.email} role={u.role as "candidate" | "employer"} />
                  <ReasonButton label="Make admin" title="Make this user an administrator?" description="Administrators can moderate everything on the platform. This is logged." confirmLabel="Make admin" icon={<ShieldCheck aria-hidden />} run={makeAdminAction.bind(null, u.id)} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-3">
          <Button asChild variant="outline" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={qs(page - 1)}>Previous</Link>
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pages} · {total} users</span>
          <Button asChild variant="outline" className={page >= pages ? "pointer-events-none opacity-50" : ""}>
            <Link href={qs(page + 1)}>Next</Link>
          </Button>
        </nav>
      ) : null}
    </>
  );
}
