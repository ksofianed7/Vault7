# Vault — Complete App Specification

## Overview

Vault is a glassmorphic PWA video/audio downloader for YouTube, Instagram, and TikTok. It features real metadata extraction, real storyboard/waveform generation, frame-accurate trimming with audio playback, and an editorial dark-mode design. Built with Next.js 16, TypeScript, Tailwind CSS 4, yt-dlp, and ffmpeg.

---

## 1. Branding & Naming

- **App Name:** Vault
- **Tagline:** "Keep the frame, drop the noise."
- **Description:** "A considered downloader for YouTube, Instagram, and TikTok. Pick the moment, choose the format, archive it."
- **Version:** v.05
- **Logo:** Concentric vault-door marks (custom SVG, not lucide icons)
  - Outer square outline (coral #ff6b4a stroke)
  - Inner filled square (coral)
  - Corner ticks (warm gray)
- **PWA Package ID:** `com.ksofianed7.vault`

---

## 2. Design System

### 2.1 Color Palette

**Background:** Warm dark (NOT pure black, NOT navy)
- `--background: #0e0d0b` (warm ink)
- `--foreground: #f5efe0` (cream)

**Accents:**
- `--coral: #ff6b4a` (primary accent — buttons, active states, headlines)
- `--amber: #e8c547` (secondary accent — file sizes, auth badges)
- `--warm: #8a8474` (muted text, labels, metadata)

**Surfaces (opaque, NOT glassmorphism):**
- `.surface` — `#16140f` with `rgba(245,239,224,0.06)` border
- `.surface-raised` — `#1a1813` with shadow
- `.surface-inset` — `#0a0908` (deepest, for inputs)

### 2.2 Typography

Three-font system loaded via `next/font/google`:

| Font | Variable | Usage |
|------|----------|-------|
| **Fraunces** (variable serif, SOFT/WONK/opsz axes) | `--font-fraunces` | Headlines, section titles, app name, quality labels |
| **Inter Tight** (grotesque sans) | `--font-inter-tight` | Body text, buttons, descriptions |
| **JetBrains Mono** (monospace) | `--font-jetbrains-mono` | Micro-labels, timecodes, file sizes, catalog numbers, URLs |

- Tabular numbers enabled globally (`font-feature-settings: "ss01", "cv11", "tnum"`)
- Headlines use `italic font-light text-coral` for emphasis words

### 2.3 Layout

**Mobile (< 1024px):**
- `max-w-md` (28rem) centered container
- Bottom nav (pill-shaped, fixed)
- `px-5 pb-32 pt-8`

**Desktop (≥ 1024px):**
- Fixed left sidebar (`w-64`) with nav
- Sticky top bar with masthead
- `max-w-5xl` content area with `px-16` padding
- Bottom nav hidden (`lg:hidden`)
- Sidebar hidden on mobile (`hidden lg:flex`)

### 2.4 Editorial Details

- **Masthead row:** `№ 01 — THE VAULT — {date}` in mono with `0.2em` tracking
- **Figure captions:** `Fig. 01 — Input` above sections
- **Hairline rules:** `.hairline` utility with gradient fade
- **Filmstrip sprocket holes:** Light dots on dark strip above/below video thumbnails
- **Section numbering:** `01 —`, `02 —`, etc. in settings
- **Catalog numbers:** `№001` in history list

### 2.5 Custom SVG Nav Icons (NOT lucide)

```svg
<!-- VaultMark (download tab) -->
<rect x="2" y="2" width="12" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
<rect x="5" y="5" width="6" height="6" fill="currentColor" />

<!-- ArchiveMark (history tab) -->
<rect x="2" y="3" width="12" height="2.5" stroke="currentColor" strokeWidth="1.2" />
<rect x="2" y="7" width="12" height="2.5" stroke="currentColor" strokeWidth="1.2" />
<rect x="2" y="11" width="12" height="2.5" stroke="currentColor" strokeWidth="1.2" />

<!-- TuneMark (settings tab) -->
<path d="M2 4 L14 4 M2 8 L14 8 M2 12 L14 12" stroke="currentColor" strokeWidth="1.2" />
<circle cx="11" cy="4" r="1.5" fill="currentColor" />
<circle cx="5" cy="8" r="1.5" fill="currentColor" />
<circle cx="9" cy="12" r="1.5" fill="currentColor" />
```

---

## 3. Technology Stack

### Frontend
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 with custom utility classes
- **UI Library:** shadcn/ui (New York style) — only used for toaster/sonner
- **Animations:** Framer Motion (layout animations, page transitions, spring physics)
- **State:** Zustand with `persist` middleware (localStorage)
- **Icons:** Lucide React (for UI icons, NOT nav icons)

### Backend
- **API:** Next.js API Routes (App Router)
- **Video Pipeline:** Python 3 + yt-dlp + ffmpeg + deno
- **Database:** Prisma ORM + SQLite (download history)
- **Auth:** BgUtils PO Token provider (YouTube), operator-side cookies (Instagram)

### Infrastructure
- **Container:** Docker (node:22-slim base)
- **Deployment:** Railway (or Render/Fly.io)
- **PWA:** manifest.webmanifest + service worker (sw.js)
- **Port:** 3000 (or Railway's $PORT)
- **Bind:** 0.0.0.0 (required for Railway)

---

## 4. App Architecture

### 4.1 File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── fetch-meta/route.ts       # POST: yt-dlp metadata extraction
│   │   ├── download/route.ts          # POST: yt-dlp download + ffmpeg trim
│   │   ├── media/
│   │   │   ├── prepare/route.ts       # POST: storyboard + waveform + audio generation
│   │   │   └── file/route.ts          # GET: stream cached files (range support)
│   │   ├── auth-status/route.ts       # GET: check if Instagram cookies configured
│   │   └── history/route.ts           # GET/DELETE: Prisma history CRUD
│   ├── globals.css                    # Design system (colors, surfaces, utilities)
│   ├── layout.tsx                     # Fonts, metadata, PWA config, SW registration
│   └── page.tsx                       # Entry point → <VaultApp />
├── components/snapvault/
│   ├── snapvault-app.tsx              # App shell (sidebar + bottom nav + screens)
│   ├── bottom-nav.tsx                 # SideNav (desktop) + BottomNav (mobile)
│   ├── download-screen.tsx            # Main screen: URL input → preview → format → trim → download
│   ├── url-input.tsx                  # Command-bar style input with auto-detect
│   ├── media-preview.tsx              # Filmstrip thumbnail with sprocket holes
│   ├── format-picker.tsx              # Typographic toggle + vertical quality list
│   ├── trim-tool.tsx                  # Pro-editor timeline (storyboard/waveform + handles)
│   ├── download-button.tsx            # Progress bar + state machine
│   ├── downloads-tray.tsx             # Active downloads list
│   ├── history-screen.tsx             # Archive with catalog numbers
│   ├── settings-screen.tsx            # 5 sections: format, behavior, filename, storage, colophon
│   ├── platform-badge.tsx             # Colored dot + platform name
│   └── logo.tsx                       # VaultLogo SVG component
├── lib/
│   ├── platform.ts                    # URL detection + types + formatters
│   ├── store.ts                       # Zustand store (media, downloads, history, settings)
│   ├── filename.ts                    # Template application ({title}, {author}, etc.)
│   ├── db.ts                          # Prisma client
│   └── utils.ts                       # cn() utility
└── hooks/
    ├── use-toast.ts                   # shadcn toast hook
    └── use-mobile.ts                  # Mobile detection

public/
├── manifest.webmanifest               # PWA manifest with share_target
├── sw.js                              # Service worker (network-first)
├── icon-192.png / icon-512.png        # PWA icons
├── icon-512-maskable.png              # Maskable icon for Android
└── icon-192.svg / icon-512.svg        # SVG source icons

scripts/
├── source_pipeline.py                 # Python wrapper for yt-dlp + ffmpeg
└── pot-provider/                      # Vendored BgUtils PO Token provider (deno)

prisma/
└── schema.prisma                      # DownloadRecord model

Dockerfile                             # Full container build
render.yaml / fly.toml                 # Deployment configs
```

### 4.2 State Management (Zustand)

```typescript
interface Settings {
  defaultFormat: "video" | "audio";
  defaultQuality: string;
  autoTrim: boolean;
  saveHistory: boolean;
  hapticFeedback: boolean;
  filenameTemplate: string; // "{title} - {author} ({date})"
}

interface SnapVaultState {
  currentMedia: VideoMeta | null;
  mediaBundle: MediaBundle | null;
  isFetching: boolean;
  isPreparingMedia: boolean;
  downloads: DownloadItem[];
  history: HistoryItem[];
  settings: Settings;
  // ... actions
}
```

- `persist` middleware saves `history` and `settings` to localStorage
- `currentMedia`, `mediaBundle`, `downloads` are ephemeral (not persisted)

### 4.3 Types

```typescript
// platform.ts
type Platform = "youtube" | "instagram" | "tiktok" | "unknown";

interface VideoMeta {
  url: string;
  platform: Platform;
  title: string;
  author: string;
  thumbnail: string;
  duration: number; // seconds
  views?: string;
  description?: string;
  qualities: QualityOption[];
}

interface QualityOption {
  id: string;          // yt-dlp format_id
  label: string;       // "1080p" or "130 kbps"
  type: "video" | "audio";
  ext: string;         // "mp4" or "mp3"
  fps?: number;
  bitrate?: string;
  size?: string;       // "80.9 MB"
}

interface MediaBundle {
  bundleId: string;
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  storyboard: string[];   // URLs to thumbnails
  waveform: number[];     // 0..1 peaks (real, from ffmpeg)
  audioUrl: string;       // URL to MP3
}
```

---

## 5. Screen Specifications

### 5.1 Download Screen (Vault tab)

**Layout:** Single column, logical top-to-bottom flow:
1. Editorial hero (headline + tagline)
2. URL input (command-bar style with `/` prefix)
3. Loading state (spinner + "Acquiring source…")
4. Media preview (filmstrip with sprocket holes)
5. Format picker (typographic toggle + vertical quality list)
6. Trim section (collapsible)
7. Custom filename input
8. Download button

**URL Input:**
- Terminal-style `/` prefix
- Mono font
- Coral arrow button appears only when valid URL detected
- Auto-detects platform, shows badge with colored dot

**Media Preview:**
- Filmstrip with sprocket holes (top + bottom rows)
- 16:10 aspect ratio thumbnail
- Platform badge (top-left), duration pill (top-right)
- Center play button (cream circle, ink icon)

**Format Picker:**
- Typographic toggle (no pill) — "Video MP4" / "Audio MP3" with sliding coral underline
- Vertical quality list with hairline dividers
- Each row: checkmark (coral when selected), quality label (Fraunces), mono size/fps/bitrate
- Only shows qualities that actually exist (no fake 4K)

**Trim Tool:**
- Collapsible section with "preparing" / "ready" status indicator
- Pro-editor timeline:
  - Ruler with tick marks (5s/10s/30s intervals based on duration)
  - Video mode: storyboard thumbnails (max 20, evenly sampled for long videos)
  - Audio mode: single-direction bars from bottom (coral in-range, dim out-of-range)
  - Draggable handles (coral, 4px stem + 16x40px grip)
  - Amber playhead (vertical line + diamond head)
  - Playback controls (skip back, play/pause, skip forward)
  - IN/OUT timecode labels
  - Real audio playback via hidden `<audio>` element synced to playhead
  - Auto-stops at trim end, resets to trim start

**Download Button:**
- Cream background, ink text
- Progress fill (coral, left-to-right)
- 4-stage state: idle → fetching (XX%) → done (✓) → error
- Triggers browser download via `<a>` element

### 5.2 History Screen (Archive tab)

- Section header: "Archive" + item count
- Search input (mono font)
- List items in 2-column grid on desktop, single column on mobile
- Each item: catalog number (№001), thumbnail, platform badge, title, author, duration, quality, file size (amber), trim range
- Hover-to-reveal delete button
- Clear all button

### 5.3 Settings Screen (Tune tab)

5 sections in 2-column grid on desktop:

1. **Default format** — Video / Audio choice cards
2. **Behavior** — Auto-open timeline, Persist to archive, Haptic feedback toggles
3. **Filename** — Template input with variable chips ({title}, {author}, {platform}, {quality}, {format}, {date})
4. **Storage** — Clear archive button
5. **Colophon** — Logo, version, platform auth status (YouTube: PO Token, TikTok: Impersonation, Instagram: Cookies configured / Needs operator cookies)

---

## 6. Backend API

### 6.1 POST /api/fetch-meta
- **Input:** `{ url: string }`
- **Process:** Calls `python3 scripts/source_pipeline.py probe_meta <url>`
- **YouTube:** Tries clients ["default", "web_safari", "tv", "ios", "mweb"], picks the one with most complete format list (score = max_height + audio_count * 1000). Only accepts clients with BOTH video AND audio. EXCLUDES "android" client (returns 360p only).
- **Instagram:** Tries yt-dlp with cookies first, falls back to embed endpoint
- **TikTok:** yt-dlp with curl_cffi impersonation
- **Output:** `{ url, platform, title, author, thumbnail, duration, views, qualities }`

### 6.2 POST /api/media/prepare
- **Input:** `{ url: string }`
- **Process:**
  1. Cleanup old bundles (>30 min old) — fire and forget
  2. Check cache (skip if manifest.json exists)
  3. Download source video (720p max, video+audio merged)
  4. Generate storyboard (1fps, 160px wide)
  5. Generate waveform (200 peaks from real PCM audio)
  6. Extract full-length audio MP3
  7. Probe duration with ffprobe
  8. **Delete source.mp4** (saves 12MB+ per video)
  9. Write manifest.json
- **Output:** `{ bundleId, duration, storyboard[], waveform[], audioUrl }`

### 6.3 POST /api/download
- **Input:** `{ url, format, qualityId, qualityLabel, ext, trimStart?, trimEnd?, title, author, customFilename? }`
- **Process:** Calls `python3 scripts/source_pipeline.py download_quality`
  - YouTube: `format_id+bestaudio/format_id/best[ext=mp4]/best` with `--merge-output-format mp4`
  - Instagram embed: direct URL download via ffmpeg
  - Audio (MP3): download → ffmpeg extract audio → libmp3lame encode
  - Video: download → ffmpeg trim (if needed) → copy
- **Output:** `{ ok, id, fileName, size, downloadUrl }`
- **Streaming:** File served via `createReadStream` (not buffered into memory), supports HTTP Range requests

### 6.4 GET /api/media/file
- **Params:** `bundleId, kind (storyboard|audio|waveform|download), name`
- **Streaming:** Uses `createReadStream` + `Readable.toWeb` (zero memory buffering)
- **Range support:** 206 Partial Content for audio seeking + resumable downloads
- **Cache:** `Cache-Control: public, max-age=86400, immutable`

### 6.5 GET /api/auth-status
- **Output:** `{ instagram: boolean }` — checks if cookies.txt exists on disk

### 6.6 GET/DELETE /api/history
- Prisma CRUD for DownloadRecord model

---

## 7. Python Pipeline (source_pipeline.py)

### 7.1 Key Functions

```python
probe_meta(url)          # yt-dlp -J with multi-client fallback
download_source(url, path)  # Download 720p preview video
download_quality(url, format_id, path, ext, start, end)  # Download specific format
generate_storyboard(source, dir, fps, width)  # ffmpeg thumbnails
generate_waveform(source, path, samples)  # ffmpeg PCM → JSON peaks
generate_audio(source, path, start, end)  # ffmpeg MP3 extraction
```

### 7.2 YouTube Client Selection

```python
YT_CLIENTS = ["default", "web_safari", "tv", "ios", "mweb"]
# EXCLUDES "android" — returns 360p only with no audio
```

- Tries each client, scores by `max_height + audio_count * 1000`
- Only accepts clients with BOTH video AND audio
- Uses PO Token (BgUtils provider) via deno

### 7.3 PO Token Setup

```python
# yt_dlp_args() adds:
--js-runtimes deno:/usr/local/bin/deno  # Explicit deno path
--extractor-args youtubepot-bgutilscript:server_home=<path>
```

### 7.4 Instagram

- Tries yt-dlp with cookies (`VAULT_COOKIES_B64` env var) first
- Falls back to embed endpoint (`/p/{shortcode}/embed/`)
- Extracts video URL, thumbnail, title, real dimensions from embed HTML

### 7.5 Vertical Video Detection

```python
# Detect from format dimensions
if height > width:
    is_vertical = True
# Fallback: detect from URL
if "/shorts/" in url or "/reel/" in url or "tiktok.com" in url:
    is_vertical = True
# Use width (smaller dimension) as quality label for vertical
quality_key = width if is_vertical else height
```

### 7.6 TikTok Audio

- TikTok only has combined video+audio (no separate audio formats)
- When no audio formats found, offers "Standard" audio by extracting from best video

### 7.7 Error Messages

```python
# Instagram auth required
"Instagram requires authentication in 2026. The operator needs to set the VAULT_COOKIES_B64 env var."

# YouTube rate limit
"Requested format is not available" → "YouTube is rate-limiting this server. The PO Token provider may not be working."

# Video unavailable
"This video is unavailable. It may have been removed or made private."
```

---

## 8. Disk & Memory Management

### 8.1 Disk Cleanup
- `cleanupOldBundles()` runs on every `/api/media/prepare` request
- Deletes bundles + downloads older than **30 minutes**
- `source.mp4` deleted immediately after storyboard/waveform generation

### 8.2 Streaming Downloads
- File serving uses `createReadStream` (NOT `readFile`)
- Zero memory buffering — constant ~1MB regardless of file size
- HTTP Range support (206 Partial Content) for audio seeking + resumable downloads

### 8.3 Bundle Structure

```
/data/media/bundles/<bundleId>/
├── manifest.json      # ~5KB — cached metadata
├── audio.mp3          # ~5MB — for trim playback
├── waveform.json      # ~4KB — 200 peaks
└── storyboard/        # ~1MB — thumbnails
    ├── thumb_0001.jpg
    └── thumb_0002.jpg
# source.mp4 DELETED after processing
```

---

## 9. PWA Configuration

### 9.1 Manifest

```json
{
  "name": "Vault",
  "short_name": "Vault",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0e0d0b",
  "theme_color": "#0e0d0b",
  "share_target": {
    "action": "/",
    "method": "GET",
    "params": { "title": "title", "text": "text", "url": "url" }
  },
  "shortcuts": [{
    "name": "Paste a link",
    "url": "/?focus=input"
  }]
}
```

### 9.2 Service Worker

- Network-first strategy (try network, fall back to cache)
- Caches: `/`, manifest, icons
- Skips cross-origin requests (API calls to yt-dlp etc.)
- Registered in layout.tsx via inline script

### 9.3 Share Intent

- Manifest `share_target` accepts `url`, `text`, and `title` params
- Download screen checks both `url` and `text` params
- If `text` provided, extracts URL via regex (`https?://[^\s]+`)
- Auto-fetches the shared URL, cleans the URL bar

---

## 10. Custom Filename Templates

### 10.1 Template Variables

| Variable | Replaced with | Example |
|----------|---------------|---------|
| `{title}` | Video title | "Sunset Drive" |
| `{author}` | Channel/uploader | "Aurora Studio" |
| `{platform}` | youtube/tiktok/instagram | "youtube" |
| `{quality}` | Resolution/bitrate | "1080p" |
| `{format}` | video/audio | "video" |
| `{date}` | Today's date (YYYY-MM-DD) | "2026-07-01" |

### 10.2 Sanitization
- Removes `<>:"/\|?*` (Windows illegal chars)
- Collapses multiple spaces
- Caps at 120 characters
- Always appends extension if missing

### 10.3 UI
- Settings → Section 03: Filename — template input + variable chips
- Download screen — per-download filename input with "Use template" button
- Leave empty → uses video title

---

## 11. Dockerfile

```dockerfile
FROM node:22-slim AS base

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 python3-pip python3-venv curl unzip git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Swap for build memory
RUN fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile || true

# Deno (direct binary download — install script is unreliable in Docker)
RUN curl -fsSL https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip -o /tmp/deno.zip && \
    unzip /tmp/deno.zip -d /tmp && mv /tmp/deno /usr/local/bin/deno && \
    chmod +x /usr/local/bin/deno && rm /tmp/deno.zip
ENV DENO_DIR=/usr/local/deno
ENV PATH="/usr/local/bin:${PATH}"

# Python packages (yt-dlp pre-release + yt-dlp-ejs for nsig + PO token provider)
RUN pip3 install --break-system-packages --no-cache-dir --pre yt-dlp
RUN pip3 install --break-system-packages --no-cache-dir yt-dlp-ejs
RUN pip3 install --break-system-packages --no-cache-dir pycryptodomex
RUN pip3 install --break-system-packages --no-cache-dir bgutil-ytdlp-pot-provider
RUN pip3 install --break-system-packages --no-cache-dir curl_cffi || echo "curl_cffi failed"

# Node deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN npm install --legacy-peer-deps

# Build
COPY . .
RUN npx prisma generate
RUN npm run build
RUN cp -r node_modules/.prisma .next/standalone/node_modules/.prisma 2>/dev/null || true
RUN cp -r node_modules/@prisma/client .next/standalone/node_modules/@prisma/client 2>/dev/null || true
RUN cp -r scripts .next/standalone/scripts

# PO Token deno deps (MUST succeed)
WORKDIR /app/.next/standalone/scripts/pot-provider
RUN deno install --allow-scripts=npm:canvas || deno install || true
RUN deno --version

# Runtime
RUN mkdir -p /data/media /data/db
ENV VAULT_CACHE_DIR=/data/media
ENV DATABASE_URL=file:/data/db/vault.db
ENV HOSTNAME=0.0.0.0
ENV VAULT_COOKIES_B64=""
ENV PORT=3000
EXPOSE 3000

RUN cd /app && npx prisma db push --skip-generate || true

WORKDIR /app/.next/standalone
CMD ["sh", "-c", "node server.js -H 0.0.0.0 -p ${PORT:-3000}"]
```

---

## 12. Environment Variables

| Variable | Value | Required |
|----------|-------|----------|
| `VAULT_CACHE_DIR` | `/data/media` | Yes |
| `DATABASE_URL` | `file:/data/db/vault.db` | Yes |
| `NODE_ENV` | `production` | Yes |
| `HOSTNAME` | `0.0.0.0` | Yes (Railway) |
| `PORT` | `3000` (or Railway's $PORT) | Yes |
| `VAULT_COOKIES_B64` | Base64-encoded cookies.txt | Instagram only |
| `DENO_DIR` | `/usr/local/deno` | Yes |

---

## 13. Key Design Decisions

1. **Opaque surfaces, not glassmorphism** — AI slop uses backdrop-blur. Vault uses solid warm dark surfaces.
2. **Custom SVG nav icons** — Not lucide stock icons. Concentric squares, stacked plates, mixer sliders.
3. **Only real qualities** — No fake 4K if video is 1080p. No fake 320kbps if source is 128kbps.
4. **Editorial typography** — Fraunces serif headlines, Inter Tight body, JetBrains Mono micro-labels. Not Inter-everywhere.
5. **Filmstrip details** — Sprocket holes on media preview. Catalog numbers in history. Figure captions.
6. **PO Token for YouTube** — Same approach as Seal/cobalt.tools. No cookies needed.
7. **Operator-side cookies for Instagram** — Users never see cookies. Set via env var.
8. **No auto-restart** — Was useless for disk issues. 30-min cleanup handles it.
9. **Streaming downloads** — Zero memory buffering. Constant ~1MB regardless of file size.
10. **Single-column layout** — Preview → Format → Trim → Filename → Download. Natural top-to-bottom flow.
