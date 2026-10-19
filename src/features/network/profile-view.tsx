"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Award, BadgeCheck, Building2, Check, Ellipsis, Eye, GraduationCap, MapPin, MessageCircle, ShieldBan, ThumbsUp, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";
import { cn, timeAgo } from "@/lib/utils";
import { ReportButton } from "@/features/opportunities/opportunity-buttons";
import { useNetworkActions } from "./use-network-actions";

export interface PersonProfile {
  id: string;
  full_name: string;
  role: "candidate" | "employer" | "admin";
  avatar_path: string | null;
  cover_path: string | null;
  headline: string | null;
  verified_badge: boolean;
  open_to_work: boolean;
  mentor: boolean;
  mentor_topics: string[] | null;
  limited: boolean;
  company: { id: string; name: string; verified: boolean } | null;
  bio: string | null;
  institution: string | null;
  province: string | null;
  candidate_type: "attachee" | "graduate_trainee" | null;
  skills: { name: string; endorsements: number; endorsed_by_me: boolean }[];
  recommendations: { id: string; author_id: string; author_name: string; author_headline: string | null; body: string; created_at: string }[];
  badges: { name: string; score?: number }[];
  connections: number;
  followers: number;
  relation: {
    self: boolean;
    connected: boolean;
    pending_sent: boolean;
    pending_received: boolean;
    connection_id: string | null;
    following: boolean;
    can_message: boolean;
  };
}

export interface ProfileViews {
  total: number;
  recent: { id: string; name: string; headline: string | null; at: string }[];
}

