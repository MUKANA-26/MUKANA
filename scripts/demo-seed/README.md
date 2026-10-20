# Demo data for testing

Fills the Supabase project in `.env.local` with realistic test data, all tagged so it can be removed in one step.

```bash
npm run demo:seed      # create the data (refuses to run twice; add -- --force to remove and recreate)
npm run demo:remove    # delete ALL demo accounts, their files and everything they own
```

## What it creates

- **30 companies** (25 verified, 3 waiting in the admin verification queue, 2 unverified) with generated logos, an HR owner each, and about 70 opportunities (attachments, internships, graduate programmes, entry-level jobs).
- **40 attachees and 30 graduates** with full profiles: photo, cover (some), headline, skills, projects, certifications, **a PDF CV** (the app's own CV template) and, for attachees, **a placement letter PDF**.
- **About 150 feed posts**, roughly 60 with Unsplash photos, plus likes, comments, tags, hashtags and reposts.
- Connections, chats (some unread), endorsements, recommendations, mentors, applications in every status, interviews, saved jobs, job alerts, 5 groups and 4 events including a career fair.

## Safety

- Every account uses an `@demo.mukana.test` email (not a real inbox) and the password in `config.mjs`.
- Company names are real brand names, so **every company and opportunity is visibly marked "(Demo)" / "DEMO LISTING, not a real vacancy"**. Logos are generated artwork, not the companies' trademarks.
- Profile photos come from randomuser.me and feed/cover photos from Unsplash (free to use). They show real people under invented names; do not leave this on a public site you promote.
- Phone numbers are made-up and start with `+263770`.
- `demo-accounts.csv` (created by the seed) lists every email. Downloaded images are cached in `.cache/`. Both are git-ignored.
