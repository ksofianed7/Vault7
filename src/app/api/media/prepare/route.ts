import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);
const PIPELINE = "scripts/source_pipeline.py";
const CACHE_ROOT = process.env.VAULT_CACHE_DIR || path.join(process.cwd(), ".cache", "media");

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /api/media/prepare
 * Body: { url: string }
 *
 * Downloads the real source video via yt-dlp, then runs ffmpeg to generate:
 *   - Storyboard thumbnails (one per second, real video frames)
 *   - Real waveform peaks (computed from the actual audio track)
 *   - Full-length audio MP3 for playback during trim preview
 *
 * Cached on disk by URL hash. Returns a manifest with URLs to all assets.
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const bundleId = createHash("sha1").update(url).digest("hex").slice(0, 16);
    const bundleDir = path.join(CACHE_ROOT, "bundles", bundleId);
    await mkdir(bundleDir, { recursive: true });

    const manifestPath = path.join(bundleDir, "manifest.json");
    const sourcePath = path.join(bundleDir, "source.mp4");
    const storyboardDir = path.join(bundleDir, "storyboard");
    const waveformPath = path.join(bundleDir, "waveform.json");
    const audioPath = path.join(bundleDir, "audio.mp3");

    // Skip regeneration if bundle already exists
    if (await exists(manifestPath)) {
      const manifestRaw = await readFile(manifestPath, "utf8");
      return NextResponse.json(JSON.parse(manifestRaw));
    }

    // Step 1: Download the real source video via yt-dlp
    // Use 720p max for the preview source — we don't need 4K for trimming
    await exec("python3", [
      PIPELINE, "download_source", url, sourcePath,
    ], {
      cwd: process.cwd(),
      timeout: 5 * 60_000, // 5 min for download
      maxBuffer: 10 * 1024 * 1024,
    });

    // Step 2: Generate storyboard at 1fps
    await exec("python3", [
      PIPELINE, "storyboard", sourcePath, storyboardDir, "1", "160",
    ], {
      cwd: process.cwd(),
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    // Step 3: Generate real waveform from source audio
    await exec("python3", [
      PIPELINE, "waveform", sourcePath, waveformPath, "200",
    ], {
      cwd: process.cwd(),
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    // Step 4: Extract full-length audio MP3 for playback
    await exec("python3", [
      PIPELINE, "audio", sourcePath, audioPath, "null", "null",
    ], {
      cwd: process.cwd(),
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    // Probe the source for real duration + stream info
    const probeOut = await exec("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_type",
      "-of", "json",
      sourcePath,
    ]);
    const probe = JSON.parse(probeOut.stdout);
    const duration = parseFloat(probe.format?.duration || "0");
    const hasVideo = (probe.streams || []).some((s: any) => s.codec_type === "video");
    const hasAudio = (probe.streams || []).some((s: any) => s.codec_type === "audio");

    // Read storyboard file list
    const sbDir = await import("node:fs/promises").then(m => m.readdir(storyboardDir));
    const storyboardFiles = sbDir
      .filter(f => f.startsWith("thumb_") && f.endsWith(".jpg"))
      .sort();

    const waveformRaw = await readFile(waveformPath, "utf8");
    const waveform = JSON.parse(waveformRaw) as number[];

    const manifest = {
      bundleId,
      url,
      duration,
      hasVideo,
      hasAudio,
      storyboard: storyboardFiles.map(f => `/api/media/file?bundleId=${bundleId}&kind=storyboard&name=${f}`),
      waveform,
      audioUrl: `/api/media/file?bundleId=${bundleId}&kind=audio`,
    };
    await writeFile(manifestPath, JSON.stringify(manifest));
    return NextResponse.json(manifest);
  } catch (e) {
    const err = e as Error & { stderr?: string };
    console.error("media/prepare failed:", err.message, err.stderr ?? "");
    return NextResponse.json(
      { error: `Media preparation failed: ${(err.stderr || err.message).slice(0, 300)}` },
      { status: 500 }
    );
  }
}
