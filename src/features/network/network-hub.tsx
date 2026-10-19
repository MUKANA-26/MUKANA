"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, MessageCircle, Search, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { useAvatarUrls } from "@/lib/avatars-client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useT } from "@/components/prefs-provider";
import { PersonRow, type PersonRowData } from "./person-row";
import { useNetworkActions } from "./use-network-actions";

interface ConnectionRow {
  connection_id: string;
  user_id: string;
  full_name: string;
  role: "candidate" | "employer" | "admin";
  headline: string | null;
  company_name: string | null;
  avatar_path: string | null;
  verified_badge: boolean | null;
}

type Tab = "discover" | "invitations" | "connections" | "sent";

const asPerson = (c: ConnectionRow): PersonRowData => ({ id: c.user_id, full_name: c.full_name, role: c.role, headline: c.headline, company_name: c.company_name, avatar_path: c.avatar_path, verified_badge: c.verified_badge });

function useConnections(kind: "accepted" | "received" | "sent") {
  const supabase = React.useMemo(() => createClient(), []);
  return useQuery({
    queryKey: ["network", "connections", kind],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_connections", { p_kind: kind });
      if (error) throw error;
      return (data ?? []) as ConnectionRow[];
    },
    staleTime: 15_000,
  });
}

function Discover() {
  const supabase = React.useMemo(() => createClient(), []);
  const actions = useNetworkActions();
  const [term, setTerm] = React.useState("");
  const [q, setQ] = React.useState("");
  const [requested, setRequested] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    const t = setTimeout(() => setQ(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const searching = q.length >= 2;
  const people = useQuery({
    queryKey: ["network", searching ? "search" : "suggestions", q],
    queryFn: async () => {
      const { data, error } = searching ? await supabase.rpc("search_people", { p_q: q, p_limit: 20 }) : await supabase.rpc("people_you_may_know", { p_limit: 12 });
      if (error) throw error;
      return (data ?? []) as PersonRowData[];
    },
    staleTime: 30_000,
  });
  const avatars = useAvatarUrls((people.data ?? []).map((p) => p.avatar_path));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search people by name, school, skill or company"
          aria-label="Search people"
          className="h-11 w-full rounded-xl border border-input bg-surface pl-9 pr-3 text-sm"
        />
      </div>
      <h2 className="text-sm font-semibold text-muted-foreground">{searching ? "Search results" : "People you may know"}</h2>
      {people.isLoading ? (
        <SkeletonList count={4} />
      ) : people.isError ? (
        <EmptyState title="Couldn't load people" description="Check your connection and try again." action={<Button variant="outline" onClick={() => void people.refetch()}>Try again</Button>} />
      ) : (people.data ?? []).length === 0 ? (
        <EmptyState icon={<Users aria-hidden />} title={searching ? "No one found" : "No suggestions yet"} description={searching ? "Try a different name, school, skill or company." : "Search for people you know to start building your network."} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {(people.data ?? []).map((p) => (
            <li key={p.id}>
              <PersonRow person={p} avatarUrl={p.avatar_path ? (avatars[p.avatar_path] ?? null) : null}>
                {requested.has(p.id) ? (
                  <span className="text-xs font-medium text-muted-foreground">Invitation sent</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={actions.busy === `connect:${p.id}`}
                    onClick={async () => {
                      if (await actions.connect(p.id)) setRequested((s) => new Set(s).add(p.id));
                    }}
                  >
                    <UserPlus aria-hidden /> Connect
                  </Button>
                )}
              </PersonRow>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Invitations() {
  const query = useConnections("received");
  const actions = useNetworkActions();
  const rows = query.data ?? [];
  const avatars = useAvatarUrls(rows.map((r) => r.avatar_path));
  if (query.isLoading) return <SkeletonList count={3} />;
  if (rows.length === 0) return <EmptyState icon={<UserPlus aria-hidden />} title="No invitations" description="When someone wants to connect with you, it shows up here." />;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {rows.map((c) => (
        <li key={c.connection_id}>
          <PersonRow person={asPerson(c)} avatarUrl={c.avatar_path ? (avatars[c.avatar_path] ?? null) : null}>
            <Button size="sm" variant="outline" aria-label={`Decline ${c.full_name}`} loading={actions.busy === `respond:${c.connection_id}`} onClick={() => void actions.respond(c.connection_id, false)}>
              <X aria-hidden /> <span className="hidden sm:inline">Decline</span>
            </Button>
            <Button size="sm" variant="cta" aria-label={`Accept ${c.full_name}`} loading={actions.busy === `respond:${c.connection_id}`} onClick={() => void actions.respond(c.connection_id, true)}>
              <Check aria-hidden /> <span className="hidden sm:inline">Accept</span>
            </Button>
          </PersonRow>
        </li>
      ))}
    </ul>
  );
}

function Connected() {
  const query = useConnections("accepted");
  const actions = useNetworkActions();
  const [filter, setFilter] = React.useState("");
  const rows = (query.data ?? []).filter((r) => !filter.trim() || r.full_name.toLowerCase().includes(filter.trim().toLowerCase()));
  const avatars = useAvatarUrls(rows.map((r) => r.avatar_path));
  if (query.isLoading) return <SkeletonList count={3} />;
  if ((query.data ?? []).length === 0) return <EmptyState icon={<Users aria-hidden />} title="No connections yet" description="Find people you know in Discover and send them an invitation." />;
  return (
    <div className="space-y-3">
      <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter your connections" aria-label="Filter your connections" className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm" />
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {rows.map((c) => (
          <li key={c.connection_id}>
            <PersonRow person={asPerson(c)} avatarUrl={c.avatar_path ? (avatars[c.avatar_path] ?? null) : null}>
              <Button size="sm" variant="outline" aria-label={`Message ${c.full_name}`} loading={actions.busy === `message:${c.user_id}`} onClick={() => void actions.message(c.user_id)}>
                <MessageCircle aria-hidden /> <span className="hidden sm:inline">Message</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                loading={actions.busy === `remove:${c.user_id}`}
                onClick={() => {
                  if (window.confirm(`Remove ${c.full_name} from your connections?`)) void actions.remove(c.user_id);
                }}
              >
                Remove
              </Button>
            </PersonRow>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sent() {
  const query = useConnections("sent");
  const actions = useNetworkActions();
  const rows = query.data ?? [];
  const avatars = useAvatarUrls(rows.map((r) => r.avatar_path));
  if (query.isLoading) return <SkeletonList count={2} />;
  if (rows.length === 0) return <EmptyState icon={<UserPlus aria-hidden />} title="No pending invitations" description="Invitations you send wait here until the other person responds." />;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {rows.map((c) => (
        <li key={c.connection_id}>
          <PersonRow person={asPerson(c)} avatarUrl={c.avatar_path ? (avatars[c.avatar_path] ?? null) : null}>
            <Button size="sm" variant="outline" loading={actions.busy === `remove:${c.user_id}`} onClick={() => void actions.remove(c.user_id, "Invitation withdrawn")}>
              Withdraw
            </Button>
          </PersonRow>
        </li>
      ))}
    </ul>
  );
}

/** My network: discover people, answer invitations, see connections. */
export function NetworkHub() {
  const t = useT();
  const [tab, setTab] = React.useState<Tab>("discover");
  const invites = useConnections("received");
  const count = invites.data?.length ?? 0;
  const tabs: { id: Tab; label: string }[] = [
    { id: "discover", label: t("Discover") },
    { id: "invitations", label: count ? `${t("Invitations")} (${count})` : t("Invitations") },
    { id: "connections", label: t("Connections") },
    { id: "sent", label: t("Sent") },
  ];
  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="My network">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium", tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "discover" ? <Discover /> : tab === "invitations" ? <Invitations /> : tab === "connections" ? <Connected /> : <Sent />}
    </div>
  );
}
