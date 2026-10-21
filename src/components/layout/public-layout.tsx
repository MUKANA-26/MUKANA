import Link from "next/link";
import { HeaderLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallButton } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, isRole } from "@/lib/roles";

async function currentHome() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const role = (data?.claims as { app_metadata?: { role?: unknown } } | undefined)?.app_metadata?.role;
    return isRole(role) ? ROLE_HOME[role] : data?.claims?.sub ? "/candidate" : null;
  } catch {
    return null;
  }
}

export async function PublicHeader() {
  const home = await currentHome();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur safe-top">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <HeaderLogo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <Button asChild variant="ghost">
            <Link href="/opportunities">Opportunities</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/companies">Companies</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/careers">Careers</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/#how-it-works">How it works</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/#employers">For employers</Link>
          </Button>
        </nav>
        <div className="flex items-center gap-1.5">
          <InstallButton size="sm" className="hidden sm:inline-flex" />
          <ThemeToggle />
          {home ? (
            <Button asChild variant="cta" size="sm">
              <Link href={home}>Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild variant="cta" size="sm">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          <HeaderLogo />
          <p className="mt-2">Your Opportunity Starts Here.</p>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/opportunities" className="hover:text-foreground">Opportunities</Link>
          <Link href="/help" className="hover:text-foreground">Help</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy policy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms of use</Link>
        </nav>
        <p>© {new Date().getFullYear()} Mukana. Made in Zimbabwe.</p>
      </div>
    </footer>
  );
}

export async function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
