# Mukana: Your Opportunity Starts Here.

An installable recruitment website (PWA) that connects **attachees** and **graduate trainees** in Zimbabwe with verified employers.
Built with Next.js (App Router, TypeScript strict), Tailwind CSS, Supabase, Serwist and Firebase Cloud Messaging.

```
src/app            routes (public, auth, candidate, employer, admin)
src/features       feature modules: auth, profile, opportunities, applications, matching, employer,
                   notifications, feed (posts, photos/videos, @tags), files (uploads + PDF viewer), cv, admin, settings
src/components     UI kit (shadcn-style), layout, PWA provider
src/sw.ts          the ONE service worker (Serwist + FCM background handler)
supabase/          migrations, seed.sql, Edge Functions, SQL tests
scripts/           icon generator, demo-file seeder
```

## 1. Prerequisites

- Node.js 20+ and npm
- A Supabase project (free tier is fine) and the [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Firebase project (for web push), a Vercel account (hosting), optional: a [Resend](https://resend.com) account (email)

## 2. Run it locally

```bash
npm install
cp .env.example .env.local      # then fill it in (section 3)
npm run dev                     # http://localhost:3000
```

`npm run dev` runs without the service worker. To test the PWA (install, offline, push) use a production build:

```bash
npm run build && npm run start
```

Useful scripts: `npm run typecheck`, `npm run icons` (regenerates every icon from `public/brand/MUKANA_LOGO.png`), `npm run test:sql` (see section 9).

## 3. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | Absolute site URL (emails, share previews, sitemap) |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon / publishable key (safe for browsers; protected by RLS) |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | public | Firebase **web app** config (public by design) |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | public | Web Push public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Used only for account deletion. **Never** prefix with `NEXT_PUBLIC_` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Edge Function secret** | Sends push through FCM |

Only `NEXT_PUBLIC_*` values may reach the browser, and they contain only public values.

## 4. Supabase setup

1. Create a project. In **Authentication → Providers → Email** keep **Confirm email ON**. In **Authentication → URL Configuration** set the Site URL to your site and add `https://YOUR-SITE/auth/callback` (and `http://localhost:3000/auth/callback`) to Redirect URLs.
2. Apply the database. Either:
   ```bash
   supabase link --project-ref YOUR-REF
   supabase db push           # runs supabase/migrations/0001 → 0011 in order
   ```
   or paste each file of `supabase/migrations/` into the SQL editor in numeric order.
   This creates all tables, enums, indexes, **RLS policies on every table**, the storage buckets and policies, triggers and the matching function.
3. **Creating the first admin.** Admins can never be created through public sign-up. Sign up normally, then in the SQL editor run:
   ```sql
   select public.promote_to_admin((select id from auth.users where email = 'you@example.com'));
   ```
   Later admins can promote users from **Admin → Users → Make admin** (audited).
4. (Dev/staging only) load demo data: run `supabase/seed.sql`. It creates 1 admin, 5 verified employers, 10 candidates from different institutions, 15 opportunities and a few applications. All demo accounts end in `@seed.mukana.test` with password `Mukana#Demo2026`. Then `node --env-file=.env.local scripts/seed-demo-files.mjs` uploads sample CV PDFs. **Never run the seed in production.**

## 5. Edge Functions and scheduled jobs

Functions in `supabase/functions`: `send-notifications`, `deadline-reminders`, `interview-reminders`, `close-expired-opportunities`.

```bash
supabase functions deploy send-notifications deadline-reminders interview-reminders close-expired-opportunities --no-verify-jwt
supabase secrets set CRON_SECRET="$(openssl rand -hex 32)" SITE_URL="https://YOUR-SITE" \
  FIREBASE_SERVICE_ACCOUNT_JSON="$(cat service-account.json | tr -d '\n')" \
  RESEND_API_KEY="re_..." EMAIL_FROM="Mukana <notifications@your-domain>"
```

Then tell the database where they live (once), using the **same** `CRON_SECRET`:

```sql
insert into public.app_config (key, value) values
  ('edge_base_url', 'https://YOUR-REF.supabase.co/functions/v1'),
  ('cron_secret',   'THE-SAME-CRON-SECRET')
on conflict (key) do update set value = excluded.value;
```

`0009_cron.sql` (pg_cron + pg_net) schedules: delivery sweep every 5 min, deadline reminders daily 08:00 Harare, interview reminders hourly, auto-close just after midnight Harare. New notifications are also pushed instantly by a trigger.

Email is only sent for **interview invitations and offers**. Without `RESEND_API_KEY` the email channel is skipped; push still works.

## 6. Firebase Cloud Messaging (push) and VAPID

1. Firebase console → create a project → **Project settings → General → Your apps → Web** → copy the config into the `NEXT_PUBLIC_FIREBASE_*` variables.
2. **Project settings → Cloud Messaging → Web Push certificates → Generate key pair** → copy the public key into `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
3. **Project settings → Service accounts → Generate new private key**. This JSON is the `FIREBASE_SERVICE_ACCOUNT_JSON` Edge Function secret (never put it in the Next.js app or commit it).

There is a **single service worker** (`/sw.js`, built by Serwist from `src/sw.ts`). The FCM background handler is imported into it, and the same registration is passed to `getToken()`. Users are asked for permission **only when they tap "Enable notifications"** (Settings). Invalid tokens are removed automatically when FCM reports them. On iPhone/iPad, web push works on iOS 16.4+ **only after Add to Home Screen** (the app explains this in Settings).

Adding WhatsApp later: implement the `NotificationChannel` interface (see `WhatsAppChannel` in `supabase/functions/_shared/channels.ts`), register it in `buildChannels()`, and only send to users with `notification_preferences.whatsapp_opt_in = true`. The opt-in checkbox already exists in Settings.

## 7. Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel (framework: Next.js). The build command is already `next build --webpack` (required by Serwist).
2. Add every variable from section 3 in **Project → Settings → Environment Variables** (Production and Preview).
3. Set `NEXT_PUBLIC_SITE_URL` to the final URL and add it to Supabase redirect URLs. Vercel serves HTTPS only; the app also sends HSTS and a nonce-based Content-Security-Policy.
4. After the first deploy, run Lighthouse on mobile against the live URL.

## 8. Install and test on devices

- **Android (Chrome):** open the site over HTTPS, tap **Install Mukana** (header, landing page or Settings) or Chrome's menu → *Install app*. Open it from the home screen, then Settings → *Enable notifications*.
- **iPhone / iPad (Safari):** open the site, tap **Share → Add to Home Screen → Add**, then open Mukana from the Home Screen. Notifications work from iOS 16.4.
- **Desktop (Chrome/Edge):** click the install icon in the address bar, or the **Install Mukana** button.
- **Offline:** open a few pages, switch to airplane mode. Visited pages, saved opportunities and applications still show (read-only); anything else shows the branded offline page. CVs and other documents are never cached. Cached pages and saved lists are wiped on sign-out.
- **Update banner:** deploy a new version; reopen the app and tap **Refresh** on the "New version available" banner.

## 9. Tests and checks

```bash
npm run test:sql      # applies all migrations to an in-memory Postgres (PGlite) and runs 86 RLS/workflow checks + the seed
npm run typecheck
```

The SQL tests cover sign-up rules, role escalation attempts, RLS between employers/candidates, publish gating, the status workflow, interviews, reminders, matching, moderation and data export.

## 10. How the main rules are enforced

- **Roles and RLS:** every table has RLS. Candidates, employers and admins have separate dashboards; `src/proxy.ts` protects routes by the server-controlled `app_metadata.role`, and every page re-checks with `requireRole`.
- **Applying:** `apply_to_opportunity()` requires a verified email, a 100% complete profile, an open deadline and the right candidate type; a unique constraint allows one application per opportunity.
- **Publishing:** only admin-verified companies with a verified email can publish; opportunities close automatically after the deadline.
- **Documents:** private buckets; employers can read only the current CV/placement letter of candidates who applied to **their** opportunities, through 60-second signed URLs, inside the in-page PDF viewer (no download button, nothing stored on the device). Uploads are validated on the client, by bucket limits, and by a server-side magic-byte check.
- **Matching:** `match_internal()` in Postgres: field 35 + skills 30 + level 15 + availability 15 + location 5, with a plain-language reason. It only ranks and explains; nothing is auto-rejected.
- **Privacy:** consent at sign-up (enforced in the database), privacy/terms pages, JSON data export and account deletion in Settings.

> The privacy policy and terms are good-faith drafts. Have a Zimbabwean lawyer review them against the Cyber and Data Protection Act [Chapter 12:07] before launch.

## 11. Community feed

Members can post text, up to 4 photos or 1 video, tag people with `@`, like and comment (`/feed`). Migration `0011_feed.sql` adds the tables, a public `post-media` bucket (30MB files), moderation and notifications. If your project already ran 0001-0010, just run `supabase/RUN-ME-feed-update.sql` (same as 0011) in the SQL editor.

- Posts and comments are created only through `create_post()` / `add_comment()` (verified email, rate limits, media checks); uploads are re-checked by magic bytes on the server.
- Only people who take part in the feed are visible (`feed_people` view: name, role, photo, headline, company); emails, phones and CVs are never exposed.
- Any post can be reported; admins remove or restore it under Admin → Reports (audited, author notified).

## 12. Deploying on Netlify instead of Vercel

`netlify.toml` is included. In **Site configuration → Environment variables** add every variable from section 3 (all scopes, including Builds and Functions; they are inlined at build time), set `NEXT_PUBLIC_SITE_URL` to your Netlify URL, then **Deploys → Trigger deploy → Clear cache and deploy site**. In Supabase add `https://YOUR-SITE.netlify.app/auth/callback` to Authentication → URL Configuration → Redirect URLs and set the Site URL. If you see a blocked `/.netlify/scripts/hud` script in the console, turn off the Netlify Drawer / collaborator tools for the site: it is injected by Netlify, not by Mukana.

## 13. Upload limits

Photos (profile photos, company logos, post photos, ID/registration photos) can be up to **25MB**; the browser shrinks them (max 2560px for posts, 1024px for avatars/logos) before upload, so they end up well under 1MB. PDFs stay at 5MB and videos at 30MB. The bucket limits are in `0003`, `0011` and `0012_raise_image_limits.sql`; Supabase's project-wide upload limit must be at least 25MB (the free plan allows 50MB).
