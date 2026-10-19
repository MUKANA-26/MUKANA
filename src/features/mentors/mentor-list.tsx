"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, GraduationCap, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { useAvatarUrls } from "@/lib/avatars-client";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import { PersonRow } from "@/features/network/person-row";

interface Mentor {
  id: string;
  full_name: string;
  headline: string | null;
  mentor_topics: string[] | null;
  avatar_path: string | null;
  verified_badge: boolean;
  request_status: "pending" | "accepted" | "declined" | null;
}
interface MentorRequest {
  id: string;
  other_id: string;
  other_name: string;
  direction: "received" | "sent";
  message: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}
const clean = (m: string) => m.replace(/^.*?:\s*/, "");

export function MentorBoard() {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [term, setTerm] = React.useState("");
  const [q, setQ] = React.useState("");
  const [asking, setAsking] = React.useState<Mentor | null>(null);
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setQ(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const mentors = useQuery({
    queryKey: ["mentors", "list", q],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_mentors", { p_topic: q || null });
      if (error) throw error;
      return (data ?? []) as Mentor[];
    },
  });
  const requests = useQuery({
    queryKey: ["mentors", "requests"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_mentorship_requests");
      if (error) throw error;
      return (data ?? []) as MentorRequest[];
    },
  });
  const avatars = useAvatarUrls((mentors.data ?? []).map((m) => m.avatar_path));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["mentors"] });

  const ask = async () => {
    if (!asking) return;
    setPending(true);
    const { error } = await supabase.rpc("request_mentorship", { p_mentor: asking.id, p_message: message });
    setPending(false);
    if (error) return void toast.error(clean(error.message));
    toast.success("Request sent");
    setAsking(null);
    setMessage("");
    void refresh();
  };
  const respond = async (id: string, accept: boolean) => {
    const { data, error } = await supabase.rpc("respond_mentorship", { p_id: id, p_accept: accept });
    if (error) return void toast.error(clean(error.message));
    toast.success(accept ? "Accepted. You can now chat." : "Declined");
    void refresh();
    if (accept && data) router.push(`/messages/${data as string}`);
  };

  const incoming = (requests.data ?? []).filter((r) => r.direction === "received" && r.status === "pending");

  return (
    <div className="space-y-6">
      {incoming.length > 0 ? (
        <section aria-labelledby="inc-h" className="space-y-2">
          <h2 id="inc-h" className="font-heading text-lg font-semibold">Requests for you</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {incoming.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{r.other_name}</p>
                  {r.message ? <p className="text-sm text-muted-foreground">{r.message}</p> : null}
                  <p className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void respond(r.id, false)}>
                    <X aria-hidden /> Decline
                  </Button>
                  <Button size="sm" variant="cta" onClick={() => void respond(r.id, true)}>
                    <Check aria-hidden /> Accept
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="find-h" className="space-y-3">
        <h2 id="find-h" className="font-heading text-lg font-semibold">Find a mentor</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by topic, e.g. careers, engineering, interviews" aria-label="Search mentors" className="h-11 w-full rounded-xl border border-input bg-surface pl-9 pr-3 text-sm" />
        </div>
        {mentors.isLoading ? (
          <SkeletonList count={3} />
        ) : (mentors.data ?? []).length === 0 ? (
          <EmptyState icon={<GraduationCap aria-hidden />} title="No mentors found" description="Members can offer mentorship from Settings, under Your public profile." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {(mentors.data ?? []).map((m) => (
              <li key={m.id}>
                <PersonRow
                  person={{ id: m.id, full_name: m.full_name, role: "candidate", headline: m.headline, company_name: null, avatar_path: m.avatar_path, verified_badge: m.verified_badge, reason: (m.mentor_topics ?? []).join(" · ") || null }}
                  avatarUrl={m.avatar_path ? (avatars[m.avatar_path] ?? null) : null}
                >
                  {m.request_status === "accepted" ? (
                    <Badge variant="success">Your mentor</Badge>
                  ) : m.request_status === "pending" ? (
                    <Badge variant="neutral">Request sent</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setAsking(m)}>
                      Ask to mentor me
                    </Button>
                  )}
                </PersonRow>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={asking !== null} onClose={() => setAsking(null)} title={`Ask ${asking?.full_name ?? ""} to mentor you`} description="Say what you hope to learn. They can accept or decline.">
        <div className="space-y-3">
          <Textarea aria-label="Your message" rows={4} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hello! I am a third-year student and would like advice on..." />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAsking(null)}>
              Cancel
            </Button>
            <Button variant="cta" loading={pending} onClick={() => void ask()}>
              Send request
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
