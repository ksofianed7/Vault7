import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);
const PIPELINE = "scripts/source_pipeline.py";
const CACHE_DIR = process.env.VAULT_CACHE_DIR || path.join(process.cwd(), ".cache", "media");
const COOKIES_PATH = path.join(CACHE_DIR, "cookies.txt");

/**
 * GET /api/auth-status
 *
 * Read-only check of whether Instagram cookies are configured.
 * YouTube and TikTok don't need cookies (PO Token handles auth).
 *
 * Returns: { instagram: boolean }
 */
export async function GET() {
  try {
    const exists = await access(COOKIES_PATH).then(() => true).catch(() => false);
    return NextResponse.json({ instagram: exists });
  } catch {
    return NextResponse.json({ instagram: false });
  }
}
