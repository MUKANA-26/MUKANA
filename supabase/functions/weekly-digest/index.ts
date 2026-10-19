// Creates each candidate's "weekly picks" notification (best new matches of the past 7 days),
// then asks send-notifications to deliver them. Scheduled every Monday at 09:00 Harare time.
import { guard, json } from "../_shared/runtime.ts";

Deno.serve(
  guard(async (_req, db) => {
    const { data, error } = await db.rpc("generate_weekly_digest");
    if (error) throw error;
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notifications`, {
      method: "POST",
      headers: { "x-cron-secret": Deno.env.get("CRON_SECRET")!, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => undefined);
    return json({ digests_created: data });
  }),
);
