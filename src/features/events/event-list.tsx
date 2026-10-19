"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, ExternalLink, MapPin, Plus, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, SkeletonList } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDateTime } from "@/lib/utils";

export interface EventRow {
  id: string;
  kind: "event" | "webinar" | "career_fair";
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  online_url: string | null;
  capacity: number | null;
  status: string;
  host_name: string | null;
  company_name: string | null;
  rsvp_count: number | string;
  going: boolean;
  exhibitors: number | string;
  mine: boolean;
}

export const KIND_LABEL = { event: "Event", webinar: "Webinar", career_fair: "Career fair" } as const;
const clean = (m: string) => m.replace(/^.*?:\s*/, "");

export function useEvents(kind: string, past: boolean) {
  const supabase = React.useMemo(() => createClient(), []);
  return useQuery({
    queryKey: ["events", kind, past],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_events", { p_kind: kind || null, p_past: past });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
    staleTime: 20_000,
  });
}

/** Join / leave / cancel buttons shared by the list and the event page. */
export function EventActions({ event, signedIn, canExhibit }: { event: EventRow; signedIn: boolean; canExhibit?: boolean }) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const full = event.capacity != null && Number(event.rsvp_count) >= event.capacity && !event.going;
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return void toast.error(clean(error.message));
    toast.success(ok);
    void queryClient.invalidateQueries({ queryKey: ["events"] });
  };
  if (event.status === "cancelled") return <Badge variant="danger">Cancelled</Badge>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {signedIn ? (
        <Button size="sm" variant={event.going ? "outline" : "cta"} loading={busy} disabled={full} onClick={() => void run(() => supabase.rpc("rsvp_event", { p_event: event.id, p_going: !event.going }), event.going ? "You are no longer going" : "You are going")}>
          {event.going ? "Going ✓ (cancel)" : full ? "Full" : "I'm going"}
        </Button>
      ) : (
        <Button asChild size="sm" variant="cta">
          <Link href={`/sign-in?next=/events/${event.id}`}>Sign in to join</Link>
        </Button>
      )}
      {canExhibit && event.kind === "career_fair" ? (
        <Button size="sm" variant="outline" loading={busy} onClick={() => void run(() => supabase.rpc("exhibit_at_event", { p_event: event.id, p_on: true }), "Your company is now listed as an exhibitor")}>
          Exhibit with my company
        </Button>
      ) : null}
      {event.mine ? (
        <Button size="sm" variant="ghost" className="text-danger" loading={busy} onClick={() => window.confirm("Cancel this event? Attendees are notified.") && void run(() => supabase.rpc("cancel_event", { p_id: event.id }), "Event cancelled")}>
          Cancel event
        </Button>
      ) : null}
    </div>
  );
}

