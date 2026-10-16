import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-surface-muted text-foreground",
        info: "bg-info-soft text-info-soft-foreground",
        success: "bg-success-soft text-success-soft-foreground",
        warning: "bg-warning-soft text-warning-soft-foreground",
        danger: "bg-danger-soft text-danger-soft-foreground",
        cta: "bg-cta text-cta-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <Badge variant="success" className={className}>
      <BadgeCheck className="size-3.5" aria-hidden /> Verified
    </Badge>
  );
}
