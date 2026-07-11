# Go Live for FREE — GitHub + Cloudflare Pages + Supabase + Custom Domain

This guide takes this code from a folder on your computer to a live production
app with your own domain, using only free tiers:

| Piece | Service | Free tier |
|---|---|---|
| Code hosting + auto-deploy trigger | **GitHub** | Free (public or private repo) |
| Frontend hosting + HTTPS + CDN | **Cloudflare Pages** | Free (500 builds/month, unlimited bandwidth) |
| Database, auth, edge functions, cron | **Supabase** | Free (500 MB DB, 500K function calls/month) |
| Custom domain | **Cloudflare DNS** | Free (you only pay the domain registrar, ~$10/yr) |

Do the steps in this order.

---

## Step 1 — Upload the code to YOUR GitHub

1. Create a GitHub account at [github.com](https://github.com) if you don't have one.
2. Click **+ → New repository** → name it (e.g. `pixeloon`) → **Private** →
   **Create repository** (do NOT add a README/.gitignore — the repo must be empty).
3. On your computer, open a terminal in the project folder and run:

```bash
git init                                   # skip if the folder is already a git repo
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/pixeloon.git
git push -u origin main
```

> If the folder was cloned from somewhere else, replace the remote instead:
> `git remote set-url origin https://github.com/<your-username>/pixeloon.git && git push -u origin main`

Your code is now on GitHub. Every future `git push` will auto-deploy the site
(Step 3 sets that up).

---

## Step 2 — Set up Supabase (the backend)

Follow **[docs/SETUP.md](SETUP.md) Part 1** — it walks through this in detail.
Short version:

1. Create a free project at [supabase.com](https://supabase.com) → note your
   **Project URL**, **anon key**, and **project ref** (Project Settings → API).
2. Install the CLI and push the database:

```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

3. Deploy the edge functions:

```bash
supabase functions deploy auto-poster generate-schedule facebook-oauth \
  youtube-oauth generate-content profile-assistant list-folder-videos \
  validate-drive-links sync-analytics
```

4. Create the every-minute posting cron (SQL Editor — use YOUR url + anon key):

```sql
select cron.schedule(
  'auto-poster-cron', '* * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/auto-poster',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <YOUR-ANON-KEY>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

5. (Optional) Cloudinary secrets for logo watermarking — see SETUP.md §1.5.

---

## Step 3 — Deploy the frontend on Cloudflare Pages

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com).
2. Go to **Workers & Pages → Create → Pages → Connect to Git**.
3. Authorize Cloudflare to access your GitHub → select your `pixeloon` repo.
4. Build settings:
   - **Framework preset**: `Vite` (or None)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. **Environment variables** (Add variable — set for Production *and* Preview):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your Supabase **anon** key |
| `VITE_SUPABASE_PROJECT_ID` | `<project-ref>` |

6. Click **Save and Deploy**. In ~2 minutes your app is live at
   `https://<project-name>.pages.dev`.

Deep links (e.g. `/campaign/...`) work because the repo ships a
`public/_redirects` file that routes all paths to the React app.

**Auto-deploy**: from now on, every `git push` to `main` rebuilds and publishes
the site automatically.

---

## Step 4 — Connect Supabase auth to your site URL

So login links/redirects point at your real site:

1. Supabase dashboard → **Authentication → URL Configuration**:
   - **Site URL**: `https://<project-name>.pages.dev` (update again in Step 5
     when your custom domain is live)
   - **Redirect URLs**: add both `https://<project-name>.pages.dev/**` and
     (later) `https://yourdomain.com/**`

---

## Step 5 — Custom domain (free on Cloudflare)

1. Buy a domain anywhere (Cloudflare Registrar, Namecheap, GoDaddy… ~$10/yr —
   the only paid thing in this stack).
2. If the domain is NOT already on Cloudflare: Cloudflare dashboard → **Add a
   domain** → follow the instructions to change your **nameservers** at the
   registrar to Cloudflare's (takes minutes to a few hours).
3. **Workers & Pages → your project → Custom domains → Set up a custom domain**
   → enter `yourdomain.com` (and again for `www.yourdomain.com` if you want).
   Cloudflare creates the DNS records and HTTPS certificate automatically.
4. Update the pieces that reference your URL:
   - Supabase **Authentication → URL Configuration** → Site URL =
     `https://yourdomain.com`, and add `https://yourdomain.com/**` to Redirect URLs.
   - Facebook app → Facebook Login → Settings → Valid OAuth Redirect URIs →
     add `https://yourdomain.com/facebook-callback`
   - Google Cloud OAuth client → Authorized redirect URIs →
     add `https://yourdomain.com/youtube-callback`

Done — the app is live on your own domain with automatic HTTPS.

---

## Step 6 — First login and user setup

1. Open your site → sign up.
2. Make yourself admin (Supabase SQL Editor):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

3. Each user then configures their own API keys in **Settings** — follow
   **[docs/SETUP.md](SETUP.md) Part 2** (Gemini, Google Drive service account,
   Facebook app, YouTube OAuth) and run the **Part 4 verification checklist**.

---

## Everyday workflow

```bash
# make changes locally, then:
git add -A && git commit -m "my change" && git push     # frontend auto-deploys

# only when you changed things under supabase/:
supabase db push                                        # new migrations
supabase functions deploy <changed-function>            # changed functions
```

## Free-tier limits to know

- **Supabase free**: 500 MB database, 1 GB file storage, 500K edge-function
  invocations/month. The cron alone uses ~43K invocations/month — fine. Projects
  **pause after 1 week with no API activity**; the every-minute cron keeps yours
  active automatically.
- **Cloudflare Pages free**: 500 builds/month, unlimited requests/bandwidth.
- Video uploads flow through Supabase edge functions' memory — very large video
  files (multi-GB) may need the Supabase Pro tier's higher limits.