export function EventCard({ event, signedIn, canExhibit }: { event: EventRow; signedIn: boolean; canExhibit?: boolean }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={event.kind === "career_fair" ? "cta" : event.kind === "webinar" ? "info" : "neutral"}>{KIND_LABEL[event.kind]}</Badge>
        <span className="text-xs text-muted-foreground">{Number(event.rsvp_count)} going{event.capacity ? ` · ${event.capacity} places` : ""}</span>
      </div>
      <h3 className="mt-2 font-heading text-lg font-semibold">
        <Link href={`/events/${event.id}`} className="hover:underline">
          {event.title}
        </Link>
      </h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden /> {formatDateTime(event.starts_at)}
        </span>
        {event.location ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden /> {event.location}
          </span>
        ) : null}
        {event.online_url ? (
          <span className="inline-flex items-center gap-1.5">
            <Video className="size-4" aria-hidden /> Online
          </span>
        ) : null}
      </p>
      {event.description ? <p className="mt-2 line-clamp-2 text-sm">{event.description}</p> : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <EventActions event={event} signedIn={signedIn} canExhibit={canExhibit} />
        {event.online_url && event.going ? (
          <a href={event.online_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
            Join link <ExternalLink className="size-4" aria-hidden />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function HostDialog({ open, onClose, isAdmin }: { open: boolean; onClose: () => void; isAdmin: boolean }) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [v, setV] = React.useState({ kind: "event", title: "", description: "", starts: "", ends: "", location: "", url: "", capacity: "" });
  const [pending, setPending] = React.useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const submit = async () => {
    setPending(true);
    const { error } = await supabase.rpc("create_event", {
      p_kind: v.kind,
      p_title: v.title,
      p_description: v.description || null,
      p_starts_at: v.starts ? new Date(v.starts).toISOString() : null,
      p_ends_at: v.ends ? new Date(v.ends).toISOString() : null,
      p_location: v.location || null,
      p_online_url: v.url || null,
      p_capacity: v.capacity ? Number(v.capacity) : null,
    });
    setPending(false);
    if (error) return void toast.error(clean(error.message));
    toast.success("Event published");
    onClose();
    void queryClient.invalidateQueries({ queryKey: ["events"] });
  };
  return (
    <Dialog open={open} onClose={onClose} title="Host an event" description={isAdmin ? "Events appear for every member." : "Verified companies can host webinars, events and career fairs."} className="max-w-lg">
      <div className="space-y-3">
        <Field label="Type" htmlFor="ev-kind">
          <Select id="ev-kind" value={v.kind} onChange={set("kind")}>
            <option value="event">Event</option>
            <option value="webinar">Webinar</option>
            <option value="career_fair">Career fair</option>
          </Select>
        </Field>
        <Field label="Title" htmlFor="ev-title" required>
          <Input id="ev-title" value={v.title} onChange={set("title")} maxLength={160} />
        </Field>
        <Field label="Description" htmlFor="ev-desc">
          <Textarea id="ev-desc" rows={3} value={v.description} onChange={set("description")} maxLength={4000} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts" htmlFor="ev-start" required>
            <Input id="ev-start" type="datetime-local" value={v.starts} onChange={set("starts")} />
          </Field>
          <Field label="Ends (optional)" htmlFor="ev-end">
            <Input id="ev-end" type="datetime-local" value={v.ends} onChange={set("ends")} />
          </Field>
        </div>
        <Field label="Venue" htmlFor="ev-loc">
          <Input id="ev-loc" value={v.location} onChange={set("location")} maxLength={160} placeholder="e.g. Harare International Conference Centre" />
        </Field>
        <Field label="Online link" htmlFor="ev-url" hint="Shown to people who join. Venue or link is required.">
          <Input id="ev-url" type="url" value={v.url} onChange={set("url")} placeholder="https://" />
        </Field>
        <Field label="Places (optional)" htmlFor="ev-cap">
          <Input id="ev-cap" inputMode="numeric" value={v.capacity} onChange={(e) => setV((s) => ({ ...s, capacity: e.target.value.replace(/\D/g, "") }))} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="cta" loading={pending} disabled={v.title.trim().length < 3 || !v.starts} onClick={() => void submit()}>
            Publish
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function EventBrowser({ signedIn, canHost, isAdmin, canExhibit }: { signedIn: boolean; canHost: boolean; isAdmin: boolean; canExhibit: boolean }) {
  const [past, setPast] = React.useState(false);
  const [kind, setKind] = React.useState("");
  const [hosting, setHosting] = React.useState(false);
  const events = useEvents(kind, past);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="When">
          {[
            { v: false, l: "Upcoming" },
            { v: true, l: "Past" },
          ].map((t) => (
            <button key={t.l} type="button" role="tab" aria-selected={past === t.v} onClick={() => setPast(t.v)} className={cn("h-9 rounded-lg px-4 text-sm font-medium", past === t.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted")}>
              {t.l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 w-40">
            <option value="">All types</option>
            <option value="event">Events</option>
            <option value="webinar">Webinars</option>
            <option value="career_fair">Career fairs</option>
          </Select>
          {canHost ? (
            <Button size="sm" variant="cta" onClick={() => setHosting(true)}>
              <Plus aria-hidden /> Host
            </Button>
          ) : null}
        </div>
      </div>
      {events.isLoading ? (
        <SkeletonList count={3} />
      ) : (events.data ?? []).length === 0 ? (
        <EmptyState icon={<CalendarDays aria-hidden />} title={past ? "No past events" : "No upcoming events"} description="Webinars, meet-ups and career fairs from employers and the Mukana team will show up here." />
      ) : (
        <ul className="space-y-3">
          {(events.data ?? []).map((e) => (
            <li key={e.id}>
              <EventCard event={e} signedIn={signedIn} canExhibit={canExhibit} />
            </li>
          ))}
        </ul>
      )}
      {canHost ? <HostDialog open={hosting} onClose={() => setHosting(false)} isAdmin={isAdmin} /> : null}
    </div>
  );
}
