import type { Metadata } from "next";
import Link from "next/link";
import { AdaptiveLayout } from "@/components/layout/adaptive-layout";

export const metadata: Metadata = { title: "Help", description: "Answers to common questions about using Mukana." };

const faqs: { group: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    group: "For candidates",
    items: [
      { q: "How do I apply?", a: "Complete your profile (the app shows exactly what's missing), then open an opportunity and tap Apply now. You can add a short cover note. You can only apply once per opportunity." },
      { q: "What is the match score?", a: "A simple, explainable score from 0 to 100 based on your field of study, skills, level, availability and location. It only helps you and employers sort. Employers make every decision, and nobody is ever rejected automatically." },
      { q: "I have no work experience. What can I do?", a: <>Use the <Link href="/candidate/cv-builder" className="text-link underline">CV builder</Link>. It turns your studies, projects, volunteering and skills into a clean PDF.</> },
      { q: "How do I add a profile photo?", a: "Open your profile and tap the camera on your photo, or go to Settings → Account. Your photo appears in the corner of the app and to employers you apply to." },
      { q: "Who can see my CV?", a: "Only employers whose opportunities you applied to. Documents open inside the app through short-lived links and are never stored on your device." },
      { q: "I accepted an attachment offer. What about my other applications?", a: "After you accept, Mukana offers to withdraw your other pending attachment applications so other employers aren't kept waiting." },
    ],
  },
  {
    group: "For employers",
    items: [
      { q: "Why can't I publish yet?", a: "Companies must be verified first. Upload your registration documents under Company profile → Verification. An admin reviews them, and you can keep saving drafts meanwhile. You also need to confirm your email." },
      { q: "How do I invite someone to interview?", a: "Open the applicant, shortlist them (or mark under review), then tap Invite to interview. Candidates are notified and reminded 24 hours before." },
      { q: "Can I message many applicants at once?", a: "Yes. Select applicants in the list, choose a status, and edit the message template before sending. Placeholders like the candidate's first name are filled in for each person." },
      { q: "How do I share an opportunity on WhatsApp?", a: "Use Copy link on your opportunity. The link shows a preview card with the title, company and deadline." },
    ],
  },
  {
    group: "Account and privacy",
    items: [
      { q: "How do I install Mukana on my phone?", a: "On Android tap Install Mukana (or the browser menu → Install app). On iPhone, open the site in Safari, tap Share → Add to Home Screen." },
      { q: "How do I get my data or delete my account?", a: <>Go to Settings → Your data and privacy. You can download everything as a JSON file or permanently delete your account. See the <Link href="/privacy" className="text-link underline">Privacy Policy</Link>.</> },
      { q: "I forgot my password.", a: <>Use <Link href="/forgot-password" className="text-link underline">Forgot password</Link> on the sign-in page. If you're signed in, you can change it in Settings → Account.</> },
      { q: "Something looks wrong or someone is posting a scam.", a: "Use the Report button on any opportunity or company page. A moderator reviews every report." },
    ],
  },
];

export default function HelpPage() {
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-heading text-3xl font-bold">Help centre</h1>
        <p className="mt-2 text-muted-foreground">Quick answers. Tap a question to open it.</p>
        {faqs.map((g) => (
          <section key={g.group} className="mt-8" aria-labelledby={g.group}>
            <h2 id={g.group} className="font-heading text-xl font-semibold">
              {g.group}
            </h2>
            <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
              {g.items.map((f) => (
                <details key={f.q} className="group p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                    {f.q}
                    <span aria-hidden className="text-xl text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdaptiveLayout>
  );
}