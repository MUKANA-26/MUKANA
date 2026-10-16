import Link from "next/link";
import Image from "next/image";
import { Building2, CalendarClock, Clock, MapPin, Wallet } from "lucide-react";
import { Badge, VerifiedBadge } from "@/components/ui/badge";
import { companyLogoUrl } from "@/lib/storage";
import { daysUntil, formatDate } from "@/lib/utils";
import type { OpportunityWithCompany } from "@/types/db";

export const TYPE_LABEL = {
  industrial_attachment: "Industrial attachment",
  graduate_trainee: "Graduate trainee",
} as const;

export function stipendLabel(o: Pick<OpportunityWithCompany, "stipend_type" | "stipend_amount" | "stipend_currency">) {
  if (o.stipend_type === "unpaid") return "Unpaid";
  if (o.stipend_amount == null) return "Paid";
  const amount = Number(o.stipend_amount).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return o.stipend_currency === "ZiG" ? `ZiG ${amount}/mo` : `US$${amount}/mo`;
}

export function DeadlineTag({ deadline, status }: { deadline: string; status?: string }) {
  if (status === "closed") return <Badge variant="neutral">Closed</Badge>;
  const d = daysUntil(deadline);
  if (d === null) return null;
  if (d < 0) return <Badge variant="neutral">Closed</Badge>;
  if (d <= 3) return <Badge variant="warning">{d === 0 ? "Closes today" : `${d} day${d === 1 ? "" : "s"} left`}</Badge>;
  return <Badge variant="neutral">Closes {formatDate(deadline)}</Badge>;
}

export function OpportunityCard({
  opportunity: o,
  href,
  footer,
  matchScore,
  as: Heading = "h2",
}: {
  opportunity: OpportunityWithCompany;
  href: string;
  footer?: React.ReactNode;
  matchScore?: number | null;
  /** Heading level for the title (use h3 when the card sits under an h2 section). */
  as?: "h2" | "h3";
}) {
  const logo = companyLogoUrl(o.companies?.logo_path);
  return (
    <article className="rounded-xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white">
          {logo ? <Image src={logo} alt="" width={48} height={48} className="size-12 object-contain" /> : <Building2 className="size-6 text-muted-foreground" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <Heading className="font-heading text-base font-semibold leading-snug">
            <Link href={href} className="after:absolute after:inset-0 hover:underline">
              {o.title}
            </Link>
          </Heading>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{o.companies?.name ?? "Company"}</span>
            {o.companies?.verification_status === "approved" ? <VerifiedBadge /> : null}
          </p>
        </div>
        {matchScore != null ? (
          <div className="shrink-0 rounded-lg bg-info-soft px-2.5 py-1 text-center" aria-label={`${matchScore} percent match`}>
            <p className="font-heading text-lg font-semibold leading-none text-info-soft-foreground">{matchScore}%</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-info-soft-foreground">match</p>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden /> {o.location}</span>
        <span className="inline-flex items-center gap-1.5"><Wallet className="size-4" aria-hidden /> {stipendLabel(o)}</span>
        {o.duration_months ? <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden /> {o.duration_months} mo</span> : null}
        {o.start_date ? <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden /> Starts {formatDate(o.start_date)}</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={o.type === "industrial_attachment" ? "info" : "success"}>{TYPE_LABEL[o.type]}</Badge>
        <Badge variant="neutral">{o.mode === "hybrid" ? "Hybrid" : "On-site"}</Badge>
        <DeadlineTag deadline={o.deadline} status={o.status} />
      </div>
      {footer ? <div className="relative z-10 mt-3 border-t border-border pt-3">{footer}</div> : null}
    </article>
  );
}
