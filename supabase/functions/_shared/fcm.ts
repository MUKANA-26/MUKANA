// Firebase Cloud Messaging HTTP v1 sender using a service account (no Firebase Admin SDK needed).

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cached: { token: string; expires: number } | null = null;

function serviceAccount(): ServiceAccount {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
  return JSON.parse(raw) as ServiceAccount;
}

const b64url = (input: ArrayBuffer | string) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function signJwt(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  return `${header}.${claims}.${b64url(signature)}`;
}

export async function getFcmAccessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const sa = serviceAccount();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: await signJwt(sa) }),
  });
  if (!res.ok) throw new Error(`Google OAuth failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

export interface FcmResult {
  ok: boolean;
  /** True when FCM says the registration token is permanently invalid and should be deleted. */
  invalidToken?: boolean;
  status?: number;
}

export async function sendFcm(
  accessToken: string,
  token: string,
  payload: { title: string; body: string; url: string; tag: string; link: string },
): Promise<FcmResult> {
  const sa = serviceAccount();
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        // Data-only: the service worker (Serwist + FCM background handler) builds the notification.
        data: { title: payload.title, body: payload.body, url: payload.url, tag: payload.tag },
        webpush: { headers: { Urgency: "high", TTL: "86400" }, fcm_options: { link: payload.link } },
      },
    }),
  });
  if (res.ok) return { ok: true, status: res.status };
  let invalid = res.status === 404;
  try {
    const err = (await res.json()) as { error?: { status?: string; details?: { errorCode?: string }[] } };
    const code = err.error?.details?.find((d) => d.errorCode)?.errorCode ?? err.error?.status;
    if (code === "UNREGISTERED" || code === "INVALID_ARGUMENT") invalid = true;
  } catch {
    /* ignore body parse errors */
  }
  return { ok: false, invalidToken: invalid, status: res.status };
}
