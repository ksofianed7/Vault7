#!/usr/bin/env python3
"""
Vault real-source pipeline.

Wraps `yt-dlp` and `ffmpeg` to provide:
  - probe_meta <url>           -> JSON metadata + only-the-qualities-that-actually-exist
  - download_source <url> <out_path>  -> downloads the best mp4 (with audio) to <out_path>
  - storyboard <source> <out_dir> <fps> <width>
  - waveform <source> <out_path> <samples>
  - audio <source> <out_path> <start> <end>
  - download_quality <url> <format_id> <out_path>  -> downloads a specific format

This is the REAL implementation. No synthetic data. No cookies needed —
uses the BgUtils PO Token provider to bypass YouTube bot detection
automatically (same approach as Seal and cobalt.tools).
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def run(cmd, **kwargs):
    return subprocess.run(
        cmd, check=True,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        **kwargs,
    )


def run_json(cmd, **kwargs):
    return subprocess.run(
        cmd, check=True,
        capture_output=True, text=True,
        **kwargs,
    )


def normalize_url(url: str) -> str:
    """Fix common paste artifacts: '//youtu.be/...' -> 'https://youtu.be/...'"""
    url = url.strip()
    if url.startswith("//"):
        url = "https:" + url
    elif not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def parse_yt_error(raw: str) -> str:
    """Convert raw yt-dlp error strings into human-friendly messages."""
    raw = raw or ""
    low = raw.lower()

    if "requested format is not available" in low:
        return (
            "YouTube is rate-limiting this server. The PO Token provider may not be working. "
            "Try again in a few minutes, or restart the service."
        )
    if "video unavailable" in low:
        return "This video is unavailable. It may have been removed or made private."
    if "private video" in low:
        return "This video is private and cannot be downloaded."
    if "members-only" in low:
        return "This video is members-only and requires channel membership."
    if "age-restricted" in low or "age restricted" in low:
        return "This video is age-restricted and cannot be downloaded anonymously."
    if "geo restricted" in low or "geo-restricted" in low:
        return "This video is geo-restricted and not available in this region."
    if "http error 429" in low:
        return "Rate limited by the source. Please wait a minute and try again."
    if "connection" in low and ("timed out" in low or "refused" in low):
        return "Couldn't connect to the source. Check your internet connection."

    # Instagram-specific — be honest about the 2026 reality
    if "instagram" in low and ("empty media response" in low or "login" in low or "cookies" in low):
        if cookies_path():
            return (
                "Instagram is blocking this request even with cookies. "
                "The cookies may be expired — re-export from your browser and "
                "update the VAULT_COOKIES_B64 env var."
            )
        return (
            "Instagram requires authentication in 2026. The operator needs to set "
            "the VAULT_COOKIES_B64 env var with Instagram cookies. YouTube and TikTok "
            "work without login."
        )

    # TikTok-specific
    if "tiktok" in low and ("unexpected response" in low or "captcha" in low):
        return (
            "TikTok is blocking this request. Try again in a few minutes, or try "
            "a different video."
        )

    # Strip yt-dlp noise
    msg = raw.strip()
    msg = re.sub(r"^ERROR:\s*\[[^\]]+\]\s*[^\s:]+:\s*", "", msg)
    msg = re.sub(r"\s*https?://\S+.*$", "", msg)
    if len(msg) > 200:
        msg = msg[:197] + "…"
    return msg or "Couldn't fetch this video."


def pot_server_home() -> str:
    """Return the path to the vendored BgUtils PO Token provider server."""
    # In the Docker container, scripts are at /app/.next/standalone/scripts/
    # In dev, they're at /home/z/my-project/scripts/
    candidates = [
        Path(__file__).parent / "pot-provider",                           # dev
        Path("/app/.next/standalone/scripts/pot-provider"),               # Docker standalone
        Path("/app/scripts/pot-provider"),                                # Docker non-standalone
    ]
    for c in candidates:
        if (c / "src" / "generate_once.ts").exists():
            return str(c)
    return ""


def cookies_path() -> str | None:
    """
    Return path to cookies.txt if the operator has configured it.

    Operator-side cookies: set VAULT_COOKIES_B64 env var to a base64-encoded
    cookies.txt file content. On each call, we decode and write to disk
    (overwriting any stale version). Users never see or upload cookies —
    this is for Instagram only (YouTube and TikTok use the PO Token provider).
    """
    b64 = os.environ.get("VAULT_COOKIES_B64", "").strip()
    if not b64:
        return None

    # Try multiple cache locations (Railway/Render mount /data, fallback to /tmp)
    cache_dir = os.environ.get("VAULT_CACHE_DIR", "/home/z/my-project/.cache/media")
    candidate_paths = [
        Path(cache_dir) / "cookies.txt",
        Path("/data/media/cookies.txt"),
        Path("/tmp/vault-cookies.txt"),
    ]

    # Decode the base64 cookies
    try:
        import base64
        content = base64.b64decode(b64).decode("utf-8")
        # Basic validation — must look like a Netscape cookies file
        if "Netscape" not in content and ".instagram.com" not in content:
            return None
    except Exception:
        return None

    # Write to the first writable location
    for cookies_file in candidate_paths:
        try:
            cookies_file.parent.mkdir(parents=True, exist_ok=True)
            cookies_file.write_text(content)
            return str(cookies_file)
        except Exception:
            continue

    return None


def try_instagram_embed_fallback(url: str) -> dict | None:
    """
    Try Instagram's public embed endpoint — sometimes works for public posts
    without authentication. Returns a yt-dlp-style dict or None.
    """
    import urllib.request
    import re

    # Extract shortcode from URL (supports /p/ and /reel/ and /tv/)
    m = re.search(r"/(p|reel|tv)/([A-Za-z0-9_-]+)", url)
    if not m:
        return None
    shortcode = m.group(2)

    # Try multiple embed endpoint variants
    embed_urls = [
        f"https://www.instagram.com/p/{shortcode}/embed/",
        f"https://www.instagram.com/reel/{shortcode}/embed/",
        f"https://www.instagram.com/p/{shortcode}/embed/captioned/",
    ]

    for embed_url in embed_urls:
        try:
            req = urllib.request.Request(embed_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.instagram.com/",
            })
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8", errors="ignore")

            # Extract video URL — try multiple patterns
            video_url = None
            patterns = [
                r'"video_url":"([^"]+)"',
                r'video_url=([^&"]+)',
                r'"contentURL":"([^"]+)"',
                r'"embedUrl":"([^"]+)"',
                r'src="(https://[^"]*\.mp4[^"]*)"',
                r'data-video-url="([^"]+)"',
            ]
            for pattern in patterns:
                match = re.search(pattern, html)
                if match:
                    video_url = match.group(1).replace("\\u0026", "&").replace("\\/", "/")
                    break

            if not video_url:
                continue

            # Extract thumbnail
            thumbnail = ""
            thumb_patterns = [r'"thumbnail_url":"([^"]+)"', r'"thumbnailURL":"([^"]+)"']
            for pattern in thumb_patterns:
                match = re.search(pattern, html)
                if match:
                    thumbnail = match.group(1).replace("\\u0026", "&").replace("\\/", "/")
                    break

            # Extract title
            title = f"Instagram post {shortcode}"
            title_patterns = [r'"title":"([^"]+)"', r'<title>([^<]+)</title>']
            for pattern in title_patterns:
                match = re.search(pattern, html)
                if match:
                    title = match.group(1).replace("\\/", "/").strip()
                    if "Instagram" in title and len(title) < 30:
                        title = f"Instagram post {shortcode}"
                    break

            # Build a minimal yt-dlp-style dict
            return {
                "title": title,
                "uploader": "Instagram",
                "thumbnail": thumbnail,
                "duration": 0,
                "formats": [{
                    "format_id": "embed-0",
                    "ext": "mp4",
                    "height": 720,
                    "width": 1280,
                    "vcodec": "h264",
                    "acodec": "aac",
                    "filesize": 0,
                    "url": video_url,
                }],
            }
        except Exception:
            continue

    return None


def yt_dlp_args(url: str = ""):
    """
    Common yt-dlp args. Uses the BgUtils PO Token provider plugin
    to bypass YouTube bot detection. Requires deno for the PO token script.
    """
    args = [
        "yt-dlp",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
    ]
    # Explicitly tell yt-dlp where deno is (it sometimes can't find it in PATH)
    deno_path = shutil.which("deno")
    if deno_path:
        args += ["--js-runtimes", f"deno:{deno_path}"]
    
    # Use curl_cffi impersonation for TikTok/Instagram if available
    try:
        import curl_cffi  # noqa: F401
        args += ["--impersonate", "chrome"]
    except ImportError:
        pass
    # Tell the PO Token plugin where to find the deno script
    home = pot_server_home()
    if home:
        args += ["--extractor-args", f"youtubepot-bgutilscript:server_home={home}"]
    # Add cookies ONLY for Instagram (YouTube/TikTok use PO token, no cookies needed)
    if url and "instagram" in url:
        cp = cookies_path()
        if cp:
            args += ["--cookies", cp]
    return args


# YouTube player clients to try in order. The 'default' client (with PO token)
# returns the full DASH format list (2160p down to 144p + all audio bitrates).
# We deliberately EXCLUDE 'android' — it only returns 360p HLS with no separate
# audio, which gives users a broken "360p only + Standard audio" experience.
# Better to fail honestly than to offer garbage quality.
YT_CLIENTS = ["default", "web_safari", "tv", "ios", "mweb"]


def probe_meta(url: str) -> dict:
    """
    Fetch real metadata via yt-dlp -J. Returns:
      {
        url, platform, title, author, thumbnail, duration, views,
        description, qualities: [{ id, label, type, ext, fps, bitrate, size }]
      }

    Uses the BgUtils PO Token provider to bypass YouTube bot detection.
    No cookies required.
    """
    url = normalize_url(url)

    # Detect platform
    if "youtube" in url or "youtu.be" in url:
        platform = "youtube"
        # Try each player client and KEEP the one with the most complete format list.
        # The 'default' client (with PO token) usually returns the full DASH list
        # (2160p down to 144p + all audio bitrates). Other clients (android, tv, ios)
        # may return only HLS m3u8 formats (limited resolutions, no separate audio).
        # We MUST prefer clients that return BOTH video AND audio with the highest
        # max resolution — otherwise we end up with "360p only" + "Standard audio".
        last_err = None
        best_d = None
        best_score = 0
        for client in YT_CLIENTS:
            try:
                args = yt_dlp_args(url)
                if client != "default":
                    args += ["--extractor-args", f"youtube:player_client={client}"]
                args += ["-J", url]
                result = run_json(args)
                candidate = json.loads(result.stdout)
                formats = candidate.get("formats", [])
                has_video = any(f.get("height") and f.get("vcodec") != "none" for f in formats)
                has_audio = any(f.get("abr") and f.get("vcodec") == "none" for f in formats)

                # Only accept clients with BOTH video AND audio
                if not (has_video and has_audio):
                    last_err = f"{client} returned incomplete (video={has_video}, audio={has_audio})"
                    continue

                # Score: max video height + audio bitrate count (weighted heavily)
                # A client with 2160p + 4 audio bitrates scores 2160 + 4000 = 6160
                # A client with 360p + 0 audio scores 0 (rejected above)
                max_h = max((f.get("height") or 0 for f in formats), default=0)
                audio_n = sum(1 for f in formats if f.get("abr") and f.get("vcodec") == "none")
                score = max_h + (audio_n * 1000)

                if score > best_score:
                    best_d = candidate
                    best_score = score

            except subprocess.CalledProcessError as e:
                last_err = (e.stderr or "")[:500]
                if "Video unavailable" in (e.stderr or "") or "Private video" in (e.stderr or ""):
                    break
                continue

        if best_d is None:
            return {"error": parse_yt_error(last_err or "yt-dlp failed")}
        d = best_d
    else:
        if "instagram" in url:
            platform = "instagram"
        elif "tiktok" in url:
            platform = "tiktok"
        elif "pinterest" in url or "pin.it" in url:
            platform = "pinterest"
        else:
            platform = "unknown"

        # For Instagram, try yt-dlp with cookies FIRST (returns better formats),
        # then fall back to the embed endpoint (no cookies needed)
        if "instagram" in url:
            # Try yt-dlp with cookies first
            d = None
            try:
                result = run_json(yt_dlp_args(url) + ["-J", url])
                d = json.loads(result.stdout)
                # Verify it has actual video formats
                formats = d.get("formats", [])
                has_video = any(f.get("height") and f.get("vcodec") != "none" for f in formats)
                if not has_video:
                    d = None
            except subprocess.CalledProcessError:
                d = None

            # If yt-dlp failed, try embed fallback
            if d is None:
                embed_result = try_instagram_embed_fallback(url)
                if embed_result:
                    d = embed_result
                else:
                    return {"error": parse_yt_error("Instagram requires authentication. The operator needs to set VAULT_COOKIES_B64 env var.")}
        else:
            # TikTok, Pinterest, and other platforms — yt-dlp directly
            try:
                result = run_json(yt_dlp_args(url) + ["-J", url])
                d = json.loads(result.stdout)
            except subprocess.CalledProcessError as e:
                return {"error": parse_yt_error((e.stderr or "yt-dlp failed")[:500])}

    formats = d.get("formats", [])

    # Detect aspect ratio — for vertical videos (9:16 Shorts/Reels/TikTok),
    # height is the LARGER dimension. Users expect "1080p" not "1920p", so
    # we use the SMALLER dimension (width) as the quality label for vertical.
    video_formats_with_dims = [
        f for f in formats
        if f.get("height") and f.get("width") and f.get("vcodec") != "none"
    ]
    is_vertical = False
    if video_formats_with_dims:
        best = max(video_formats_with_dims, key=lambda f: (f.get("height") or 0) * (f.get("width") or 0))
        w = best.get("width") or 0
        h = best.get("height") or 0
        if w and h and h > w:
            is_vertical = True
    # Fallback: detect vertical from URL (Shorts/Reels/TikTok/Pinterest are often vertical)
    if not is_vertical:
        url_lower = url.lower()
        if "/shorts/" in url_lower or "/reel/" in url_lower or "tiktok.com" in url_lower or "pinterest" in url_lower:
            is_vertical = True

    # Build video quality options — one per resolution.
    # Prefer combined video+audio mp4, then video-only mp4, then webm.
    # For vertical videos, key by width (smaller dimension) so labels show
    # "1080p" instead of "1920p".
    video_by_height = {}
    for f in formats:
        h = f.get("height")
        w = f.get("width")
        if not h or f.get("vcodec") == "none":
            continue
        quality_key = w if (is_vertical and w) else h
        score = 0
        if f.get("ext") == "mp4":
            score += 10
        if f.get("acodec") and f.get("acodec") != "none":
            score += 5
        size = f.get("filesize") or f.get("filesize_approx") or 0
        if quality_key not in video_by_height or score > video_by_height[quality_key]["score"]:
            video_by_height[quality_key] = {
                "format_id": f.get("format_id"),
                "ext": f.get("ext"),
                "fps": f.get("fps"),
                "vcodec": f.get("vcodec", ""),
                "acodec": f.get("acodec", ""),
                "filesize": size,
                "score": score,
                "width": w,
                "height": h,
            }

    # Build audio quality options — one per bitrate group.
    # Prefer m4a (mp4 container) over opus (webm).
    audio_by_abr = {}
    for f in formats:
        abr = f.get("abr")
        if not abr or f.get("acodec") == "none" or f.get("vcodec") != "none":
            continue
        score = 0
        if f.get("ext") == "m4a":
            score += 10
        size = f.get("filesize") or f.get("filesize_approx") or 0
        abr_key = int(abr)
        if abr_key not in audio_by_abr or score > audio_by_abr[abr_key]["score"]:
            audio_by_abr[abr_key] = {
                "format_id": f.get("format_id"),
                "ext": f.get("ext"),
                "acodec": f.get("acodec", ""),
                "filesize": size,
                "score": score,
                "abr": abr_key,
            }

    video_qualities = []
    for h in sorted(video_by_height.keys(), reverse=True):
        v = video_by_height[h]
        video_qualities.append({
            "id": v["format_id"],
            "label": f"{h}p",
            "type": "video",
            "ext": "mp4",
            "fps": v.get("fps"),
            "size": fmt_size(v.get("filesize")),
        })

    audio_qualities = []
    seen_abr_ints = set()
    for abr in sorted(audio_by_abr.keys(), reverse=True):
        a = audio_by_abr[abr]
        abr_group = round(abr / 10) * 10
        if abr_group in seen_abr_ints:
            continue
        seen_abr_ints.add(abr_group)
        audio_qualities.append({
            "id": a["format_id"],
            "label": f"{abr_group} kbps",
            "type": "audio",
            "ext": "mp3",
            "bitrate": f"{abr}k",
            "size": fmt_size(a.get("filesize")),
        })

    # If no separate audio formats (e.g., TikTok only has combined video+audio),
    # offer audio extraction from the best video format.
    if not audio_qualities and video_qualities:
        # Pick the best video format and use its format_id for audio extraction
        best_video = video_by_height[max(video_by_height.keys())]
        audio_qualities.append({
            "id": best_video["format_id"],
            "label": "Standard",
            "type": "audio",
            "ext": "mp3",
            "bitrate": "128k",
            "size": fmt_size(best_video.get("filesize")),
        })

    return {
        "url": url,
        "platform": platform,
        "title": d.get("title") or "Untitled",
        "author": d.get("uploader") or d.get("channel") or "Unknown",
        "thumbnail": d.get("thumbnail") or "",
        "duration": int(d.get("duration") or 0),
        "views": f"{int(d.get('view_count') or 0):,} views" if d.get("view_count") else None,
        "description": (d.get("description") or "")[:500],
        "qualities": video_qualities + audio_qualities,
    }


def fmt_size(b):
    if not b:
        return None
    if b >= 1_000_000_000:
        return f"{b / 1_000_000_000:.2f} GB"
    if b >= 1_000_000:
        return f"{b / 1_000_000:.1f} MB"
    return f"{b / 1000:.0f} KB"


def download_source(url: str, out_path: Path) -> str:
    """Download best mp4 with audio for trim preview."""
    url = normalize_url(url)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # For preview/trim, we don't need 4K. Cap at 720p.
    # Use video+audio merge for YouTube DASH (video-only formats need +bestaudio).
    format_sel = "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best"

    # Instagram — try embed fallback first, then yt-dlp with cookies
    if "instagram" in url:
        embed_data = try_instagram_embed_fallback(url)
        if embed_data and embed_data.get("formats"):
            direct_url = embed_data["formats"][0]["url"]
            try:
                run(["ffmpeg", "-y", "-i", direct_url, "-c", "copy", str(out_path)])
                return str(out_path)
            except Exception:
                pass

        try:
            run(yt_dlp_args(url) + [
                "-f", format_sel,
                "--merge-output-format", "mp4",
                "-o", str(out_path),
                url,
            ])
            return str(out_path)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(parse_yt_error((e.stderr or "")[:500]))

    # YouTube — multi-client fallback with PO token
    if "youtube" in url or "youtu.be" in url:
        last_err = None
        for client in YT_CLIENTS:
            try:
                args = yt_dlp_args(url)
                if client != "default":
                    args += ["--extractor-args", f"youtube:player_client={client}"]
                args += [
                    "-f", format_sel,
                    "--merge-output-format", "mp4",
                    "-o", str(out_path),
                    url,
                ]
                run(args)
                return str(out_path)
            except subprocess.CalledProcessError as e:
                last_err = (e.stderr or "")
                if "Video unavailable" in last_err or "Private video" in last_err:
                    raise RuntimeError(parse_yt_error(last_err))
                continue
        raise RuntimeError(parse_yt_error(last_err or "yt-dlp download failed"))

    # TikTok and other platforms
    run(yt_dlp_args(url) + [
        "-f", format_sel,
        "--merge-output-format", "mp4",
        "-o", str(out_path),
        url,
    ])
    return str(out_path)


def _yt_download_with_fallback(url: str, format_id: str, out_template: str, ext: str = "mp4"):
    """Run yt-dlp download with multi-client fallback for YouTube.

    YouTube DASH formats are video-ONLY (no audio). We MUST use format_id+bestaudio
    to download both video and audio, then yt-dlp merges them automatically.
    Without the +bestaudio, downloads fail with "Requested format is not available"
    or produce silent videos.
    """
    if ext == "mp3":
        # For audio: try the exact format, then bestaudio, then best
        format_selector = f"{format_id}/bestaudio/best"
    else:
        # For video: try format+bestaudio (merged), then just format, then best
        format_selector = f"{format_id}+bestaudio/{format_id}/best[ext=mp4]/best"

    if "youtube" in url or "youtu.be" in url:
        last_err = None
        for client in YT_CLIENTS:
            try:
                args = yt_dlp_args(url)
                if client != "default":
                    args += ["--extractor-args", f"youtube:player_client={client}"]
                args += ["-f", format_selector, "--merge-output-format", "mp4", "-o", out_template, url]
                run(args)
                return
            except subprocess.CalledProcessError as e:
                last_err = (e.stderr or "")
                if "Video unavailable" in last_err or "Private video" in last_err:
                    raise RuntimeError(parse_yt_error(last_err))
                continue
        raise RuntimeError(parse_yt_error(last_err or "yt-dlp download failed"))
    else:
        run(yt_dlp_args(url) + ["-f", format_selector, "--merge-output-format", "mp4", "-o", out_template, url])


def download_quality(url: str, format_id: str, out_path: Path, ext: str, start=None, end=None):
    """
    Download a specific format (with trim if requested).

    Special case: if format_id is "embed-0", it means the metadata came from
    the Instagram embed fallback — we need to re-fetch the direct video URL
    and download it directly with ffmpeg (not yt-dlp).
    """
    url = normalize_url(url)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    try:
        # Special case: Instagram embed fallback — direct URL download
        if format_id == "embed-0" and "instagram" in url:
            # Re-fetch the direct video URL from the embed endpoint
            embed_data = try_instagram_embed_fallback(url)
            if not embed_data or not embed_data.get("formats"):
                raise RuntimeError("Couldn't re-fetch Instagram video URL")

            direct_url = embed_data["formats"][0]["url"]
            # Download the direct URL with ffmpeg (handles redirects)
            raw_file = tmp / "raw.mp4"
            download_cmd = ["ffmpeg", "-y"]
            if start is not None:
                download_cmd += ["-ss", str(start)]
            download_cmd += ["-i", direct_url]
            if end is not None:
                download_cmd += ["-to", str(end)]
            download_cmd += ["-c", "copy", str(raw_file)]
            run(download_cmd)

            if ext == "mp3":
                # Convert to MP3
                cmd = ["ffmpeg", "-y", "-i", str(raw_file), "-c:a", "libmp3lame", "-q:a", "2"]
                if start is not None:
                    cmd += ["-ss", str(start)]
                if end is not None:
                    cmd += ["-to", str(end)]
                cmd += [str(out_path)]
                run(cmd)
            else:
                if start is not None or end is not None:
                    cmd = ["ffmpeg", "-y"]
                    if start is not None:
                        cmd += ["-ss", str(start)]
                    if end is not None:
                        cmd += ["-to", str(end)]
                    cmd += ["-i", str(raw_file), "-c", "copy", str(out_path)]
                    run(cmd)
                else:
                    shutil.copy2(raw_file, out_path)
            return str(out_path)

        # Normal yt-dlp download path
        if ext == "mp3":
            _yt_download_with_fallback(url, format_id, str(tmp / "raw.%(ext)s"), ext="mp3")
            downloaded = list(tmp.glob("raw.*"))
            if not downloaded:
                raise RuntimeError("Download produced no file")
            cmd = ["ffmpeg", "-y"]
            if start is not None:
                cmd += ["-ss", str(start)]
            if end is not None:
                cmd += ["-to", str(end)]
            cmd += ["-i", str(downloaded[0]), "-c:a", "libmp3lame", "-q:a", "2", str(out_path)]
            run(cmd)
        else:
            _yt_download_with_fallback(url, format_id, str(tmp / "raw.%(ext)s"), ext="mp4")
            downloaded = list(tmp.glob("raw.*"))
            if not downloaded:
                raise RuntimeError("Download produced no file")
            if start is not None or end is not None:
                cmd = ["ffmpeg", "-y"]
                if start is not None:
                    cmd += ["-ss", str(start)]
                if end is not None:
                    cmd += ["-to", str(end)]
                cmd += ["-i", str(downloaded[0]), "-c", "copy", str(out_path)]
                run(cmd)
            else:
                shutil.copy2(downloaded[0], out_path)
        return str(out_path)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def generate_storyboard(source: str, out_dir: Path, fps: int = 1, width: int = 160) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    for f in out_dir.glob("thumb_*.jpg"):
        f.unlink()
    height = int(width * 9 / 16)
    run([
        "ffmpeg", "-y", "-i", source,
        "-vf", f"fps={fps},scale={width}:{height}",
        "-q:v", "3",
        str(out_dir / "thumb_%04d.jpg"),
    ])
    return len(list(out_dir.glob("thumb_*.jpg")))


def generate_waveform(source: str, out_path: Path, samples: int = 200) -> list:
    tmp = Path(tempfile.mkdtemp())
    try:
        pcm_path = tmp / "pcm.raw"
        run([
            "ffmpeg", "-y", "-i", source,
            "-vn", "-ac", "1", "-ar", "8000",
            "-f", "f32le", str(pcm_path),
        ])
        if not pcm_path.exists() or pcm_path.stat().st_size == 0:
            peaks = [0.0] * samples
        else:
            import struct
            with open(pcm_path, "rb") as f:
                data = f.read()
            n = len(data) // 4
            floats = struct.unpack(f"<{n}f", data[:n * 4])
            chunk = max(1, n // samples)
            peaks = []
            for i in range(0, n, chunk):
                seg = floats[i:i + chunk]
                if seg:
                    peaks.append(min(1.0, max(abs(x) for x in seg)))
            if len(peaks) < samples:
                peaks.extend([0.0] * (samples - len(peaks)))
            else:
                peaks = peaks[:samples]
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            json.dump(peaks, f)
        return peaks
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def generate_audio(source: str, out_path: Path, start=None, end=None) -> str:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y"]
    if start is not None:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)]
    cmd += ["-i", source, "-vn", "-c:a", "libmp3lame", "-q:a", "2", str(out_path)]
    run(cmd)
    return str(out_path)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "probe_meta":
        print(json.dumps(probe_meta(sys.argv[2])))
    elif cmd == "download_source":
        p = download_source(sys.argv[2], Path(sys.argv[3]))
        print(json.dumps({"path": p}))
    elif cmd == "storyboard":
        n = generate_storyboard(sys.argv[2], Path(sys.argv[3]),
                                int(sys.argv[4]) if len(sys.argv) > 4 else 1,
                                int(sys.argv[5]) if len(sys.argv) > 5 else 160)
        print(json.dumps({"count": n}))
    elif cmd == "waveform":
        p = generate_waveform(sys.argv[2], Path(sys.argv[3]),
                              int(sys.argv[4]) if len(sys.argv) > 4 else 200)
        print(json.dumps({"samples": len(p)}))
    elif cmd == "audio":
        start = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] != "null" else None
        end = float(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "null" else None
        p = generate_audio(sys.argv[2], Path(sys.argv[3]), start, end)
        print(json.dumps({"path": p}))
    elif cmd == "download_quality":
        start = float(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "null" else None
        end = float(sys.argv[6]) if len(sys.argv) > 6 and sys.argv[6] != "null" else None
        p = download_quality(sys.argv[2], sys.argv[3], Path(sys.argv[4]), sys.argv[7] if len(sys.argv) > 7 else "mp4", start, end)
        print(json.dumps({"path": p}))
    else:
        print(f"Unknown: {cmd}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
