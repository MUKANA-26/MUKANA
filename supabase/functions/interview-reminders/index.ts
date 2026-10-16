// Sends reminders 24 hours before every scheduled/confirmed interview (to candidate and employer).
// Scheduled hourly.
import { guard, json } from "../_shared/runtime.ts";

Deno.serve(
  guard(async (_req, db) => {
    const { data, error } = await db.rpc("generate_interview_reminders");
    if (error) throw error;
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notifications`, {
      method: "POST",
      headers: { "x-cron-secret": Deno.env.get("CRON_SECRET")!, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => undefined);
    return json({ interviews_reminded: data });
  }),
);
