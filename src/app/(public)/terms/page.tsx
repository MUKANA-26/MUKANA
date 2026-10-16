import type { Metadata } from "next";
import { PublicLayout } from "@/components/layout/public-layout";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-7 [&_ul]:space-y-1.5">
        <h1 className="font-heading text-3xl font-bold">Terms of Use</h1>
        <p className="text-sm text-muted-foreground">Last updated: 16 October 2026</p>

        <h2>1. About Mukana</h2>
        <p>
          Mukana is a recruitment platform for industrial attachees and graduate trainees in Zimbabwe. By creating an
          account you agree to these terms and to our Privacy Policy.
        </p>

        <h2>2. Accounts</h2>
        <ul>
          <li>You must be 16 or older and provide accurate information.</li>
          <li>You must verify your email address before applying to, or publishing, opportunities.</li>
          <li>You are responsible for activity on your account. Keep your password private.</li>
        </ul>

        <h2>3. Candidates</h2>
        <ul>
          <li>Only upload documents that are yours and are genuine. Fake or altered documents will lead to suspension.</li>
          <li>Applying shares your profile, CV and placement letter with that employer.</li>
          <li>Match scores are guidance only. Employers decide who to shortlist and hire.</li>
        </ul>

        <h2>4. Employers</h2>
        <ul>
          <li>Companies must be verified by Mukana before publishing opportunities.</li>
          <li>Opportunities must be genuine attachment or graduate trainee programmes. Charging candidates any fee is forbidden.</li>
          <li>Use candidate data only to assess their application, and respect the Cyber and Data Protection Act [Chapter 12:07].</li>
          <li>Do not discriminate unlawfully when making decisions.</li>
        </ul>

        <h2>5. Acceptable use</h2>
        <p>
          Do not post unlawful, misleading or abusive content, attempt to access other users&apos; data, scrape the service,
          or interfere with its operation. You can report any opportunity or company with the Report button.
        </p>

        <h2>6. Moderation</h2>
        <p>
          Mukana moderators may remove content, suspend accounts and reject verification requests to keep the platform safe.
          Moderator actions are logged.
        </p>

        <h2>7. Availability and liability</h2>
        <p>
          We work to keep Mukana available but do not guarantee uninterrupted service or that any candidate will be placed.
          To the extent the law allows, we are not liable for decisions made by employers or candidates.
        </p>

        <h2>8. Ending your account</h2>
        <p>You can delete your account and download your data at any time from Settings.</p>

        <h2>9. Governing law</h2>
        <p>These terms are governed by the laws of Zimbabwe.</p>
      </article>
    </PublicLayout>
  );
}
