import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { randomUUID } from "node:crypto";

const isDev = process.env.NODE_ENV === "development";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // The service worker is registered manually (see ServiceWorkerRegistrar) so the
  // Firebase config can be handed to it and the "new version" banner can be driven.
  register: false,
  disable: isDev,
  cacheOnNavigation: true,
  reloadOnOnline: false,
  additionalPrecacheEntries: [
    { url: "/offline", revision: randomUUID() },
    { url: "/brand/logo-full.png", revision: "1" },
    { url: "/brand/mark.png", revision: "1" },
  ],
});

// Content-Security-Policy for pages is built per request (with a nonce) in src/proxy.ts.
// The rules below are the static security headers that apply to every response.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a production build run side by side with `next dev` (e.g. MUKANA_DIST_DIR=.next-prod).
  distDir: process.env.MUKANA_DIST_DIR ?? ".next",
  // Dev can use Turbopack (the service worker is disabled in dev); builds use webpack because Serwist needs it.
  turbopack: {},
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The service worker is not covered by the page CSP; give it its own strict one.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self'; connect-src 'self' https://*.googleapis.com https://*.supabase.co https://fcm.googleapis.com; img-src 'self' data: https:",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default withSerwist(nextConfig);