function Controls({ person, me }: { person: PersonProfile; me: string }) {
  const actions = useNetworkActions();
  const router = useRouter();
  const [menu, setMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const r = person.relation;

  React.useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  if (r.self) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {r.connected ? (
        <Button variant="outline" size="sm" onClick={() => window.confirm(`Remove ${person.full_name} from your connections?`) && void actions.remove(person.id)} loading={actions.busy === `remove:${person.id}`}>
          <UserCheck aria-hidden /> Connected
        </Button>
      ) : r.pending_sent ? (
        <Button variant="outline" size="sm" onClick={() => void actions.remove(person.id, "Invitation withdrawn")} loading={actions.busy === `remove:${person.id}`}>
          Pending · Withdraw
        </Button>
      ) : r.pending_received && r.connection_id ? (
        <>
          <Button variant="cta" size="sm" loading={actions.busy === `respond:${r.connection_id}`} onClick={() => void actions.respond(r.connection_id!, true)}>
            <Check aria-hidden /> Accept
          </Button>
          <Button variant="outline" size="sm" onClick={() => void actions.respond(r.connection_id!, false)}>
            <X aria-hidden /> Decline
          </Button>
        </>
      ) : (
        <Button variant="cta" size="sm" loading={actions.busy === `connect:${person.id}`} onClick={() => void actions.connect(person.id)}>
          <UserPlus aria-hidden /> Connect
        </Button>
      )}
      {r.can_message ? (
        <Button variant={r.connected ? "cta" : "outline"} size="sm" loading={actions.busy === `message:${person.id}`} onClick={() => void actions.message(person.id)}>
          <MessageCircle aria-hidden /> Message
        </Button>
      ) : null}
      <Button variant="outline" size="sm" aria-pressed={r.following} loading={actions.busy === `follow:${person.id}`} onClick={() => void actions.follow(me, person.id, !r.following)}>
        {r.following ? "Following" : "Follow"}
      </Button>
      <div ref={menuRef} className="relative">
        <Button variant="ghost" size="icon" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="size-9 min-w-9">
          <Ellipsis aria-hidden />
        </Button>
        {menu ? (
          <div role="menu" className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-xl">
            {r.connected ? (
              <button type="button" role="menuitem" className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted" onClick={() => { setMenu(false); if (window.confirm(`Remove ${person.full_name} from your connections?`)) void actions.remove(person.id); }}>
                <UserMinus className="size-4" aria-hidden /> Remove connection
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-danger hover:bg-surface-muted"
              onClick={async () => {
                setMenu(false);
                if (!window.confirm(`Block ${person.full_name}? You won't see each other's posts or be able to message each other.`)) return;
                if (await actions.block(me, person.id, true)) router.push("/network");
              }}
            >
              <ShieldBan className="size-4" aria-hidden /> Block
            </button>
            <ReportButton targetType="user" targetId={person.id} label="Report" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Skills({ person, canEndorse }: { person: PersonProfile; canEndorse: boolean }) {
  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  if (person.skills.length === 0) return null;
  const endorse = async (skill: string, on: boolean) => {
    setBusy(skill);
    const { error } = await supabase.rpc("endorse_skill", { p_profile: person.id, p_skill: skill, p_on: on });
    setBusy(null);
    if (error) return void toast.error(error.message.replace(/^.*?:\s*/, ""));
    router.refresh();
  };
  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm" aria-labelledby="skills-h">
      <h2 id="skills-h" className="font-heading text-lg font-semibold">Skills</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {person.skills.map((s) => (
          <li key={s.name} className="flex items-center gap-1 rounded-full border border-border bg-surface-muted py-1 pl-3 pr-1 text-sm">
            <span className="font-medium">{s.name}</span>
            {s.endorsements > 0 ? <span className="text-xs text-muted-foreground">· {s.endorsements}</span> : null}
            {canEndorse ? (
              <button
                type="button"
                disabled={busy === s.name}
                onClick={() => void endorse(s.name, !s.endorsed_by_me)}
                aria-pressed={s.endorsed_by_me}
                aria-label={s.endorsed_by_me ? `Remove your endorsement of ${s.name}` : `Endorse ${s.name}`}
                className={cn("ml-1 grid size-7 place-items-center rounded-full hover:bg-surface", s.endorsed_by_me ? "text-link" : "text-muted-foreground")}
              >
                <ThumbsUp className={cn("size-4", s.endorsed_by_me && "fill-current")} aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Recommendations({ person, canWrite }: { person: PersonProfile; canWrite: boolean }) {
  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const self = person.relation.self;
  if (!person.recommendations.length && !canWrite) return null;

  const submit = async () => {
    setPending(true);
    const { error } = await supabase.rpc("write_recommendation", { p_recipient: person.id, p_body: text });
    setPending(false);
    if (error) return void toast.error(error.message.replace(/^.*?:\s*/, ""));
    toast.success("Recommendation sent. They choose whether to show it.");
    setOpen(false);
    setText("");
  };
  const respond = async (id: string, show: boolean) => {
    const { error } = await supabase.rpc("respond_recommendation", { p_id: id, p_show: show });
    if (error) return void toast.error(error.message);
    toast.success(show ? "Recommendation is now on your profile" : "Recommendation hidden");
    router.refresh();
  };
  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm" aria-labelledby="rec-h">
      <div className="flex items-center justify-between gap-2">
        <h2 id="rec-h" className="font-heading text-lg font-semibold">Recommendations</h2>
        {canWrite ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Write one
          </Button>
        ) : null}
      </div>
      {person.recommendations.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No recommendations yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {person.recommendations.map((r) => (
            <li key={r.id} className="rounded-lg bg-surface-muted p-3">
              <p className="whitespace-pre-line text-sm">{r.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                <Link href={`/people/${r.author_id}`} className="font-semibold text-foreground hover:underline">{r.author_name}</Link>
                {r.author_headline ? ` · ${r.author_headline}` : ""} · {timeAgo(r.created_at)}
              </p>
              {self ? (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void respond(r.id, true)}>Show on my profile</Button>
                  <Button size="sm" variant="ghost" onClick={() => void respond(r.id, false)}>Hide</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={`Recommend ${person.full_name}`} description="Say what it's like to work or study with them (20 characters or more).">
        <div className="space-y-3">
          <Textarea rows={5} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your recommendation" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="cta" loading={pending} disabled={text.trim().length < 20} onClick={() => void submit()}>Send</Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}

/** A member's profile page content: cover, photo, relationship buttons, about, skills, recommendations and badges. */
export function ProfileView({ person, me, avatarUrl, coverUrl, views }: { person: PersonProfile; me: string; avatarUrl: string | null; coverUrl: string | null; views: ProfileViews | null }) {
  const r = person.relation;
  const roleLabel = person.role === "admin" ? "Mukana team" : person.role === "employer" ? "Employer" : person.candidate_type === "graduate_trainee" ? "Graduate trainee" : "Attachee";
  return (
    <div className="space-y-4">
      <header className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="h-28 bg-gradient-to-r from-primary to-link sm:h-40">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="px-4 pb-4">
          <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-14">
            <Avatar url={avatarUrl} name={person.full_name} size="xl" className="ring-4 ring-surface" />
            {r.self ? (
              <Button asChild variant="outline" size="sm">
                <Link href={person.role === "employer" ? "/employer/settings" : "/candidate/settings"}>Edit profile</Link>
              </Button>
            ) : null}
          </div>
          <h1 className="mt-3 flex flex-wrap items-center gap-x-2 font-heading text-xl font-semibold">
            {person.full_name}
            {person.verified_badge ? <BadgeCheck className="size-5 text-link" aria-label="Verified by Mukana" /> : null}
          </h1>
          {person.headline ? <p className="text-sm">{person.headline}</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <Badge variant={person.role === "employer" ? "info" : person.role === "admin" ? "cta" : "neutral"}>{roleLabel}</Badge>
            {person.open_to_work ? <Badge variant="success">Open to work</Badge> : null}
            {person.mentor ? <Badge variant="info">Mentor</Badge> : null}
            {person.company ? (
              <Link href={`/companies/${person.company.id}`} className="inline-flex items-center gap-1.5 text-link hover:underline">
                <Building2 className="size-4" aria-hidden /> {person.company.name}
              </Link>
            ) : null}
            {person.institution ? (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="size-4" aria-hidden /> {person.institution}
              </span>
            ) : null}
            {person.province ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden /> {person.province}
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong className="text-foreground">{person.connections}</strong> connection{person.connections === 1 ? "" : "s"} · <strong className="text-foreground">{person.followers}</strong> follower{person.followers === 1 ? "" : "s"}
          </p>
          <div className="mt-3">
            <Controls person={person} me={me} />
          </div>
        </div>
      </header>

      {person.limited ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">This member shares their full profile only with people they are connected with. Send an invitation to see more.</p>
      ) : null}

      {person.bio ? (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm" aria-labelledby="about-h">
          <h2 id="about-h" className="font-heading text-lg font-semibold">About</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6">{person.bio}</p>
        </section>
      ) : null}

      <Skills person={person} canEndorse={r.connected && !r.self} />

      {person.badges.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm" aria-labelledby="badges-h">
          <h2 id="badges-h" className="font-heading text-lg font-semibold">Skill badges</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {person.badges.map((b) => (
              <li key={b.name} className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success-soft-foreground">
                <Award className="size-4" aria-hidden /> {b.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Recommendations person={person} canWrite={r.connected && !r.self} />

      {r.self && views ? (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm" aria-labelledby="views-h">
          <h2 id="views-h" className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Eye className="size-5" aria-hidden /> Who viewed your profile
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{views.total} view{views.total === 1 ? "" : "s"} in the last 30 days. Only you can see this.</p>
          {views.recent.length > 0 ? (
            <ul className="mt-3 divide-y divide-border">
              {views.recent.map((v, i) => (
                <li key={`${v.id}-${i}`} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <Link href={`/people/${v.id}`} className="font-semibold hover:underline">{v.name}</Link>
                    {v.headline ? <span className="block truncate text-xs text-muted-foreground">{v.headline}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(v.at)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
