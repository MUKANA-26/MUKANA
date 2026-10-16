"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { VAPID_KEY, firebasePublicConfig } from "./config";
import { createClient } from "@/lib/supabase/client";

function app(): FirebaseApp | null {
  const config = firebasePublicConfig();
  if (!config) return null;
  return getApps().length ? getApp() : initializeApp(config);
}

export type PushState = "unsupported" | "unconfigured" | "denied" | "default" | "granted";

export async function currentPushState(): Promise<PushState> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (!firebasePublicConfig() || !VAPID_KEY) return "unconfigured";
  const { isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return "unsupported";
  return Notification.permission as PushState;
}

/**
 * Called ONLY from a button tap (never on page load). Asks for permission, gets an FCM token using the
 * app's single service worker registration, and stores it against the signed-in user.
 */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  const firebase = app();
  if (!firebase || !VAPID_KEY) return { ok: false, error: "Push notifications are not configured for this site yet." };
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return { ok: false, error: "This browser doesn't support push notifications." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: permission === "denied" ? "Notifications are blocked. Allow them in your browser or phone settings, then try again." : "Permission was not granted." };
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(firebase), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return { ok: false, error: "Couldn't get a notification token. Please try again." };
    const { error } = await createClient().rpc("register_device_token", { p_token: token, p_user_agent: navigator.userAgent });
    if (error) return { ok: false, error: "Couldn't save this device. Please try again." };
    try {
      localStorage.setItem("mukana:push-token", token);
    } catch {
      /* optional */
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't turn on notifications. In production the service worker must be active." };
  }
}

export async function disablePush(): Promise<void> {
  const firebase = app();
  if (!firebase) return;
  let token: string | null = null;
  try {
    token = localStorage.getItem("mukana:push-token");
  } catch {
    /* optional */
  }
  const { getMessaging, deleteToken } = await import("firebase/messaging");
  try {
    await deleteToken(getMessaging(firebase));
  } catch {
    /* ignore */
  }
  if (token) await createClient().from("device_tokens").delete().eq("token", token);
  try {
    localStorage.removeItem("mukana:push-token");
  } catch {
    /* optional */
  }
}

/** While the app is open and focused, show incoming pushes as toasts. */
export async function listenForeground(onPush: (title: string, body: string, url?: string) => void): Promise<() => void> {
  const firebase = app();
  if (!firebase || typeof Notification === "undefined" || Notification.permission !== "granted") return () => undefined;
  const { getMessaging, onMessage, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return () => undefined;
  return onMessage(getMessaging(firebase), (payload) => {
    const d = (payload.data ?? {}) as Record<string, string>;
    onPush(d.title ?? payload.notification?.title ?? "Mukana", d.body ?? payload.notification?.body ?? "", d.url);
  });
}
