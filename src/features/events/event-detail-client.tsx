"use client";

import { EventCard, type EventRow } from "./event-list";

/** The event card on the event page (client component because the RSVP buttons talk to the database). */
export function EventDetailClient({ event, signedIn }: { event: EventRow; signedIn: boolean }) {
  return <EventCard event={event} signedIn={signedIn} />;
}
