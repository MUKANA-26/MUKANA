import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Full logo (mark, wordmark and tagline). Always shown on a white tile so it never gets recoloured. */
export function FullLogo({ className, size = 220, priority = false }: { className?: string; size?: number; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo-full.png"
      alt="Mukana — Your Opportunity Starts Here."
      width={size}
      height={size}
      priority={priority}
      className={cn("h-auto rounded-2xl bg-white", className)}
      style={{ width: size, height: "auto" }}
    />
  );
}

/** Navigation-bar logo: the mark plus the word "Mukana". */
export function HeaderLogo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 rounded-lg", className)} aria-label="Mukana home">
      <Image src="/brand/mark.png" alt="" width={36} height={36} className="size-9 object-contain" priority />
      <span className="font-heading text-xl font-semibold tracking-tight text-foreground">Mukana</span>
    </Link>
  );
}
