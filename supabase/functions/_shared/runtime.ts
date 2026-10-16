import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Service-role client (Edge Functions only: this key never reaches the browser). */
export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Constant-time comparison to avoid leaking the secret through timing. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** These functions are called by pg_cron / pg_net with the shared secret in `x-cron-secret`. */
export function authorised(req: Request): boolean {
  const secret = Deno.env.get("CRON_SECRET");
  const given = req.headers.get("x-cron-secret") ?? "";
  return Boolean(secret) && safeEqual(secret!, given);
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export function guard(handler: (req: Request, db: SupabaseClient) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!authorised(req)) return json({ error: "Unauthorised" }, 401);
    try {
      return await handler(req, serviceClient());
    } catch (e) {
      console.error(e);
      return json({ error: "Internal error" }, 500);
    }
  };
}
