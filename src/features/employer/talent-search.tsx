"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, Search, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/form";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { useAvatarUrls } from "@/lib/avatars-client";
import { createClient } from "@/lib/supabase/client";
import { PROVINCES } from "@/lib/zimbabwe";
import { cn } from "@/lib/utils";
import { PersonRow } from "@/features/network/person-row";

interface Candidate {
  id: string;
  full_name: string;
  headline: string | null;
  candidate_type: "attachee" | "graduate_trainee";
  institution: string | null;
  province: string | null;
  skills: string[];
  open_to_work: boolean;
  verified_badge: boolean;
  avatar_path: string | null;
  saved: boolean;
}
interface Recommended {
  user_id: string;
  score: number;
  reason: string | null;
  full_name: string;
  headline: string | null;
  avatar_path: string | null;
  open_to_work: boolean;
  saved: boolean;
}
export interface OpenOpportunity {
  id: string;
  title: string;
}

type Tab = "search" | "recommended" | "shortlist";
const clean = (m: string) => m.replace(/^.*?:\s*/, "");

/** Find candidates who chose to be discoverable, keep a shortlist, get recommendations and invite people to apply. */
export function TalentSearch({ companyId, opportunities }: { companyId: string; opportunities: OpenOpportunity[] }) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<Tab>("search");
  const [term, setTerm] = React.useState("");
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("");
  const [province, setProvince] = React.useState("");
  const [forOpp, setForOpp] = React.useState(opportunities[0]?.id ?? "");
  const [inviting, setInviting] = React.useState<{ id: string; name: string } | null>(null);
  const [inviteOpp, setInviteOpp] = React.useState(opportunities[0]?.id ?? "");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setQ(term.trim()), 350);
    return () => clearTimeout(t);
  }, [term]);

  const search = useQuery({
    queryKey: ["talent", "search", q, type, province],
    enabled: tab === "search",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_candidates", { p_q: q || null, p_type: type || null, p_province: province || null, p_skill: null, p_limit: 30, p_offset: 0 });
      if (error) throw error;
      return (data ?? []) as Candidate[];
    },
  });
  const recommended = useQuery({
    queryKey: ["talent", "recommended", forOpp],
    enabled: tab === "recommended" && Boolean(forOpp),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recommended_candidates", { p_opportunity: forOpp, p_limit: 20 });
      if (error) throw error;
      return (data ?? []) as Recommended[];
    },
  });
  const shortlist = useQuery({
    queryKey: ["talent", "shortlist", companyId],
    enabled: tab === "shortlist",
    queryFn: async () => {
      const { data: rows } = await supabase.from("saved_candidates").select("candidate_id").eq("company_id", companyId).order("created_at", { ascending: false }).limit(200);
      const ids = new Set((rows ?? []).map((r: { candidate_id: string }) => r.candidate_id));
      if (ids.size === 0) return [] as Candidate[];
      // Shortlisted people who later hide their profile from search are left out.
      const { data } = await supabase.rpc("search_candidates", { p_q: null, p_type: null, p_province: null, p_skill: null, p_limit: 50, p_offset: 0 });
      return ((data ?? []) as Candidate[]).filter((c) => ids.has(c.id));
    },
  });

  const avatars = useAvatarUrls([...(search.data ?? []).map((c) => c.avatar_path), ...(recommended.data ?? []).map((c) => c.avatar_path), ...(shortlist.data ?? []).map((c) => c.avatar_path)]);

  const toggleSave = async (candidateId: string, saved: boolean) => {
    const { error } = saved
      ? await supabase.from("saved_candidates").delete().eq("company_id", companyId).eq("candidate_id", candidateId)
      : await supabase.from("saved_candidates").insert({ company_id: companyId, candidate_id: candidateId });
    if (error) return void toast.error(clean(error.message));
    toast.success(saved ? "Removed from shortlist" : "Added to shortlist");
    void queryClient.invalidateQueries({ queryKey: ["talent"] });
  };

  const invite = async () => {
    if (!inviting) return;
    setSending(true);
    const { error } = await supabase.rpc("invite_to_apply", { p_candidate: inviting.id, p_opportunity: inviteOpp, p_message: message });
    setSending(false);
    if (error) return void toast.error(clean(error.message));
    toast.success(`${inviting.name} was invited to apply`);
    setInviting(null);
    setMessage("");
  };

  const actions = (id: string, name: string, saved: boolean) => (
    <>
      <Button size="sm" variant="ghost" aria-pressed={saved} aria-label={saved ? "Remove from shortlist" : "Add to shortlist"} onClick={() => void toggleSave(id, saved)} className={cn(saved && "text-link")}>
        <Bookmark className={cn(saved && "fill-current")} aria-hidden />
      </Button>
      <Button size="sm" variant="outline" disabled={opportunities.length === 0} onClick={() => setInviting({ id, name })}>
        <Send aria-hidden /> <span className="hidden sm:inline">Invite</span>
      </Button>
    </>
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "search", label: "Search" },
    { id: "recommended", label: "Recommended" },
    { id: "shortlist", label: "Shortlist" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Talent">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("h-9 flex-1 rounded-lg px-3 text-sm font-medium", tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "search" ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name, programme, school or skill" aria-label="Search candidates" className="h-11 w-full rounded-xl border border-input bg-surface pl-9 pr-3 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="Candidate type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Attachees and graduates</option>
              <option value="attachee">Attachees</option>
              <option value="graduate_trainee">Graduates</option>
            </Select>
            <Select aria-label="Province" value={province} onChange={(e) => setProvince(e.target.value)}>
              <option value="">Any province</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          {search.isLoading ? (
            <SkeletonList count={4} />
          ) : (search.data ?? []).length === 0 ? (
            <EmptyState icon={<Search aria-hidden />} title="No candidates found" description="Only candidates who chose to be discoverable appear here. Try fewer filters." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {(search.data ?? []).map((c) => (
                <li key={c.id}>
                  <PersonRow
                    person={{ id: c.id, full_name: c.full_name, role: "candidate", headline: c.headline, company_name: null, avatar_path: c.avatar_path, verified_badge: c.verified_badge, open_to_work: c.open_to_work, reason: c.skills.slice(0, 4).join(" · ") || null }}
                    avatarUrl={c.avatar_path ? (avatars[c.avatar_path] ?? null) : null}
                  >
                    {actions(c.id, c.full_name, c.saved)}
                  </PersonRow>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "recommended" ? (
        <div className="space-y-3">
          {opportunities.length === 0 ? (
            <EmptyState icon={<Sparkles aria-hidden />} title="Publish an opportunity first" description="Recommendations are based on one of your open opportunities." />
          ) : (
            <>
              <Select aria-label="Opportunity" value={forOpp} onChange={(e) => setForOpp(e.target.value)}>
                {opportunities.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </Select>
              {recommended.isLoading ? (
                <SkeletonList count={3} />
              ) : (recommended.data ?? []).length === 0 ? (
                <EmptyState icon={<Sparkles aria-hidden />} title="No strong matches yet" description="We show discoverable candidates who have not applied and match at least 30%." />
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                  {(recommended.data ?? []).map((c) => (
                    <li key={c.user_id}>
                      <PersonRow
                        person={{ id: c.user_id, full_name: c.full_name, role: "candidate", headline: c.headline, company_name: null, avatar_path: c.avatar_path, open_to_work: c.open_to_work, reason: `${c.score}% match${c.reason ? ` · ${c.reason}` : ""}` }}
                        avatarUrl={c.avatar_path ? (avatars[c.avatar_path] ?? null) : null}
                      >
                        {actions(c.user_id, c.full_name, c.saved)}
                      </PersonRow>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : null}

      {tab === "shortlist" ? (
        shortlist.isLoading ? (
          <SkeletonList count={3} />
        ) : (shortlist.data ?? []).length === 0 ? (
          <EmptyState icon={<Bookmark aria-hidden />} title="Your shortlist is empty" description="Tap the bookmark on a candidate to keep them here for later." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {(shortlist.data ?? []).map((c) => (
              <li key={c.id}>
                <PersonRow
                  person={{ id: c.id, full_name: c.full_name, role: "candidate", headline: c.headline, company_name: null, avatar_path: c.avatar_path, verified_badge: c.verified_badge, open_to_work: c.open_to_work }}
                  avatarUrl={c.avatar_path ? (avatars[c.avatar_path] ?? null) : null}
                >
                  {actions(c.id, c.full_name, true)}
                </PersonRow>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <Dialog open={inviting !== null} onClose={() => setInviting(null)} title={`Invite ${inviting?.name ?? ""} to apply`} description="They get a notification linking to the opportunity.">
        <div className="space-y-3">
          <Select aria-label="Opportunity" value={inviteOpp} onChange={(e) => setInviteOpp(e.target.value)}>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </Select>
          <Textarea aria-label="Message (optional)" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a short message (optional)" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInviting(null)}>
              Cancel
            </Button>
            <Button variant="cta" loading={sending} onClick={() => void invite()}>
              Send invitation
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
