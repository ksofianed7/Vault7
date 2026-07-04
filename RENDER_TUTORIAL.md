# How to Publish Vault on Render — Step by Step

## Prerequisites

- A GitHub account
- A Render account (free, no credit card needed)

---

## Step 1 — Push Vault to GitHub

Open your terminal and run:

```bash
cd /home/z/my-project

# Push the code to your GitHub repo
git push -u origin main
```

**If it asks for a username/password:**
- Username: `ksofianed7`
- Password: Use a **Personal Access Token** (not your GitHub password)
  - Go to: https://github.com/settings/tokens
  - Click **Generate new token (classic)**
  - Check the `repo` box
  - Click **Generate token**
  - Copy the token (starts with `ghp_`)
  - Paste it as your password when pushing

**If you see "repository not found":**
You need to create the repo on GitHub first:
1. Go to https://github.com/new
2. Repository name: `vault`
3. Set to **Private** (recommended)
4. **Don't** check "Add a README"
5. Click **Create repository**
6. Then run the `git push` command again

---

## Step 2 — Sign up for Render

1. Go to https://render.com
2. Click **Sign Up** (top right)
3. Sign up with your GitHub account (easiest — it auto-connects your repos)
4. Complete the onboarding

---

## Step 3 — Create the Web Service

1. In the Render dashboard, click **New +** (top right)
2. Select **Web Service**
3. You'll see a list of your GitHub repos — find `vault` and click **Connect**
   - If you don't see it, click **Configure account** to give Render access to that repo
4. Fill in the settings:

| Field | Value |
|-------|-------|
| **Name** | `vault` (or anything you want) |
| **Region** | Pick the closest to you |
| **Runtime** | **Docker** |
| **Instance Type** | **Free** |
| **Dockerfile Path** | `./Dockerfile` (default) |

5. Scroll down to **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `VAULT_CACHE_DIR` | `/data/media` |
| `NODE_ENV` | `production` |
| `VAULT_COOKIES_B64` | *(your base64 Instagram cookies — optional, only for Instagram. See DEPLOY.md)* |

6. Scroll down to **Disks** and click **Add Disk**:

| Field | Value |
|-----|-------|
| **Name** | `vault-cache` |
| **Mount Path** | `/data` |
| **Size** | `1` GB |

7. Click **Create Web Service**

---

## Step 4 — Wait for the build

Render will now:
1. Pull the `node:22-slim` Docker image
2. Install `ffmpeg`, `python3`, `deno`, `yt-dlp`, `curl_cffi`, `bgutil-ytdlp-pot-provider`
3. Install your npm dependencies
4. Build the Next.js app
5. Install the PO Token provider's deno dependencies

**This takes ~5-10 minutes** on the first build (it's installing a lot).

You can watch the build logs in real-time in the Render dashboard. When you see:

```
==> Your service is live 🎉
```

…you're ready.

---

## Step 5 — Test it

Render gives you a URL like:
```
https://vault-abc123.onrender.com
```

Open it in your browser. You'll see the Vault app. Test it:

1. Paste a YouTube link (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
2. Click the arrow button (or press Enter)
3. Wait ~15 seconds for real metadata + storyboard + waveform to generate
4. You'll see:
   - Real video title, author, duration
   - Real quality options (only what the video actually has — 2160p, 1080p, etc.)
   - Real file sizes
5. Click **Trim** to expand the timeline
   - Video mode: real storyboard frames from the video
   - Audio mode: real waveform from the audio track
6. Click **Play** — you'll hear real audio, synced to the playhead
7. Click **Save to vault** — the real file downloads to your device

---

## Step 6 — Install as an Android app (optional)

Vault is a PWA, so you can install it on Android:

1. Open your Render URL in **Chrome** on your Android phone
2. Tap the **three dots** menu (top right)
3. Tap **Install app**
4. Vault appears in your app drawer with its own icon
5. Opens fullscreen like a native app

---

## Troubleshooting

### "Build failed" during Docker build

**Symptom:** Render logs show an error during `npm install` or `deno install`.

**Fix:** Check the full logs. Common causes:
- NPM registry rate limit → wait 5 min and click **Manual Deploy → Clear build cache & deploy**
- Deno install fails → the `|| true` in the Dockerfile means it won't block the build, but the PO token won't work. Re-deploy.

### YouTube says "rate-limiting" or "bot detection"

**Symptom:** You paste a YouTube link and get an error.

**Fix:** The PO token provider handles most bot detection, but YouTube may still rate-limit aggressive usage from a fresh IP. Wait 1-2 minutes and retry. After the first few requests, YouTube usually calms down.

### The app is slow to respond

**Symptom:** First request takes 30-50 seconds.

**Fix:** This is the Render free tier "cold start" — the service sleeps after 15 min of inactivity. The first request wakes it up. To keep it always-on, upgrade to the **Starter** plan ($7/month).

### "Disk full" error

**Symptom:** Downloads start failing after a while.

**Fix:** The 1GB disk fills up with cached media bundles. You can:
- SSH into the service and clear `/data/media/bundles/`
- Or just delete the disk and re-add it (you'll lose cached bundles, but cookies are auto-generated so no setup needed)

### TikTok / Instagram don't work

**Symptom:** YouTube works but TikTok/Instagram return errors.

**Fix:** These platforms have their own anti-bot systems that the PO token doesn't cover. The multi-client fallback (`android`, `tv`, `ios`, etc.) handles some cases, but many TikTok/Instagram videos genuinely can't be downloaded without platform-specific auth. This is a known limitation — even Seal and cobalt.tools have this issue.

---

## Updating Vault

When you want to update Vault with new code:

```bash
# Make your changes locally
git add .
git commit -m "description of changes"
git push
```

Render auto-deploys on every push to `main`. You'll see the new build in the Render dashboard. Your cached bundles and cookies persist across deploys (they're on the disk, not in the container).

---

## Cost

**Free tier:**
- 750 hours/month (enough for always-on if you don't hit the sleep threshold)
- 1 GB disk
- Service sleeps after 15 min idle (~30-50s cold start on wake)

**If you need always-on ($7/month):**
- Upgrade to **Starter** plan
- No sleep, faster cold starts
- 512 MB RAM (vs 256 MB on free)

For personal use, the free tier is plenty. Upgrade only if you share it with friends and want zero cold starts.

---

## You're done! 🎉

Your Vault is live at `https://vault-xxxxx.onrender.com`. Share the URL, install it on your phone, and download anything from YouTube/Instagram/TikTok with real metadata, real storyboards, real waveforms, and real trim — no cookies, no sign-in, no BS.
