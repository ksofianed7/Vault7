#!/usr/bin/env python3
"""
Vault media pipeline.

Given a source URL (or local file), generates:
  - Storyboard thumbnails (one per second) for video-mode timeline
  - Waveform peaks (JSON array of 0..1 amplitudes) for audio-mode timeline
  - Trimmed audio MP3 for playback during trim preview

In production this would call `yt-dlp` to download the source first.
In the sandbox we use a synthetic sample video so the entire pipeline is
exercised end-to-end with real ffmpeg output.

Usage:
  python3 media_pipeline.py <subcommand> [args]

Subcommands:
  storyboard <source> <out_dir> <fps> <width>
    -> writes <out_dir>/thumb_0001.jpg ... and prints the count
  waveform <source> <out_path> <samples>
    -> writes JSON array of <samples> peaks (0..1) to <out_path>
  audio <source> <out_path> <start> <end>
    -> writes a trimmed/encoded MP3 to <out_path>
  probe <source>
    -> prints JSON { duration, hasVideo, hasAudio }
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def run(cmd, **kwargs):
    """Run a subprocess command, raising on failure."""
    return subprocess.run(
        cmd,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        **kwargs,
    )


def probe(source: str) -> dict:
    """Use ffprobe to get duration and stream info."""
    out = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-show_entries",
            "format=duration:stream=codec_type",
            "-of", "json",
            source,
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    j = json.loads(out)
    duration = float(j.get("format", {}).get("duration", 0))
    streams = j.get("streams", [])
    return {
        "duration": duration,
        "hasVideo": any(s.get("codec_type") == "video" for s in streams),
        "hasAudio": any(s.get("codec_type") == "audio" for s in streams),
    }


def get_source(source_url: str, cache_dir: Path) -> str:
    """
    Resolve the source URL to a local file path.

    Real implementation:
        - If it's http(s), call `yt-dlp` to download to cache_dir
        - If it's already a local path, return it as-is

    Sandbox implementation:
        - Always return the synthetic sample video at .cache/media/sample.mp4
          (created by the project setup script)
    """
    if source_url.startswith("file://"):
        return source_url[7:]
    if os.path.exists(source_url):
        return source_url

    # Sandbox fallback — use the prepared sample video
    sample = Path("/home/z/my-project/.cache/media/sample.mp4")
    if sample.exists():
        return str(sample)

    # Last resort: generate a synthetic source on the fly
    sample.parent.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"testsrc=duration=10:size=320x180:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=10",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-shortest",
        str(sample),
    ])
    return str(sample)


def generate_storyboard(source: str, out_dir: Path, fps: int = 1, width: int = 160) -> int:
    """Generate storyboard thumbnails at the given fps and width."""
    out_dir.mkdir(parents=True, exist_ok=True)
    # Clear old thumbnails
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
    """
    Extract raw PCM audio and compute `samples` peaks (max abs amplitude)
    normalized to 0..1. Output is a JSON array.
    """
    tmp = Path(tempfile.mkdtemp())
    try:
        pcm_path = tmp / "pcm.raw"
        # Downsample to 8kHz mono f32le for speed
        run([
            "ffmpeg", "-y", "-i", source,
            "-vn", "-ac", "1", "-ar", "8000",
            "-f", "f32le",
            str(pcm_path),
        ])
        if not pcm_path.exists() or pcm_path.stat().st_size == 0:
            # No audio track — return zeros
            peaks = [0.0] * samples
        else:
            import struct
            with open(pcm_path, "rb") as f:
                data = f.read()
            n = len(data) // 4  # f32le = 4 bytes per sample
            floats = struct.unpack(f"<{n}f", data[:n * 4])
            # Compute peaks by chunking
            chunk = max(1, n // samples)
            peaks = []
            for i in range(0, n, chunk):
                seg = floats[i:i + chunk]
                if seg:
                    peak = max(abs(x) for x in seg)
                    peaks.append(min(1.0, peak))
            # Pad/trim to exactly `samples`
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


def generate_audio(source: str, out_path: Path, start: float = None, end: float = None) -> str:
    """Extract (and optionally trim) audio as MP3."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y"]
    if start is not None:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)]
    cmd += [
        "-i", source,
        "-vn",
        "-c:a", "libmp3lame",
        "-q:a", "2",
        str(out_path),
    ]
    run(cmd)
    return str(out_path)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    cache_dir = Path("/home/z/my-project/.cache/media")
    cache_dir.mkdir(parents=True, exist_ok=True)

    if cmd == "probe":
        source = get_source(sys.argv[2], cache_dir)
        print(json.dumps(probe(source)))
    elif cmd == "storyboard":
        source = get_source(sys.argv[2], cache_dir)
        out_dir = Path(sys.argv[3])
        fps = int(sys.argv[4]) if len(sys.argv) > 4 else 1
        width = int(sys.argv[5]) if len(sys.argv) > 5 else 160
        n = generate_storyboard(source, out_dir, fps, width)
        print(json.dumps({"count": n, "dir": str(out_dir)}))
    elif cmd == "waveform":
        source = get_source(sys.argv[2], cache_dir)
        out_path = Path(sys.argv[3])
        samples = int(sys.argv[4]) if len(sys.argv) > 4 else 200
        peaks = generate_waveform(source, out_path, samples)
        print(json.dumps({"samples": len(peaks), "path": str(out_path)}))
    elif cmd == "audio":
        source = get_source(sys.argv[2], cache_dir)
        out_path = Path(sys.argv[3])
        start = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] != "null" else None
        end = float(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "null" else None
        p = generate_audio(source, out_path, start, end)
        print(json.dumps({"path": p}))
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
