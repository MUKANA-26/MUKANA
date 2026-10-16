import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ROLE_HOME, isRole, roleForPath, type Role } from "@/lib/roles";

const isDev = process.env.NODE_ENV === "development";

function buildCsp(nonce: string) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "https://*.supabase.co";
  const supabaseWs = supabase.replace(/^https/, "wss");
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase} https://*.supabase.co`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs} https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://fcm.googleapis.com https://firebaseinstallations.googleapis.com${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    `media-src 'self' blob: ${supabase} https://*.supabase.co`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const { pathname } = request.nextUrl;

  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const protectedRole = roleForPath(pathname);
  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up" || pathname === "/forgot-password";

  if (supabaseConfigured) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });

    // Refreshes the session cookie and verifies the JWT signature.
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    const signedIn = Boolean(claims?.sub);

    let role: Role | null = null;
    if (signedIn) {
      const fromClaims = (claims as { app_metadata?: { role?: unknown } }).app_metadata?.role;
      if (isRole(fromClaims)) {
        role = fromClaims;
      } else {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", claims!.sub).maybeSingle();
        if (isRole(profile?.role)) role = profile.role;
      }
    }

    if (protectedRole) {
      if (!signedIn) {
        const url = request.nextUrl.clone();
        url.pathname = "/sign-in";
        url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
        return withSecurity(NextResponse.redirect(url), csp, response);
      }
      if (role && role !== protectedRole) {
        const url = request.nextUrl.clone();
        url.pathname = ROLE_HOME[role];
        url.search = "";
        return withSecurity(NextResponse.redirect(url), csp, response);
      }
    } else if (isAuthPage && signedIn && role) {
      const url = request.nextUrl.clone();
      url.pathname = ROLE_HOME[role];
      url.search = "";
      return withSecurity(NextResponse.redirect(url), csp, response);
    }
  } else if (protectedRole) {
    // Without Supabase configured nothing private can be served.
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    return withSecurity(NextResponse.redirect(url), csp, response);
  }

  return withSecurity(response, csp);
}

/** Applies the CSP to a response, carrying over any refreshed session cookies. */
function withSecurity(target: NextResponse, csp: string, cookieSource?: NextResponse) {
  cookieSource?.cookies.getAll().forEach((c) => target.cookies.set(c));
  target.headers.set("Content-Security-Policy", csp);
  target.headers.set("Cache-Control", target.headers.get("Cache-Control") ?? "private, no-cache");
  return target;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline|icons/|brand/|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
