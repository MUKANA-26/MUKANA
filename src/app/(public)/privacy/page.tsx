import type { Metadata } from "next";
import { PublicLayout } from "@/components/layout/public-layout";

export const metadata: Metadata = { title: "Privacy Policy" };

const updated = "16 October 2026";

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-7 [&_ul]:space-y-1.5">
        <h1 className="font-heading text-3xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
        <p>
          Mukana (&ldquo;we&rdquo;, &ldquo;us&rdquo;) connects industrial attachees and graduate trainees in Zimbabwe with
          employers. This policy explains what personal data we collect, why, and the rights you have under
          Zimbabwe&apos;s Cyber and Data Protection Act [Chapter 12:07] (the &ldquo;Act&rdquo;).
        </p>

        <h2>1. Who is responsible for your data</h2>
        <p>
          Mukana is the data controller for the personal data processed on this platform. Employers who receive your
          application become responsible for how they handle the data you share with them.
        </p>

        <h2>2. What we collect</h2>
        <ul>
          <li>Account data: name, email address, phone number, password (stored only as a secure hash).</li>
          <li>Profile data: institution, programme or qualification, level or degree class, skills, projects, certifications, city and province, availability dates.</li>
          <li>Documents you upload: CV, institution placement letter, profile photo, and (for employers) company verification documents.</li>
          <li>Application data: applications, cover notes, interview details, offers and the status history of each application.</li>
          <li>Technical data: device notification tokens (if you enable notifications), and basic logs needed to keep the service secure.</li>
        </ul>

        <h2>3. Why we use it (lawful basis)</h2>
        <ul>
          <li>Consent, which you give when creating your account, to create and run your profile.</li>
          <li>To perform the service you ask for: matching you with opportunities and sending your application to employers you apply to.</li>
          <li>Our legitimate interest in keeping the platform safe, preventing fraud and moderating reports.</li>
        </ul>
        <p>
          We use a rule-based, explainable matching score to recommend opportunities. It is never used to automatically
          reject you; employers make every decision.
        </p>

        <h2>4. Who can see your data</h2>
        <ul>
          <li>Employers can see your profile, CV and placement letter only for opportunities you have applied to, and only for their own opportunities.</li>
          <li>Documents are stored in private storage and opened through short-lived (60-second) links; they are never cached on your device or by our service worker.</li>
          <li>Mukana administrators can see account and company-verification data when needed to moderate the platform. Every administrator action is recorded in an audit log.</li>
          <li>Service providers who process data for us: Supabase (database, authentication and storage), Vercel (hosting), Google Firebase Cloud Messaging (push notifications) and our email provider. We do not sell your data.</li>
        </ul>

        <h2>5. Notifications</h2>
        <p>
          We send in-app notifications, optional push notifications (only after you tap &ldquo;Enable notifications&rdquo;),
          and emails for key events such as interview invitations and offers. WhatsApp messages will only ever be sent with
          your explicit opt-in.
        </p>

        <h2>6. How long we keep it</h2>
        <p>
          We keep your data while your account is active. You can delete your account at any time from Settings, which
          permanently removes your profile, documents and applications. Some records may be retained where the law requires.
        </p>

        <h2>7. Your rights</h2>
        <p>Under the Act you may request to:</p>
        <ul>
          <li>access your data and download a copy (Settings → Download my data, a JSON file);</li>
          <li>correct inaccurate data (edit your profile at any time);</li>
          <li>delete your data (Settings → Delete my account);</li>
          <li>withdraw your consent, object to processing, or lodge a complaint with the Data Protection Authority (POTRAZ).</li>
        </ul>

        <h2>8. Security</h2>
        <p>
          We use encryption in transit (HTTPS only), row-level security so each user can only reach their own data,
          private file storage, security headers and email verification. No system is perfectly secure; please use a strong,
          unique password.
        </p>

        <h2>9. Transfers outside Zimbabwe</h2>
        <p>
          Our infrastructure providers may store data in data centres outside Zimbabwe. We only use providers that
          apply appropriate safeguards.
        </p>

        <h2>10. Children</h2>
        <p>Mukana is intended for people aged 16 and over.</p>

        <h2>11. Changes and contact</h2>
        <p>
          We will post any changes here and, for significant changes, notify you in the app. Questions or requests:
          contact the Mukana team through the support address published in the app.
        </p>
      </article>
    </PublicLayout>
  );
}
