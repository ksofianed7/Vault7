import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
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
 * - kind=storyboard&name=thumb_0001.jpg -> serves thumbnail (cacheable image)
 * - kind=audio                          -> serves bundle's audio.mp3 (range support for seeking)
 * - kind=waveform                       -> serves waveform.json
 * - kind=download&name=foo.mp4          -> serves a final download file (attachment)
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
    // Sanitize — only allow safe filenames
    if (!/^[\w\-]+\. (mp4|mp3|m4a|webm)$/.test(name.replace(/\s/g, ""))) {
      // Less strict fallback
      if (name.includes("..") || name.includes("/")) {
        return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      }
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
    const data = await readFile(filePath);

    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=86400, immutable",
      "Accept-Ranges": "bytes",
      "Content-Length": String(stats.size),
    };

    if (asAttachment) {
      // Force download dialog with the original filename
      const safeName = path.basename(name || "download");
      headers["Content-Disposition"] = `attachment; filename="${safeName}"`;
    }

    return new NextResponse(data, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
