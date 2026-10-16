// Closes published opportunities whose application deadline has passed (Africa/Harare date).
// Scheduled just after midnight Harare time. Applications are also refused in the database
// the moment a deadline passes, so a late run never lets anyone apply after the deadline.
import { guard, json } from "../_shared/runtime.ts";

Deno.serve(
  guard(async (_req, db) => {
    const { data, error } = await db.rpc("close_expired_opportunities");
    if (error) throw error;
    return json({ closed: data });
  }),
);
