import Link from "next/link";
import { FullLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center justify-between px-4 py-3 safe-top">
        <Link href="/" className="text-sm font-medium text-link hover:underline">
          ← Back to home
        </Link>
        <ThemeToggle />
      </div>
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-10">
        <div className="mb-6 flex justify-center">
          <FullLogo size={168} priority className="shadow-md ring-1 ring-border" />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">{children}</div>
      </main>
    </div>
  );
}
