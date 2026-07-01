import { NextRequest, NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

const CACHE_BASE = process.env.VAULT_CACHE_DIR || path.join(process.cwd(), ".cache", "media");
const CACHE_ROOT = path.join(CACHE_BASE, "bundles");
const DOWNLOADS_ROOT = path.join(CACHE_BASE, "downloads");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".json": "application/json",
};

/**
 * GET /api/media/file?bundleId=...&kind=storyboard|audio|waveform|download&name=...
 *
 * Files are STREAMED (not buffered into memory) to keep memory usage low
 * even for large video downloads. Supports HTTP Range requests for audio
 * seeking and resumable downloads.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const bundleId = sp.get("bundleId");
  const kind = sp.get("kind");
  const name = sp.get("name");

  if (!bundleId || !kind) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  let filePath: string;
  let mimeType: string;
  let asAttachment = false;

  if (kind === "storyboard") {
    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
    if (!/^thumb_\d{4}\.jpg$/.test(name)) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    filePath = path.join(CACHE_ROOT, bundleId, "storyboard", name);
    mimeType = "image/jpeg";
  } else if (kind === "audio") {
    filePath = path.join(CACHE_ROOT, bundleId, "audio.mp3");
    mimeType = "audio/mpeg";
  } else if (kind === "waveform") {
    filePath = path.join(CACHE_ROOT, bundleId, "waveform.json");
    mimeType = "application/json";
  } else if (kind === "download") {
    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
    // Sanitize — prevent path traversal
    if (name.includes("..") || name.includes("/") || name.includes("\\")) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    filePath = path.join(DOWNLOADS_ROOT, bundleId, name);
    const ext = path.extname(name).toLowerCase();
    mimeType = MIME[ext] || "application/octet-stream";
    asAttachment = true;
  } else {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  try {
    const stats = await stat(filePath);

    // Support HTTP Range requests (for audio seeking + resumable downloads)
    const range = req.headers.get("range");
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (match) {
        const start = match[1] ? parseInt(match[1]) : 0;
        const end = match[2] ? parseInt(match[2]) : stats.size - 1;
        const chunkSize = end - start + 1;

        const stream = createReadStream(filePath, { start, end });
        const readableStream = Readable.toWeb(stream) as ReadableStream;

        return new NextResponse(readableStream, {
          status: 206,
          headers: {
            "Content-Type": mimeType,
            "Content-Length": String(chunkSize),
            "Content-Range": `bytes ${start}-${end}/${stats.size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=86400, immutable",
            ...(asAttachment && {
              "Content-Disposition": `attachment; filename="${path.basename(name || "download")}"`,
            }),
          },
        });
      }
    }

    // Stream the full file (no buffering into memory)
    const stream = createReadStream(filePath);
    const readableStream = Readable.toWeb(stream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=86400, immutable",
      "Accept-Ranges": "bytes",
      "Content-Length": String(stats.size),
    };

    if (asAttachment) {
      const safeName = path.basename(name || "download");
      headers["Content-Disposition"] = `attachment; filename="${safeName}"`;
    }

    return new NextResponse(readableStream, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
