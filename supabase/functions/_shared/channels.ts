// Notification delivery channels. Every channel implements the same interface, so adding WhatsApp
// later (Meta Cloud API) means writing one more class and registering it in `buildChannels()`.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getFcmAccessToken, sendFcm, type FcmResult } from "./fcm.ts";

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  data: Record<string, unknown>;
  email: string;
  full_name: string;
  push_enabled: boolean;
  email_enabled: boolean;
}

export interface ChannelResult {
  channel: string;
  sent: number;
  failed: number;
  detail?: string;
}

export interface NotificationChannel {
  readonly name: string;
  /** Whether this channel should handle the given notification (preferences, event type, config). */
  supports(n: NotificationRecord): boolean;
  send(n: NotificationRecord): Promise<ChannelResult>;
}

const siteUrl = () => (Deno.env.get("SITE_URL") ?? "http://localhost:3000").replace(/\/$/, "");

// --------------------------------------------------------------------------- push (FCM Web Push)
export class PushChannel implements NotificationChannel {
  readonly name = "push";
  constructor(private db: SupabaseClient) {}

  supports(n: NotificationRecord) {
    return n.push_enabled && Boolean(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON"));
  }

  async send(n: NotificationRecord): Promise<ChannelResult> {
    const { data: tokens } = await this.db.from("device_tokens").select("id, token").eq("user_id", n.user_id);
    if (!tokens?.length) return { channel: this.name, sent: 0, failed: 0, detail: "no devices" };

    const accessToken = await getFcmAccessToken();
    let sent = 0;
    let failed = 0;
    const invalid: string[] = [];
    await Promise.all(
      tokens.map(async (t: { id: string; token: string }) => {
        const result: FcmResult = await sendFcm(accessToken, t.token, {
          title: n.title,
          body: n.body,
          url: n.url ?? "/",
          tag: n.id,
          link: `${siteUrl()}${n.url ?? "/"}`,
        });
        if (result.ok) sent++;
        else {
          failed++;
          // Token is no longer valid (app uninstalled, permission revoked...): remove it automatically.
          if (result.invalidToken) invalid.push(t.id);
        }
      }),
    );
    if (invalid.length) await this.db.from("device_tokens").delete().in("id", invalid);
    return { channel: this.name, sent, failed, detail: invalid.length ? `removed ${invalid.length} invalid token(s)` : undefined };
  }
}

// --------------------------------------------------------------------------- email (Resend)
const EMAIL_TYPES = new Set(["interview_invite", "offer"]);

export class EmailChannel implements NotificationChannel {
  readonly name = "email";

  supports(n: NotificationRecord) {
    return n.email_enabled && EMAIL_TYPES.has(n.type) && Boolean(Deno.env.get("RESEND_API_KEY")) && Boolean(n.email);
  }

  async send(n: NotificationRecord): Promise<ChannelResult> {
    const from = Deno.env.get("EMAIL_FROM") ?? "Mukana <notifications@mukana.example>";
    const link = `${siteUrl()}${n.url ?? "/"}`;
    const name = n.full_name?.split(" ")[0] || "there";
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    const html = `<!doctype html><html><body style="margin:0;background:#f1f5fa;font-family:Arial,Helvetica,sans-serif;color:#032552">
      <div style="max-width:520px;margin:0 auto;padding:24px">
        <div style="background:#ffffff;border-radius:14px;padding:28px;border:1px solid #d5deeb">
          <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#032552">Mukana</p>
          <p style="margin:0 0 20px;font-size:12px;color:#4a5a73">Your Opportunity Starts Here.</p>
          <p style="margin:0 0 12px">Hi ${esc(name)},</p>
          <h1 style="font-size:20px;margin:0 0 8px">${esc(n.title)}</h1>
          <p style="margin:0 0 20px;line-height:1.5;white-space:pre-line">${esc(n.body)}</p>
          <a href="${esc(link)}" style="display:inline-block;background:#F8851B;color:#032552;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">Open Mukana</a>
          <p style="margin:24px 0 0;font-size:12px;color:#4a5a73">You get this email because it's an important update about your application. You can change email notifications in Settings.</p>
        </div>
      </div></body></html>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [n.email], subject: n.title, html, text: `${n.title}\n\n${n.body}\n\n${link}` }),
    });
    if (!res.ok) return { channel: this.name, sent: 0, failed: 1, detail: `resend ${res.status}` };
    return { channel: this.name, sent: 1, failed: 0 };
  }
}

// --------------------------------------------------------------------------- WhatsApp (not active)
// Skeleton for the future WhatsApp channel (Meta Cloud API). It is intentionally NOT registered in
// buildChannels(). When you add it, it must only send when the user has explicitly opted in
// (notification_preferences.whatsapp_opt_in = true and a verified whatsapp_number), and must use
// pre-approved message templates. See README, "Adding WhatsApp later".
export class WhatsAppChannel implements NotificationChannel {
  readonly name = "whatsapp";
  constructor(private db: SupabaseClient) {}

  supports(_n: NotificationRecord) {
    return false;
  }

  async send(_n: NotificationRecord): Promise<ChannelResult> {
    // const { data: prefs } = await this.db.from("notification_preferences")
    //   .select("whatsapp_opt_in, whatsapp_number").eq("user_id", n.user_id).maybeSingle();
    // if (!prefs?.whatsapp_opt_in || !prefs.whatsapp_number) return { channel: this.name, sent: 0, failed: 0, detail: "no opt-in" };
    // POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages with a template message.
    void this.db;
    return { channel: this.name, sent: 0, failed: 0, detail: "disabled" };
  }
}

export function buildChannels(db: SupabaseClient): NotificationChannel[] {
  return [new PushChannel(db), new EmailChannel()];
}
