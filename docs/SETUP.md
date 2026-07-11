# Pixeloon — Complete Production Setup Guide

This guide takes you from zero to a fully working multi-user deployment: Supabase
backend, scheduled auto-posting, and per-user API keys for Facebook, Instagram,
YouTube, Google Drive, and Gemini AI.

There are two kinds of configuration:

| Level | Who sets it | What |
|---|---|---|
| **Deployment (once)** | The person hosting Pixeloon | Supabase project, migrations, edge functions, cron job, frontend env, optional Cloudinary |
| **Per user (each account)** | Every Pixeloon user, in **Settings → API Keys** | Gemini key, Google Drive service account, Facebook App credentials, YouTube OAuth credentials |

Every user has their **own** keys — nothing is shared between accounts.

---

## Part 1 — Deployment setup (owner, once)

### 1.1 Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) and note:
   - **Project URL** — `https://<project-ref>.supabase.co`
   - **anon/publishable key** and **service_role key** (Project Settings → API)
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and link the repo:

```bash
supabase login
supabase link --project-ref <project-ref>
```

> ⚠️ Check `supabase/config.toml` — its `project_id` must match the project you
> are actually deploying to.

### 1.2 Apply all database migrations

```bash
supabase db push
```

This creates every table, all row-level-security policies, the storage bucket,
and the duplicate-posting protections (unique pending-post indexes,
`processing_started_at`, schedule-generation lease).

### 1.3 Point the cron job at YOUR project (critical)

The auto-poster runs every minute via `pg_cron`. The original migration
hard-codes the first project's URL, so on a fresh project you must re-create the
job. Run this in the Supabase **SQL Editor** (fill in your values):

```sql
select cron.unschedule('auto-poster-cron');

select cron.schedule(
  'auto-poster-cron',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/auto-poster',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <YOUR-ANON-KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

Verify it is running: `select * from cron.job;` and, after a minute,
`select * from cron.job_run_details order by start_time desc limit 5;`

### 1.4 Deploy the edge functions

```bash
supabase functions deploy auto-poster
supabase functions deploy generate-schedule
supabase functions deploy facebook-oauth
supabase functions deploy youtube-oauth
supabase functions deploy generate-content
supabase functions deploy profile-assistant
supabase functions deploy list-folder-videos
supabase functions deploy validate-drive-links
supabase functions deploy sync-analytics
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 1.5 Function secrets (optional features)

```bash
# Logo watermarking on videos (optional — without it videos post un-watermarked)
supabase secrets set CLOUDINARY_CLOUD_NAME=<name>
supabase secrets set CLOUDINARY_API_KEY=<key>
supabase secrets set CLOUDINARY_API_SECRET=<secret>

# Folder video-count preview (optional; actual posting uses each user's own
# Drive service account from Settings)
supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL=<sa-email>
supabase secrets set GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="<private-key>"
```

### 1.6 Frontend

Create `.env` in the repo root:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

Then build and host the `dist/` folder anywhere static (Vercel, Netlify, …):

```bash
npm install
npm run build
```

### 1.7 First admin user

Sign up in the app, then grant yourself admin in the SQL editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

---

## Part 2 — Per-user setup (every user, in the app)

Each user opens **Settings** and configures their own keys. Until these are set,
that user's campaigns cannot post.

### 2.1 Gemini API key (AI captions)

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) → **Create API key**.
2. Paste it in **Settings → API Keys → Gemini** and save.

Without a Gemini key, posts fall back to your campaign's fallback captions
(configurable per campaign) — posting still works.

### 2.2 Google Drive service account (REQUIRED for posting)

The auto-poster downloads your videos from Google Drive using **your** service
account:

