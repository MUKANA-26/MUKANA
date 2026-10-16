/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { NetworkOnly, Serwist, type PrecacheEntry, type RuntimeCaching, type SerwistGlobalConfig } from "serwist";
import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

/**
 * Private data is NEVER cached by the service worker: Supabase REST/Storage/Auth calls,
 * our own /api routes and anything carrying a signed token always go to the network.
 */
const neverCache: RuntimeCaching[] = [
  {
    matcher: ({ url }) => url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in"),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ url, sameOrigin }) =>
      sameOrigin && (url.pathname.startsWith("/api/") || url.searchParams.has("token") || url.pathname.startsWith("/auth/")),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request }) => request.destination === "document" && /\.pdf($|\?)/i.test(request.url),
    handler: new NetworkOnly(),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false, // the UI asks the user to refresh ("New version available")
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...neverCache, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
  if (event.data?.type === "CLEAR_PRIVATE_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith("serwist-precache")).map((k) => caches.delete(k)))),
    );
  }
});

// ---------------------------------------------------------------------------------------
// Firebase Cloud Messaging (Web Push) lives in this same service worker.
// The public Firebase web config is handed over through the registration URL (?fb=...).
// ---------------------------------------------------------------------------------------
try {
  const raw = new URL(self.location.href).searchParams.get("fb");
  if (raw) {
    const config = JSON.parse(raw);
    if (config?.apiKey && config?.messagingSenderId) {
      const app = initializeApp(config);
      const messaging = getMessaging(app);
      onBackgroundMessage(messaging, (payload) => {
        const data = (payload.data ?? {}) as Record<string, string>;
        const title = data.title ?? payload.notification?.title ?? "Mukana";
        const body = data.body ?? payload.notification?.body ?? "";
        void self.registration.showNotification(title, {
          body,
          icon: "/icons/icon-192.png",
          badge: "/icons/favicon-32.png",
          tag: data.tag,
          data: { url: data.url ?? "/" },
        });
      });
    }
  }
} catch {
  // Push is optional; never let it break offline support.
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data?.url as string) ?? "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && new URL(client.url).origin === self.location.origin) {
          void client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
