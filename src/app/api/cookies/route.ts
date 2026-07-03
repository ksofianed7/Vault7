import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import { access } from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);
const PIPELINE = "scripts/source_pipeline.py";
const CACHE_DIR = process.env.VAULT_CACHE_DIR || path.join(process.cwd(), ".cache", "media");
const COOKIES_PATH = path.join(CACHE_DIR, "cookies.txt");

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/cookies          — returns { present: boolean, size?: number }
 * POST /api/cookies         — upload cookies.txt (body = raw cookies file content)
 * DELETE /api/cookies       — removes the cookies file
 */
export async function GET() {
  const present = await exists(COOKIES_PATH);
  if (!present) {
    return NextResponse.json({ present: false });
  }
  try {
    const { stdout } = await exec("python3", [PIPELINE, "cookies_status"], {
      cwd: process.cwd(),
    });
    return NextResponse.json(JSON.parse(stdout.trim()));
  } catch {
    return NextResponse.json({ present: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    if (!body || body.length < 50) {
      return NextResponse.json(
        { error: "Cookies file looks empty or invalid. Make sure you exported it correctly from your browser." },
        { status: 400 }
      );
    }
    // Basic sanity check — Netscape cookies format starts with "# Netscape HTTP Cookie File"
    // or contains tab-separated lines. We don't strictly require the header, but check
    // for at least one tab-separated cookie line.
    const hasCookieLine = body.split("\n").some(
      (l) => !l.startsWith("#") && l.trim().length > 0 && l.split("\t").length >= 7
    );
    if (!hasCookieLine) {
      return NextResponse.json(
        {
          error:
            "This doesn't look like a Netscape cookies.txt file. Use a browser extension like 'Get cookies.txt LOCALLY' to export one.",
        },
        { status: 400 }
      );
    }

    await mkdir(path.dirname(COOKIES_PATH), { recursive: true });
    await writeFile(COOKIES_PATH, body, "utf8");
    return NextResponse.json({ ok: true, size: body.length });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to save cookies: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    if (await exists(COOKIES_PATH)) {
      await unlink(COOKIES_PATH);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to remove cookies: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
