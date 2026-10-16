import Link from "next/link";
import { SearchX } from "lucide-react";
import { PublicLayout } from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PublicLayout>
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-info-soft text-info-soft-foreground">
          <SearchX className="size-8" aria-hidden />
        </span>
        <h1 className="mt-5 font-heading text-2xl font-semibold">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted-foreground">The link may be old, or the opportunity may have been removed.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="cta">
            <Link href="/opportunities">Browse opportunities</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
