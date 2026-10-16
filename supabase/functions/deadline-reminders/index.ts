// Creates "closing in 3 days / 1 day" reminders for candidates who saved an opportunity,
// then asks send-notifications to deliver them. Scheduled daily at 08:00 Harare time.
import { guard, json } from "../_shared/runtime.ts";

Deno.serve(
  guard(async (_req, db) => {
    const { data, error } = await db.rpc("generate_deadline_reminders");
    if (error) throw error;
    // The notification rows trigger delivery themselves; this call just flushes anything left over.
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notifications`, {
      method: "POST",
      headers: { "x-cron-secret": Deno.env.get("CRON_SECRET")!, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => undefined);
    return json({ reminders_created: data });
  }),
);
