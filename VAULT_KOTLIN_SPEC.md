# Vault — Native Android (Kotlin) App Specification

## Project Overview

Build a native Android application called "Vault" — a professional video/audio downloader for YouTube, Instagram, TikTok, and Pinterest. The app must work **100% offline without any backend server**. All downloading, trimming, and processing happens directly on the user's device.

**CRITICAL REQUIREMENT:** This app must NOT depend on any external server, API, or cloud service for its core functionality. Everything (metadata extraction, downloading, trimming, format conversion) must happen locally on the Android device using bundled libraries.

---

## Tech Stack

- **Language:** Kotlin
- **UI Framework:** Jetpack Compose (Material 3)
- **Architecture:** MVVM with ViewModel + StateFlow
- **Minimum SDK:** API 24 (Android 7.0)
- **Target SDK:** API 35 (Android 15)

### Bundled Libraries (NO server needed)

1. **yt-dlp** — Use the `yaab` (Yet Another Android Bot) or `yt-dlp-android` library to run yt-dlp locally on-device. This handles:
   - Video metadata extraction (title, author, thumbnail, duration, available formats)
   - Downloading video/audio streams
   - Bypassing YouTube bot detection (using on-device PO Token generation via the BgUtils provider)

2. **ffmpeg-kit** (or `mobile-ffmpeg`) — For:
   - Trimming video/audio (frame-accurate)
   - Extracting audio from video (MP3 conversion)
   - Generating storyboard thumbnails (one per second)
   - Computing waveform data from audio

3. **Coil** — Image loading (thumbnails, storyboards)

4. **ExoPlayer** (Media3) — Audio playback during trim preview

5. **Room Database** — Local download history (replacing Prisma/SQLite from the web version)

6. **DataStore** — Settings persistence (replacing Zustand/localStorage)

---

## Design System

The app must have a premium, editorial aesthetic — NOT a generic Material 3 app.

### Color Palette (Dark Theme Only)

- **Background:** `#0e0d0b` (warm ink — NOT pure black, NOT navy)
- **Foreground:** `#f5efe0` (cream)
- **Primary Accent:** `#ff6b4a` (coral — buttons, active states, highlights)
- **Secondary Accent:** `#e8c547` (amber — file sizes, badges)
- **Muted Text:** `#8a8474` (warm gray — labels, metadata)
- **Surface:** `#16140f` (card background)
- **Surface Inset:** `#0a0908` (input background)

### Typography (MUST match the web version)

- **Headlines:** Fraunces (variable serif, italic for emphasis words)
- **Body:** Inter Tight (grotesque sans)
- **Monospace:** JetBrains Mono (timecodes, file sizes, catalog numbers, micro-labels)

Load these as custom fonts in `res/font/` or via Google Fonts dependency.

### Layout Principles

