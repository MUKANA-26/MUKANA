import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/roles";

/**
 * Handles email-confirmation, magic-link, password-recovery and Google sign-in redirects from Supabase Auth.
 * Supports both the PKCE `code` flow and the `token_hash` flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"), "/");
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }

  if (!ok) return NextResponse.redirect(`${origin}/sign-in?error=callback`);

  // Two-step verification still outstanding? Finish it before anything else.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return NextResponse.redirect(`${origin}/sign-in/verify?next=${encodeURIComponent(next)}`);
  }
  // First Google sign-in: choose candidate or employer once.
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", userData.user.id).maybeSingle();
    if (profile && profile.onboarded === false) return NextResponse.redirect(`${origin}/welcome?next=${encodeURIComponent(next)}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
