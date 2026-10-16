import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronLeft, Link2, Mail, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/utils";
import { DEGREE_CLASSES, QUALIFICATION_LEVELS, labelOf } from "@/lib/zimbabwe";
import { StatusBadge } from "@/features/applications/status-badge";
import { EventLog, StatusStepper } from "@/features/applications/timeline";
import { ApplicantActions } from "@/features/employer/applicant-actions";
import { getApplicant, getTemplates } from "@/features/employer/queries";
import { MatchCard } from "@/features/matching/match-card";
import { getMyCompany } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Applicant" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export default async function ApplicantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("employer");
  const [data, company] = await Promise.all([getApplicant(id), getMyCompany(session.id)]);
  if (!data || !company) notFound();
  const { applicant: a, events, interviews } = data;
  const templates = await getTemplates(company.company.id);
  const p = a.candidate.profile;
  const openInterview = interviews.find((i) => (i.status === "scheduled" || i.status === "confirmed") && new Date(i.scheduled_at) > new Date()) ?? null;
  const isAttachee = p?.candidate_type === "attachee";

  return (
    <>
      <Link href="/employer/applicants" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> All applicants
      </Link>

      <header className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-semibold sm:text-2xl">{a.candidate.full_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Applied for <span className="font-medium text-foreground">{a.opportunity?.title}</span> on {formatDate(a.submitted_at)}
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href={`mailto:${a.candidate.email}`} className="inline-flex items-center gap-1.5 text-link hover:underline">
                <Mail className="size-4" aria-hidden /> {a.candidate.email}
              </a>
              {a.candidate.phone ? (
                <a href={`tel:${a.candidate.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-link hover:underline">
                  <Phone className="size-4" aria-hidden /> {a.candidate.phone}
                </a>
              ) : null}
            </p>
          </div>
          <StatusBadge status={a.status} />
        </div>
        <div className="mt-5">
          <StatusStepper status={a.status} events={events} />
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <ApplicantActions
            applicationId={a.id}
            status={a.status}
            templates={templates}
            context={{ candidateName: a.candidate.full_name, role: a.opportunity?.title ?? "", company: company.company.name }}
            cvPath={p?.cv_path ?? null}
            placementPath={p?.placement_letter_path ?? null}
            candidateName={a.candidate.full_name}
            openInterview={openInterview}
          />
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <MatchCard match={a.match_breakdown} audience="employer" />
          {interviews.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Interviews</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {interviews.map((i) => (
                  <div key={i.id} className="rounded-xl border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-semibold">
                        <CalendarClock className="size-4" aria-hidden /> {formatDateTime(i.scheduled_at)} · {i.duration_minutes} min
                      </p>
                      <Badge variant={i.status === "confirmed" ? "success" : i.status === "scheduled" ? "warning" : i.status === "declined" || i.status === "cancelled" ? "danger" : "neutral"}>
                        {i.status[0]!.toUpperCase() + i.status.slice(1)}
                      </Badge>
                    </div>
                    <p className="mt-1.5 flex items-start gap-2 text-muted-foreground">
                      {i.mode === "virtual" ? <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />}
                      <span className="break-all">{i.location}</span>
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <EventLog events={events} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Candidate profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5">
                <Row label="Type">{isAttachee ? "Attachee" : "Graduate trainee"}</Row>
                <Row label="Institution">{p?.institution}</Row>
                {isAttachee ? (
                  <>
                    <Row label="Programme">{p?.programme}</Row>
                    <Row label="Level">{p?.current_level != null ? Number(p.current_level).toFixed(1) : null}</Row>
                    <Row label="Reg. number">{p?.registration_number}</Row>
                    <Row label="Attachment">{p?.attachment_start ? `${formatDate(p.attachment_start)} – ${formatDate(p.attachment_end)}` : null}</Row>
                  </>
                ) : (
                  <>
                    <Row label="Qualification">{p?.qualification}</Row>
                    <Row label="Level">{p?.qualification_level ? labelOf(QUALIFICATION_LEVELS, p.qualification_level) : null}</Row>
                    <Row label="Degree class">{p?.degree_class ? labelOf(DEGREE_CLASSES, p.degree_class) : null}</Row>
                    <Row label="Graduated">{p?.graduation_year}</Row>
                    <Row label="Available from">{p?.availability_date ? formatDate(p.availability_date) : null}</Row>
                  </>
                )}
                <Row label="Location">{[p?.city, p?.province].filter(Boolean).join(", ")}</Row>
              </dl>
              {p?.bio ? <p className="mt-3 whitespace-pre-line rounded-lg bg-surface-muted p-3 text-sm">{p.bio}</p> : null}
              {p?.skills?.length ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold">Skills</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.skills.map((s) => (
                      <li key={s}>
                        <Badge variant="info">{s}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {p?.certifications?.length ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold">Certifications</p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {p.certifications.map((c, i) => (
                      <li key={i}>
                        {c.name}
                        {c.issuer ? ` · ${c.issuer}` : ""}
                        {c.year ? ` · ${c.year}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {p?.projects?.length ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold">Projects</p>
                  <ul className="mt-1.5 space-y-2 text-sm">
                    {p.projects.map((x, i) => (
                      <li key={i}>
                        <span className="font-medium">{x.title}</span>
                        {x.description ? <span className="text-muted-foreground"> — {x.description}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
          {a.cover_note ? (
            <Card>
              <CardHeader>
                <CardTitle>Cover note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm">{a.cover_note}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
