import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The two-figure Mukana mark that "shakes hands": the left and right figures slide in from the sides,
 * meet in the middle, shake once, and settle. Pure CSS (see globals.css), so it works before JS loads
 * and is switched off automatically for people who prefer reduced motion.
 */
export function AnimatedMark({ size = 140, className }: { size?: number; className?: string }) {
  const img = (
    <Image src="/brand/mark.png" alt="" width={size} height={size} priority className="max-w-none object-contain" style={{ width: size, height: size }} />
  );
  return (
    <span className={cn("mukana-shake relative inline-block", className)} style={{ width: size, height: size }} role="img" aria-label="Mukana">
      <span className="mukana-left absolute inset-0" style={{ clipPath: "inset(0 50% 0 0)" }}>
        {img}
      </span>
      <span className="mukana-right absolute inset-0" style={{ clipPath: "inset(0 0 0 50%)" }}>
        {img}
      </span>
    </span>
  );
}