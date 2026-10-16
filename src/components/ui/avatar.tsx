"use client";

import * as React from "react";
import { cn, initials } from "@/lib/utils";

const SIZES = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-12 text-sm",
  lg: "size-16 text-lg",
  xl: "size-28 text-3xl sm:size-32",
} as const;

/** Round profile picture with an initials fallback (also used when the image fails to load). */
export function Avatar({
  url,
  name,
  size = "sm",
  className,
}: {
  url?: string | null;
  name?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [url]);
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary font-semibold text-primary-foreground ring-2 ring-background",
        SIZES[size],
        className,
      )}
    >
      {url && !failed ? (
        // Signed storage URL: not eligible for next/image optimisation.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name ? `${name}'s profile photo` : "Profile photo"} className="size-full object-cover" onError={() => setFailed(true)} referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}
