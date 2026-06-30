# Vault — Deployment Guide

Vault is a Next.js app that needs `ffmpeg` + `yt-dlp` + `deno` installed on
the server. That rules out pure serverless hosts (Vercel, Netlify Functions)
— you need a host that runs Docker containers or full Node servers.

Below are the **3 best free options**, ranked by ease of setup.

---

## No cookies needed

Vault uses the **BgUtils PO Token provider** (same approach as Seal and
cobalt.tools) to bypass YouTube bot detection automatically. No cookies,
no sign-in, no user uploads. Just deploy and it works.

---

## Option 1 — Render (recommended, easiest)

Render's free tier gives you a Docker web service that sleeps when idle and
wakes on request. Perfect for personal use.

### Steps

1. **Push Vault to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/vault.git
   git push -u origin main
   ```

2. **Sign up at [render.com](https://render.com)** (free, no credit card)

3. **New → Web Service → Connect your GitHub repo**

4. Configure:
   - **Name:** `vault`
   - **Runtime:** Docker
   - **Region:** Closest to you
   - **Instance Type:** Free
   - **Dockerfile Path:** `./Dockerfile`

5. **Add Environment Variables** (in the Render dashboard → Environment):
   - `VAULT_CACHE_DIR` = `/data/media`
   - `NODE_ENV` = `production`

6. **Add a Disk** (so cached bundles persist across restarts):
   - Go to the service → **Disks** → **Add Disk**
   - Mount path: `/data`
   - Size: 1 GB (free)

7. **Deploy** — Render builds the Docker image and starts the service.
   First build takes ~5 minutes (installing ffmpeg + yt-dlp + deno + PO token provider).

8. You'll get a URL like `https://vault-abc123.onrender.com`. Open it,
   paste any YouTube link — it just works.

### Free tier limits
- 750 hours/month (always-on if you stay under)
- Service sleeps after 15 min idle (~50s cold start on wake)
- 1 GB disk

---

## Option 2 — Fly.io

Fly.io has a free allowance (3 shared-cpu VMs with 256MB RAM) that's enough
for Vault. Better for always-on usage since there's no sleep.

### Steps

1. **Install flyctl**: https://fly.io/docs/hands-on/install-flyctl/

2. **Sign up + login**:
   ```bash
   fly auth signup
   ```

3. **From the Vault project root**:
   ```bash
   fly launch --no-deploy
   ```
   - App name: `vault-downloader` (or whatever's available)
   - Region: closest to you
   - It'll detect the existing `fly.toml` — accept it

4. **Create a persistent volume**:
   ```bash
   fly volumes create vault_cache --region iad --size 1
   ```

5. **Set env vars**:
   ```bash
   fly secrets set VAULT_CACHE_DIR=/data/media
   ```

6. **Deploy**:
   ```bash
   fly deploy
   ```

7. Open `https://vault-downloader.fly.dev` → paste any YouTube link.

### Free tier limits
- 3 shared-cpu VMs (256MB RAM each) free per month
- 3 GB persistent volumes free
- No sleep — always on

---

## Option 3 — Railway ($5 free trial, then $5/month)

Railway is the easiest UI but only gives $5 free credit (≈1 month of small
container). After that it's $5/month.

### Steps

1. Push to GitHub (same as Render step 1)

2. Sign up at [railway.app](https://railway.app)

3. **New Project → Deploy from GitHub repo**

4. Railway auto-detects the Dockerfile and builds.

5. **Add a volume**: Settings → Volumes → Add → mount at `/data`

6. **Set env vars** (in Variables tab):
   - `VAULT_CACHE_DIR=/data/media`

7. You'll get a `xxx.up.railway.app` URL.

---

## Why not Vercel / Netlify?

These are serverless platforms that:
- Don't allow `ffmpeg` or `yt-dlp` binaries
- Cap function execution at 10-60 seconds (downloads take minutes)
- Don't have persistent filesystem (cache would vanish between requests)

Vault fundamentally needs a long-running server process. Render/Fly/Railway
are the right tools.

---

## How YouTube auth works (no cookies)

Vault uses the [BgUtils PO Token provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider)
— a yt-dlp plugin that generates Proof-of-Origin tokens automatically using
LuanRT's Botguard library. This is the same approach used by:

- **Seal** (Android downloader)
- **cobalt.tools** (web downloader)
- **yt-dlp itself** (recommended method in their FAQ)

The PO token makes YouTube think the request is coming from a legitimate
browser session, bypassing the "Sign in to confirm you're not a bot" wall.
Tokens are generated on-demand and cached, so there's no maintenance.

**Limits:** TikTok and Instagram have their own anti-bot systems that the PO
token doesn't help with. Those may still fail occasionally — the multi-client
fallback (`android`, `tv`, `ios`, etc.) handles most cases, but some content
genuinely can't be downloaded (private, members-only, region-locked).

---

## Updating

When you push new commits to GitHub, Render/Railway auto-redeploy.
On Fly.io, run `fly deploy` again.

Cached media bundles persist across deploys because they live on the mounted
disk, not in the container image.

---

## Troubleshooting

**Build fails with "pip not found"** — make sure the Dockerfile is using
`node:22-slim` (it includes apt for installing python3).

**YouTube says "rate-limiting"** — the PO token provider handles most bot
detection, but YouTube may still rate-limit aggressive usage. Wait a minute
and retry.

**TikTok / Instagram not working** — these platforms have aggressive anti-bot
that the PO token doesn't cover. The multi-client fallback helps, but some
content genuinely can't be downloaded.

**Out of disk** — Render free gives 1 GB. Cached bundles auto-dedupe by URL,
but you can SSH in and clear `/data/media/bundles/` if needed.

**Cold start slow** — Render free services sleep after 15 min idle. First
request takes ~30-50s to wake. Upgrade to paid tier for always-on.
