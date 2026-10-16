import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, CalendarClock, GraduationCap, Link2, MapPin, Pencil, Phone, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { requireRole } from "@/lib/auth";
import { signAvatarUrl } from "@/lib/avatars";
import { formatDate } from "@/lib/utils";
import { DEGREE_CLASSES, QUALIFICATION_LEVELS, labelOf } from "@/lib/zimbabwe";
import { AvatarUploader } from "@/features/profile/avatar-uploader";
import { ProfileDocuments } from "@/features/profile/profile-documents";
import { getCandidateProfile, getCompleteness } from "@/features/profile/queries";

export const metadata: Metadata = { title: "My profile" };

/** LinkedIn-style profile page: how employers see you. Editing happens on /candidate/profile/edit. */
export default async function CandidateProfilePage() {
  const session = await requireRole("candidate");
  const [p, completeness, avatarUrl] = await Promise.all([getCandidateProfile(session.id), getCompleteness(session.id), signAvatarUrl(session.avatar_path)]);
  if (!p) notFound();

  const isAttachee = p.candidate_type === "attachee";
  const field = isAttachee ? p.programme : p.qualification;
  const headline = [field, p.institution].filter(Boolean).join(" · ") || (isAttachee ? "Student looking for an industrial attachment" : "Graduate looking for a trainee programme");
  const location = [p.city, p.province].filter(Boolean).join(", ");

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-navy via-blue to-green sm:h-36" aria-hidden />
        <CardContent className="relative px-4 pb-5 pt-0 sm:px-6">
          <div className="-mt-14 flex flex-wrap items-end justify-between gap-3 sm:-mt-16">
            <AvatarUploader userId={session.id} url={avatarUrl} name={session.full_name} hasPhoto={Boolean(session.avatar_path)} />
            <Button asChild variant="outline">
              <Link href="/candidate/profile/edit">
                <Pencil aria-hidden /> Edit profile
              </Link>
            </Button>
          </div>
          <h1 className="mt-3 font-heading text-2xl font-bold">{session.full_name}</h1>
          <p className="mt-0.5 text-base">{headline}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden /> {location}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-4" aria-hidden /> {session.email}
            </span>
            {session.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4" aria-hidden /> {session.phone}
              </span>
            ) : null}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={isAttachee ? "info" : "success"}>{isAttachee ? "Looking for attachment" : "Looking for a trainee programme"}</Badge>
            {isAttachee && p.attachment_start ? (
              <Badge variant="neutral">
                <CalendarClock className="size-3.5" aria-hidden /> {formatDate(p.attachment_start)} – {formatDate(p.attachment_end)}
              </Badge>
            ) : null}
            {!isAttachee && p.availability_date ? (
              <Badge variant="neutral">
                <CalendarClock className="size-3.5" aria-hidden /> Available from {formatDate(p.availability_date)}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {!completeness.complete || !session.avatar_path ? (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-heading font-semibold">Profile strength</p>
              <span className="font-heading text-lg font-semibold">{completeness.percent}%</span>
            </div>
            <Progress value={completeness.percent} label="Profile strength" />
            <ul className="flex flex-wrap gap-1.5">
              {completeness.missing.map((m) => (
                <li key={m} className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-soft-foreground">
                  {m}
                </li>
              ))}
              {!session.avatar_path ? (
                <li className="rounded-full bg-info-soft px-2.5 py-1 text-xs font-semibold text-info-soft-foreground">Add a profile photo (tap the camera)</li>
              ) : null}
            </ul>
            {!completeness.complete ? (
              <Button asChild size="sm" variant="cta">
                <Link href="/candidate/profile/edit">Complete my profile</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {p.bio ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-7">{p.bio}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Education</CardTitle>
        </CardHeader>
        <CardContent>
          {p.institution ? (
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-info-soft text-info-soft-foreground">
                <GraduationCap className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{p.institution}</p>
                <p>{field}</p>
                <p className="text-muted-foreground">
                  {isAttachee
                    ? [p.current_level != null ? `Level ${Number(p.current_level).toFixed(1)}` : "", p.registration_number ? `Reg. ${p.registration_number}` : ""].filter(Boolean).join(" · ")
                    : [p.qualification_level ? labelOf(QUALIFICATION_LEVELS, p.qualification_level) : "", p.degree_class ? labelOf(DEGREE_CLASSES, p.degree_class) : "", p.graduation_year ? `Class of ${p.graduation_year}` : ""].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add your institution and programme.{" "}
              <Link href="/candidate/profile/edit" className="font-medium text-link underline">
                Add education
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent>
          {p.skills.length ? (
            <ul className="flex flex-wrap gap-2">
              {p.skills.map((s) => (
                <li key={s}>
                  <Badge variant="info">{s}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Add at least 3 skills so employers can match you.</p>
          )}
        </CardContent>
      </Card>

      {p.projects.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {p.projects.map((x, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
                  <Briefcase className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{x.title}</p>
                  {x.description ? <p className="text-muted-foreground">{x.description}</p> : null}
                  {x.url ? (
                    <a href={x.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-link hover:underline">
                      <Link2 className="size-3.5" aria-hidden /> {x.url.replace(/^https?:\/\//, "")}
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {p.certifications.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Certifications</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {p.certifications.map((c, i) => (
                <li key={i}>
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-muted-foreground">{[c.issuer, c.year].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ProfileDocuments cvPath={p.cv_path} placementPath={p.placement_letter_path} />
          <p className="text-xs text-muted-foreground">Private. Only employers you apply to can open them, through short-lived links.</p>
        </CardContent>
      </Card>
    </div>
  );
}
