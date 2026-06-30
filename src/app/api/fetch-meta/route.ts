import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { VideoMeta } from "@/lib/platform";

const exec = promisify(execFile);
const PIPELINE = "scripts/source_pipeline.py";

/**
 * POST /api/fetch-meta
 * Body: { url: string }
 *
 * Calls yt-dlp -J on the real URL and returns:
 *   - Real title, author, duration, views, description, thumbnail
 *   - Only the video qualities that actually exist (2160p only if 4K is available)
 *   - Only the audio bitrates that actually exist (no fake 320 kbps)
 *
 * If yt-dlp can't extract (e.g., Instagram login wall, TikTok anti-bot), returns
 * an honest error so the UI can show it instead of faking data.
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const { stdout } = await exec("python3", [PIPELINE, "probe_meta", url], {
      cwd: process.cwd(),
      timeout: 60_000, // 60s — yt-dlp can be slow on first hit
      maxBuffer: 10 * 1024 * 1024,
    });

    const meta = JSON.parse(stdout.trim());

    if (meta.error) {
      return NextResponse.json(
        { error: meta.error },
        { status: 400 }
      );
    }

    // If no qualities were found, return honest error
    if (!meta.qualities || meta.qualities.length === 0) {
      return NextResponse.json(
        { error: "No downloadable formats found for this URL. The source may be private, age-restricted, or region-locked." },
        { status: 400 }
      );
    }

    return NextResponse.json(meta as VideoMeta);
  } catch (e) {
    const err = e as Error & { stderr?: string };
    console.error("fetch-meta failed:", err.message, err.stderr ?? "");
    const raw = err.stderr || err.message || "";
    let msg = "Couldn't fetch this video.";
    if (/video unavailable/i.test(raw)) {
      msg = "This video is unavailable. It may have been removed or made private.";
    } else if (/private video/i.test(raw)) {
      msg = "This video is private and cannot be downloaded.";
    } else if (/sign in to confirm/i.test(raw)) {
      msg = "YouTube is rate-limiting this server. Try again in a few minutes.";
    }
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
