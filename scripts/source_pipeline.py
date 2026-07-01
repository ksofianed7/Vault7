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
        return (
            "Instagram requires authentication in 2026 — even for public posts. "
            "This is a platform restriction we can't bypass without operator-configured "
            "server cookies. YouTube and TikTok work without login."
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

    # Try the embed endpoint (public, no auth)
    embed_url = f"https://www.instagram.com/p/{shortcode}/embed/"
    try:
        req = urllib.request.Request(embed_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        # Extract video URL from embed page
        video_match = re.search(r'"video_url":"([^"]+)"', html)
        if not video_match:
            video_match = re.search(r'video_url=([^&"]+)', html)
        if not video_match:
            return None

        video_url = video_match.group(1).replace("\\u0026", "&").replace("\\/", "/")

        # Extract thumbnail
        thumb_match = re.search(r'"thumbnail_url":"([^"]+)"', html)
        thumbnail = thumb_match.group(1).replace("\\u0026", "&").replace("\\/", "/") if thumb_match else ""

        # Extract title
        title_match = re.search(r'"title":"([^"]+)"', html)
        title = title_match.group(1).replace("\\/", "/") if title_match else f"Instagram post {shortcode}"

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
        return None


def yt_dlp_args():
    """
    Common yt-dlp args. Uses the BgUtils PO Token provider plugin
    (installed via bgutil-ytdlp-pot-provider) to bypass YouTube bot detection
    automatically — no cookies, no sign-in. Same approach as Seal/cobalt.tools.
    """
    args = [
        "yt-dlp",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
    ]
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
    return args


# YouTube player clients to try in order. The default client + PO token
# provider usually works. We fall back to other clients only if default fails.
YT_CLIENTS = ["default", "web_safari", "android", "tv", "ios", "mweb"]


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
        # Try each player client until one returns BOTH video and audio formats.
        last_err = None
        d = None
        for client in YT_CLIENTS:
            try:
                args = yt_dlp_args()
                if client != "default":
                    args += ["--extractor-args", f"youtube:player_client={client}"]
                args += ["-J", url]
                result = run_json(args)
                candidate = json.loads(result.stdout)
                formats = candidate.get("formats", [])
                has_video = any(f.get("height") and f.get("vcodec") != "none" for f in formats)
                has_audio = any(f.get("abr") and f.get("vcodec") == "none" for f in formats)
                if has_video and has_audio:
                    d = candidate
                    break
                if d is None and (has_video or has_audio):
                    d = candidate
                last_err = f"{client} returned incomplete formats (video={has_video}, audio={has_audio})"
                continue
            except subprocess.CalledProcessError as e:
                last_err = (e.stderr or "")[:500]
                if "Video unavailable" in (e.stderr or "") or "Private video" in (e.stderr or ""):
                    break
                continue
        if d is None:
            return {"error": parse_yt_error(last_err or "yt-dlp failed")}
    else:
        if "instagram" in url:
            platform = "instagram"
        elif "tiktok" in url:
            platform = "tiktok"
        else:
            platform = "unknown"
        try:
            result = run_json(yt_dlp_args() + ["-J", url])
            d = json.loads(result.stdout)
        except subprocess.CalledProcessError as e:
            # For Instagram, try the embed endpoint fallback before giving up
            if "instagram" in url:
                embed_result = try_instagram_embed_fallback(url)
                if embed_result:
                    d = embed_result
                else:
                    return {"error": parse_yt_error((e.stderr or "yt-dlp failed")[:500])}
            else:
                return {"error": parse_yt_error((e.stderr or "yt-dlp failed")[:500])}

    formats = d.get("formats", [])

    # Build video quality options — one per resolution.
    # Prefer combined video+audio mp4, then video-only mp4, then webm.
    video_by_height = {}
    for f in formats:
        h = f.get("height")
        if not h or f.get("vcodec") == "none":
            continue
        score = 0
        if f.get("ext") == "mp4":
            score += 10
        if f.get("acodec") and f.get("acodec") != "none":
            score += 5
        size = f.get("filesize") or f.get("filesize_approx") or 0
        if h not in video_by_height or score > video_by_height[h]["score"]:
            video_by_height[h] = {
                "format_id": f.get("format_id"),
                "ext": f.get("ext"),
                "fps": f.get("fps"),
                "vcodec": f.get("vcodec", ""),
                "acodec": f.get("acodec", ""),
                "filesize": size,
                "score": score,
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

    if "youtube" in url or "youtu.be" in url:
        last_err = None
        for client in YT_CLIENTS:
            try:
                args = yt_dlp_args()
                if client != "default":
                    args += ["--extractor-args", f"youtube:player_client={client}"]
                args += [
                    "-f", "best[ext=mp4][height<=720]/best[height<=720]/best",
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
    else:
        run(yt_dlp_args() + [
            "-f", "best[ext=mp4][height<=720]/best[height<=720]/best",
            "--merge-output-format", "mp4",
            "-o", str(out_path),
            url,
        ])
        return str(out_path)


def _yt_download_with_fallback(url: str, format_id: str, out_template: str):
    """Run yt-dlp download with multi-client fallback for YouTube."""
    if "youtube" in url or "youtu.be" in url:
        last_err = None
        for client in YT_CLIENTS:
            try:
                args = yt_dlp_args()
                if client != "default":
                    args += ["--extractor-args", f"youtube:player_client={client}"]
                args += ["-f", format_id, "-o", out_template, url]
                run(args)
                return
            except subprocess.CalledProcessError as e:
                last_err = (e.stderr or "")
                if "Video unavailable" in last_err or "Private video" in last_err:
                    raise RuntimeError(parse_yt_error(last_err))
                continue
        raise RuntimeError(parse_yt_error(last_err or "yt-dlp download failed"))
    else:
        run(yt_dlp_args() + ["-f", format_id, "-o", out_template, url])


def download_quality(url: str, format_id: str, out_path: Path, ext: str, start=None, end=None):
    """Download a specific format (with trim if requested)."""
    url = normalize_url(url)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    try:
        if ext == "mp3":
            _yt_download_with_fallback(url, format_id, str(tmp / "raw.%(ext)s"))
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
            _yt_download_with_fallback(url, format_id, str(tmp / "raw.%(ext)s"))
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
