// Delivers pending notifications over every enabled channel (FCM push, email).
// Triggered instantly by a database trigger (pg_net) and swept every 5 minutes by pg_cron.
import { buildChannels, type NotificationRecord } from "../_shared/channels.ts";
import { guard, json } from "../_shared/runtime.ts";

Deno.serve(
  guard(async (req, db) => {
    const body = await req.json().catch(() => ({}));
    const only = typeof body?.notification_id === "string" ? body.notification_id : null;

    // Atomically claims rows so concurrent runs never double-send.
    const { data, error } = await db.rpc("claim_pending_notifications", { p_limit: 100, p_only: only });
    if (error) throw error;
    const rows = (data ?? []) as NotificationRecord[];

    const channels = buildChannels(db);
    const summary = { processed: rows.length, push: 0, email: 0, failed: 0 };

    for (const n of rows) {
      for (const channel of channels) {
        if (!channel.supports(n)) continue;
        try {
          const result = await channel.send(n);
          if (channel.name === "push") summary.push += result.sent;
          if (channel.name === "email" && result.sent > 0) {
            summary.email += result.sent;
            await db.rpc("mark_notification_emailed", { p_id: n.id });
          }
          summary.failed += result.failed;
        } catch (e) {
          summary.failed++;
          console.error(`channel ${channel.name} failed for ${n.id}`, e);
        }
      }
    }
    return json(summary);
  }),
);