- **Mobile:** Single column, bottom navigation (pill-shaped)
- **Tablet/Desktop:** Left sidebar navigation, wider content area
- Generous padding, hairline dividers, editorial details (figure captions, catalog numbers)
- Opaque surfaces (NOT glassmorphism/blur — that's "AI slop")

### Custom Icons (NOT Material Icons)

Use custom vector drawables:
- **Vault tab:** Concentric squares (outer outline + inner filled)
- **Archive tab:** Three horizontal stacked plates
- **Tune tab:** Mixer sliders (three horizontal lines with dots)

---

## Core Features

### 1. URL Input + Auto-Detect

- Command-bar style input with `/` prefix (terminal aesthetic)
- Mono font (JetBrains Mono)
- Auto-detects platform from URL:
  - YouTube (youtube.com, youtu.be, /shorts/)
  - Instagram (instagram.com, /reel/, /p/)
  - TikTok (tiktok.com, vm.tiktok.com)
  - Pinterest (pinterest.com, pin.it)
- Shows platform badge with colored dot (YouTube=red, Instagram=pink/gold, TikTok=cyan, Pinterest=red)
- Submit button (coral arrow) appears only when valid URL detected

### 2. Metadata Extraction (On-Device)

When user submits a URL:
1. Run yt-dlp locally to extract video metadata
2. Return: title, author, thumbnail URL, duration (seconds), view count, description
3. Extract ALL available formats from the source
4. Show ONLY real qualities (no fake 4K if video is 1080p)
5. **FPS Priority:** At each resolution, pick the HIGHEST FPS format (60fps > 30fps). This is critical — YouTube often has both 30fps and 60fps variants at 1080p.

#### YouTube Authentication (NO cookies, NO server)
- Use the BgUtils PO Token provider running locally on-device
- This generates Proof-of-Origin tokens to bypass YouTube's "Sign in to confirm you're not a bot" wall
- Same approach as Seal and cobalt.tools
- Requires bundling deno or a JS runtime for the PO token script

#### Instagram Authentication
- Instagram requires login in 2026 — even for public posts
- Store Instagram cookies locally on-device (user exports from browser, imports into app)
- Pass cookies to yt-dlp via `--cookies` flag
- Store securely in Android Keystore or EncryptedSharedPreferences

### 3. Media Preview

- Filmstrip aesthetic: sprocket holes (small dots) above and below the thumbnail
- 16:10 aspect ratio thumbnail
- Platform badge (top-left), duration pill (top-right, mono font)
- Center play button (cream circle, ink play icon)

### 4. Format Picker

- **Typographic toggle:** "Video MP4" / "Audio MP3" with sliding coral underline (NOT a pill toggle)
- **Vertical quality list:** Each row shows:
  - Checkmark (coral when selected)
  - Quality label (Fraunces serif: "1080p", "720p", "130 kbps")
  - Sub-label (JetBrains Mono: "60fps", "128k", file size)
  - Hairline divider between rows
- Only shows qualities that actually exist in the source

### 5. Vertical Video Detection

- Detect if video is vertical (height > width)
- For vertical videos (Shorts/Reels/TikTok), show the SMALLER dimension as the label
  - 1080×1920 → show "1080p" (NOT "1920p")
- YouTube Shorts, Instagram Reels, and TikTok are always vertical

### 6. Trim Tool (Pro-Editor Style)

Collapsible section with "preparing" / "ready" status.

#### Timeline Visualization

- **Video mode:** Real storyboard thumbnails (extracted via ffmpeg, one per second)
  - Max 20 thumbnails (evenly sampled for long videos — don't show 200 thumbnails for a 3-min video)
  - Thumbnails outside trim range are dimmed/grayscale
- **Audio mode:** Real waveform (computed from audio track via ffmpeg)
  - Single-direction bars from bottom
  - Coral (#ff6b4a) for in-range, dim white for out-of-range
  - Boost small values: `Math.pow(amplitude, 0.6)` so quiet parts are visible

#### Timeline Controls

- **Ruler:** Tick marks at 5s/10s/30s intervals (based on duration)
- **Handles:** Two draggable handles (coral, 4px stem + 16×40px grip box) for IN/OUT points
- **Playhead:** Amber (#e8c547) vertical line with diamond head
- **Playback:** Real audio playback via ExoPlayer, synced to playhead
  - Auto-stops at trim OUT point, resets to trim IN point
  - Skip back / Play-Pause / Skip forward controls
- **Timecodes:** IN and OUT displayed in mono font (e.g., "IN 0:15  OUT 1:42")

#### Audio Playback During Trim

- Extract full-length audio from the video (MP3 via ffmpeg)
- Play with ExoPlayer bounded by IN/OUT marks
- Playhead moves in real-time with the audio
- User hears actual audio while trimming

### 7. Custom Filename

- Input field below trim section
- "Use template" button to apply template from settings
- Template variables: `{title}`, `{author}`, `{platform}`, `{quality}`, `{format}`, `{date}`
- Sanitize: remove illegal chars `<>:"/\|?*`, cap at 120 chars, ensure extension
- Leave empty → uses video title

### 8. Download

- Cream button with coral progress fill (left-to-right)
- 4-stage state: idle → downloading (XX%) → done (✓) → error
- Downloads the exact format selected (with highest FPS at that resolution)
- For YouTube DASH: download video + best audio, merge via ffmpeg
- If trim is set: ffmpeg trims to IN/OUT marks
- File saved to `Downloads/Vault/` directory
- Shows toast notification on completion

### 9. Download History (Archive)

- Room database stores: URL, platform, title, author, thumbnail, duration, format, quality, trim range, file size, timestamp
- List with catalog numbers (№001, №002, etc.)
- Each row: thumbnail, platform badge, title, author, duration, quality, file size (amber), trim range
- Search by title/author/URL
- Delete individual items or clear all
- Two-column grid on tablet

### 10. Settings

1. **Default format** — Video / Audio cards
2. **Behavior** — Auto-open timeline, Persist to archive, Haptic feedback toggles
3. **Filename** — Template editor with variable chips
4. **Storage** — Clear archive
5. **Colophon** — App info, platform auth status

### 11. Android Share Intent

- Register `intent-filter` for `text/plain` shared URLs
- When user shares a video URL from YouTube/TikTok/Instagram apps → Vault opens and auto-fetches
- Extract URL from shared text using regex

---

## Platform-Specific Behavior

### YouTube

- **Auth:** PO Token provider (on-device, no cookies)
- **Clients:** Try `default` client first (has PO token + full DASH list). Exclude `android` client (returns 360p only). Fallback to `web_safari`, `tv`, `ios`, `mweb`.
- **Formats:** DASH video-only + separate audio. Must merge with ffmpeg.
- **Qualities:** 144p, 240p, 360p, 480p, 720p, 1080p, 1440p, 2160p
- **FPS:** 25, 30, 50, 60 — always pick highest FPS at each resolution
- **Format selector:** `format_id+bestaudio/format_id/best[ext=mp4]/best`

### TikTok

- **Auth:** curl_cffi impersonation (no cookies needed, but IP may be rate-limited)
- **Formats:** Combined video+audio (no separate audio tracks)
- **Qualities:** 360p, 540p, 720p, 1080p
- **Audio:** Offer "Standard" audio extraction from best video (no separate audio formats)
- **Format selector:** `best[height<=720][ext=mp4]/best`

### Instagram

- **Auth:** Cookies required (user exports from browser, imports into app). Store in EncryptedSharedPreferences.
- **Formats:** Combined video+audio (when using yt-dlp with cookies)
- **Qualities:** Typically 720p, 1080p
- **Audio:** "Standard" extraction from best video
- **Fallback:** If yt-dlp fails, try Instagram embed endpoint (`/p/{shortcode}/embed/`) — sometimes works without cookies for public posts

### Pinterest

- **Auth:** None needed (yt-dlp supports it natively)
- **Formats:** Combined video+audio
- **Qualities:** Typically 720p, 1080p
- **Audio:** "Standard" extraction from best video

---

## On-Device yt-dlp Integration

The biggest challenge. yt-dlp is a Python tool — to run it on Android, you have two options:

### Option A: yaab (Yet Another Android Bot)
- GitHub: https://github.com/yt-dlp/yaab
- Bundles a Python runtime + yt-dlp as an Android library
- Call from Kotlin: `Ytdlp.run(["-J", url])` → returns JSON
- Download: `Ytdlp.run(["-f", formatId, "-o", path, url])`
- PO Token: Bundle the BgUtils provider + deno runtime

### Option B: Port to Kotlin (harder, faster)
- Use a Kotlin HTTP client (OkHttp) to fetch YouTube pages
- Parse the page to extract format URLs (like NewPipe does)
- Download directly with OkHttp
- This is what NewPipe and Seal do — but it's significantly more work

**Recommend Option A** (yaab) — it's the same yt-dlp we use in the web version, just bundled for Android. Seal uses this approach.

### ffmpeg Integration

Use `ffmpeg-kit` (or `mobile-ffmpeg`):
```kotlin
// Trim video
FFmpegKit.execute("-ss $start -to $end -i input.mp4 -c copy output.mp4")

// Extract audio as MP3
FFmpegKit.execute("-i input.mp4 -vn -c:a libmp3lame -q:a 2 output.mp3")

// Generate storyboard (1 thumbnail per second)
FFmpegKit.execute("-i input.mp4 -vf fps=1,scale=160:90 -q:v 3 thumb_%04d.jpg")

// Compute waveform
FFmpegKit.execute("-i input.mp4 -vn -ac 1 -ar 8000 -f f32le pcm.raw")
// Then parse the PCM data in Kotlin to compute 200 peaks
```

---

## Key Differences from Web Version

| Feature | Web Version | Native Android |
|---------|-------------|----------------|
| Backend | Railway server (yt-dlp + ffmpeg) | On-device (yaab + ffmpeg-kit) |
| YouTube auth | PO Token (deno on server) | PO Token (deno/JS runtime on device) |
| Instagram auth | Operator cookies (env var) | User-imported cookies (EncryptedSharedPreferences) |
| Database | Prisma + SQLite (server) | Room (on-device) |
| File serving | Next.js API streaming | Direct file access |
| Trim audio | HTML5 `<audio>` element | ExoPlayer |
| State | Zustand (localStorage) | ViewModel + StateFlow + DataStore |
| UI | React + Tailwind | Jetpack Compose + Material 3 |

---

## What NOT to Do

1. **NO server dependency** — Everything runs on-device
2. **NO glassmorphism** — Use opaque warm dark surfaces
3. **NO generic Material 3 look** — Custom editorial design
4. **NO fake qualities** — Only show what actually exists
5. **NO "android" YouTube client** — Returns 360p only
6. **NO auto-restart/cron** — Not needed on native (no memory leaks from Node.js)
7. **NO cloud sync** — Local-only is a feature
8. **NO accounts/login** — Anonymous is better

---

## Success Criteria

The app is complete when:
1. User pastes a YouTube link → sees real title, thumbnail, all qualities (144p-2160p)
2. User picks 1080p60 → downloads 60fps video with audio merged
3. User opens trim → sees real storyboard thumbnails + hears real audio playback
4. User trims 0:15 to 1:42 → downloads only that segment
5. User switches to Audio → sees real audio bitrates (130 kbps, 50 kbps)
6. User shares a YouTube link from the YouTube app → Vault opens and auto-fetches
7. User downloads from TikTok → gets 1080p with audio
8. User downloads from Instagram (with cookies configured) → gets video
9. User downloads from Pinterest → gets video
10. All files appear in Archive with catalog numbers, searchable
