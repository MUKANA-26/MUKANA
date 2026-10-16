"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-danger-soft text-danger-soft-foreground">
        <TriangleAlert className="size-8" aria-hidden />
      </span>
      <h1 className="mt-5 font-heading text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">An unexpected error happened. Your data is safe. Please try again.</p>
      {error.digest ? <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <Button className="mt-6" variant="cta" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
