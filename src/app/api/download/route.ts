import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { detectPlatform } from "@/lib/platform";

const exec = promisify(execFile);
const PIPELINE = "scripts/source_pipeline.py";
const CACHE_ROOT = process.env.VAULT_CACHE_DIR || path.join(process.cwd(), ".cache", "media");

/**
 * POST /api/download
 * Body: {
 *   url: string,
 *   format: "video" | "audio",
 *   qualityId: string,        // yt-dlp format_id (e.g. "137" for 1080p mp4)
 *   qualityLabel: string,     // "1080p" or "128 kbps" (for filename)
 *   ext: string,              // "mp4" or "mp3"
 *   trimStart?: number,       // seconds
 *   trimEnd?: number,         // seconds
 *   title?: string,
 *   author?: string,
 *   thumbnail?: string,
 *   duration?: number,
 * }
 *
 * Downloads the REAL file via yt-dlp (using the actual format_id chosen by the
 * user), trims it via ffmpeg if trim bounds are set, then streams it to the
 * client as a downloadable attachment.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      url: string;
      format: "video" | "audio";
      qualityId: string;
      qualityLabel: string;
      ext: string;
      trimStart?: number;
      trimEnd?: number;
      title?: string;
      author?: string;
      thumbnail?: string;
      duration?: number;
      customFilename?: string; // user-provided filename (no extension)
    };

    if (!body?.url || !body.qualityId) {
      return NextResponse.json({ error: "Missing url or qualityId" }, { status: 400 });
    }

    const info = detectPlatform(body.url);
    if (info.platform === "unknown") {
      return NextResponse.json({ error: "Unsupported URL" }, { status: 400 });
    }

    // Create a unique output path for this specific download
    const dlId = createHash("sha1")
      .update(`${body.url}-${body.qualityId}-${body.trimStart ?? 0}-${body.trimEnd ?? 0}`)
      .digest("hex")
      .slice(0, 16);
    const outDir = path.join(CACHE_ROOT, "downloads", dlId);
    await mkdir(outDir, { recursive: true });

    // Use custom filename if provided, otherwise slugify the title
    const baseName = body.customFilename
      ? slugify(body.customFilename)
      : slugify(body.title ?? "vault-download");
    const fileName = `${baseName}.${body.ext}`;
    const outPath = path.join(outDir, fileName);

    // Download + (optional) trim via the pipeline
    await exec("python3", [
      PIPELINE,
      "download_quality",
      body.url,
      body.qualityId,
      outPath,
      body.trimStart != null ? String(body.trimStart) : "null",
      body.trimEnd != null ? String(body.trimEnd) : "null",
      body.ext,
    ], {
      cwd: process.cwd(),
      timeout: 10 * 60_000, // 10 min max
      maxBuffer: 10 * 1024 * 1024,
    });

    // Verify the file exists and get its size
    const stats = await stat(outPath);
    const sizeStr = stats.size >= 1_000_000_000
      ? `${(stats.size / 1_000_000_000).toFixed(2)} GB`
      : `${(stats.size / 1_000_000).toFixed(1)} MB`;

    return NextResponse.json({
      ok: true,
      id: dlId,
      fileName,
      size: sizeStr,
      sizeBytes: stats.size,
      ext: body.ext,
      platform: info.platform,
      format: body.format,
      quality: body.qualityLabel,
      downloadUrl: `/api/media/file?bundleId=${dlId}&kind=download&name=${encodeURIComponent(fileName)}`,
    });
  } catch (e) {
    const err = e as Error & { stderr?: string };
    console.error("download failed:", err.message, err.stderr ?? "");
    return NextResponse.json(
      { error: `Download failed: ${(err.stderr || err.message).slice(0, 300)}` },
      { status: 500 }
    );
  }
}

function slugify(s: string): string {
  return s
    .trim()
    .replace(/[<>:"/\\|?*]/g, "") // remove Windows illegal chars only
    .replace(/\s+/g, " ")         // collapse multiple spaces
    .trim()
    .slice(0, 120) || "vault-download";
}
