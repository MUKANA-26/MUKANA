import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import type { Completeness } from "@/types/db";

export function CompletenessCard({ completeness, showAction = true }: { completeness: Completeness; showAction?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            {completeness.complete ? (
              <CheckCircle2 className="size-5 text-success-soft-foreground" aria-hidden />
            ) : (
              <CircleAlert className="size-5 text-warning-soft-foreground" aria-hidden />
            )}
            Profile completeness
          </CardTitle>
          <span className="font-heading text-lg font-semibold">{completeness.percent}%</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={completeness.percent} label="Profile completeness" />
        {completeness.complete ? (
          <p className="text-sm text-muted-foreground">Your profile is complete. You can apply to any opportunity.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Complete these before you can apply:</p>
            <ul className="flex flex-wrap gap-1.5">
              {completeness.missing.map((m) => (
                <li key={m} className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-soft-foreground">
                  {m}
                </li>
              ))}
            </ul>
            {showAction ? (
              <Button asChild size="sm" variant="cta">
                <Link href="/candidate/profile/edit">Complete profile</Link>
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
