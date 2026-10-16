import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { getMyCompany } from "@/features/profile/queries";
import { getCompanyOpportunities } from "@/features/opportunities/queries";
import { DeadlineTag, TYPE_LABEL } from "@/features/opportunities/opportunity-card";
import { EmployerOpportunityActions } from "@/features/opportunities/employer-actions";

export const metadata: Metadata = { title: "Opportunities" };

const statusVariant = { draft: "neutral", published: "success", closed: "warning" } as const;

export default async function EmployerOpportunitiesPage() {
  const session = await requireRole("employer");
  const data = await getMyCompany(session.id);
  const items = data ? await getCompanyOpportunities(data.company.id) : [];

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Create, publish and close your attachment and trainee opportunities."
        actions={
          <Button asChild variant="cta">
            <Link href="/employer/opportunities/new">
              <Plus aria-hidden /> New opportunity
            </Link>
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList aria-hidden />}
          title="No opportunities yet"
          description="Create your first opportunity. Drafts are private until you publish."
          action={
            <Button asChild variant="cta">
              <Link href="/employer/opportunities/new">Create opportunity</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((o) => (
            <li key={o.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-heading text-base font-semibold">{o.title}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {TYPE_LABEL[o.type]} · {o.location} · {o.slots} slot{o.slots === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant[o.status]}>{o.status[0]!.toUpperCase() + o.status.slice(1)}</Badge>
                  {o.suspended ? <Badge variant="danger">Suspended</Badge> : null}
                  {o.status === "published" ? <DeadlineTag deadline={o.deadline} status={o.status} /> : <Badge variant="neutral">Deadline {formatDate(o.deadline)}</Badge>}
                </div>
              </div>
              <div className="mt-3">
                <EmployerOpportunityActions id={o.id} status={o.status} applicantCount={o.applications?.[0]?.count ?? 0} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