1. In [Google Cloud Console](https://console.cloud.google.com) create (or pick) a
   project → **APIs & Services → Enable APIs** → enable **Google Drive API**.
2. **IAM & Admin → Service Accounts → Create service account** (any name, no
   roles needed).
3. Open the service account → **Keys → Add key → JSON**. Download the file.
4. From the JSON file copy:
   - `client_email` → paste into **Settings → Service Account Email**
   - `private_key` (the whole `-----BEGIN PRIVATE KEY-----…` block) → paste into
     **Settings → Service Account Private Key**
5. **Share every Drive folder you'll use** with the service account email
   (right-click folder → Share → paste the `…iam.gserviceaccount.com` address →
   Viewer). Videos inside inherit access. If you use shortcuts, share the target
   files too.

### 2.3 Facebook + Instagram

1. Create an app at [developers.facebook.com](https://developers.facebook.com)
   (type: **Business**).
2. Add the **Facebook Login** product. In *Facebook Login → Settings → Valid
   OAuth Redirect URIs* add: `https://<your-frontend-domain>/facebook-callback`
3. Required permissions: `pages_show_list`, `pages_read_engagement`,
   `pages_manage_posts`, `pages_read_user_content`, `instagram_basic`,
   `instagram_content_publish`. (In development mode these work for app
   admins/testers; for other users you need Facebook App Review.)
4. Copy the **App ID** and **App Secret** into **Settings → OAuth App
   Credentials** and save.
5. Click **Connect Facebook** in Settings → approve → your Pages (and any
   Instagram **Business/Creator accounts linked to those Pages**) are imported.

> Instagram requirement: the IG account must be a Business or Creator account
> linked to a Facebook Page you manage — plain personal IG accounts cannot be
> posted to via the API.

### 2.4 YouTube

1. In Google Cloud Console (same or another project): enable **YouTube Data API v3**.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   type **Web application** → add redirect URI:
   `https://<your-frontend-domain>/youtube-callback`
3. Configure the OAuth consent screen (External). While it is in *Testing*, add
   each user's Google account as a test user; publish the app to remove that limit.
4. Copy **Client ID** and **Client Secret** into **Settings → OAuth App
   Credentials** and save.
5. Click **Connect YouTube** in Settings → approve → your channels are imported.

### 2.5 Watermark logo (optional)

Paste a direct JPG/PNG URL in **Settings → Watermark Image** — used as the
default logo watermark. Campaigns can override it with per-brand logos and
control position/size/opacity (requires the deployment's Cloudinary secrets).

---

## Part 3 — Creating your first campaign

1. **New Campaign** → name it, pick a Google Drive folder (or paste video links).
2. Select the Facebook Pages / Instagram accounts / YouTube channels to post to.
3. Add post times (e.g. 09:00, 15:00, 21:00) with optional ± randomization.
4. Choose AI captions or a manual caption template; set fallback captions,
   branding line, affiliate links, watermark brands, YouTube Shorts/long-form
   and title language as needed.
5. Create — the schedule is generated automatically for **all** videos, skipping
   any already scheduled.

Ongoing management from the campaign page:

- **Everything is editable later**: captions settings, branding, affiliate
  links, watermark brands & placement, post times.
- **Schedule new videos** — added more videos to the folder? One click schedules
  only the new ones.
- **Post Now / Retry** — safe by design: a post can never publish twice; retries
  skip platforms that already received the video.
- **Pause/Resume** — paused campaigns are skipped by the auto-poster.
- **Bulk select** posts to delete or reschedule across your time slots.

### How videos are classified

- Vertical/square videos ≤ 90s → Facebook **Reel** / IG Reel / YouTube **Short**.
- Longer or horizontal videos → regular video upload (YouTube type can be forced
  per campaign).
- Videos under **720p** or with extreme aspect ratios are rejected (not retried)
  so low-quality content never goes out.

---

## Part 4 — Verification checklist

After setup, verify each item:

- [ ] `select * from cron.job;` shows `auto-poster-cron` active for **your** URL
- [ ] Settings shows "API key configured" for Gemini (or fallback captions set)
- [ ] Drive service account saved and folders shared with it
- [ ] Facebook connect imported your Pages (and IG accounts if linked)
- [ ] YouTube connect imported your channels
- [ ] Create a 1-video test campaign with a post time ~3 minutes ahead
- [ ] The post moves Pending → (≤1 min after its time) → Posted with a permalink
- [ ] The post appears publicly on the platform exactly **once**

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Google Drive service account credentials are missing" | Set both Drive fields in Settings → API Keys |
| "No permission to download…" | Share the folder (and shortcut targets) with the service account email |
| Post stuck in Pending past its time | Cron not running or pointed at wrong project — redo §1.3 |
| Post stuck in Processing | Auto-recovers within ~15 min: requeued if nothing published, or marked Failed with an explanation if partially published |
| "REJECTED: Video quality too low" | Video is under 720p — intentional, upload a higher-quality file |
| "A pending post for this video already exists" on Retry | The same video is already queued for that page/channel — delete one of the two |
| Facebook error 190 / token expired | Reconnect Facebook in Settings |
| YouTube upload 401 | Reconnect YouTube; ensure your Google user is a test user (or app is published) |
| Instagram "media processing failed" | IG requires MP4 (H.264/AAC), 9:16 preferred, ≤ 90s for Reels |
| Captions are generic/fallback | Gemini key missing or quota exhausted — posting continues with fallback captions |
| "Not authorized" calling functions | You are logged out, or the frontend `.env` points at a different project |

## Updating a deployment

```bash
git pull
supabase db push               # new migrations
supabase functions deploy auto-poster generate-schedule facebook-oauth \
  youtube-oauth generate-content profile-assistant list-folder-videos \
  validate-drive-links sync-analytics
npm run build                  # redeploy frontend
```
