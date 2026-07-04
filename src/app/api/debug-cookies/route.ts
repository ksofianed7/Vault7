import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);

/**
 * GET /api/debug-cookies
 *
 * Debug endpoint to verify Instagram cookies are configured correctly.
 * Returns diagnostic info about the cookies setup (without exposing the actual
 * cookie values for security).
 */
export async function GET() {
  const cacheDir = process.env.VAULT_CACHE_DIR || path.join(process.cwd(), ".cache", "media");
  const cookiesPath = path.join(cacheDir, "cookies.txt");
  const envVarSet = !!process.env.VAULT_COOKIES_B64;
  const envVarLength = process.env.VAULT_COOKIES_B64?.length || 0;

  let fileExists = false;
  let fileSize = 0;
  let hasInstagramDomain = false;
  let hasSessionId = false;

  try {
    await access(cookiesPath);
    fileExists = true;
    const stats = await stat(cookiesPath);
    fileSize = stats.size;

    // Read the file and check for key cookies (without exposing values)
    const content = await readFile(cookiesPath, "utf8");
    hasInstagramDomain = content.includes(".instagram.com");
    hasSessionId = /sessionid\s/.test(content);
  } catch {
    // File doesn't exist
  }

  return NextResponse.json({
    envVarSet,
    envVarLength,
    cacheDir,
    cookiesPath,
    fileExists,
    fileSize,
    hasInstagramDomain,
    hasSessionId,
    // Instructions for fixing common issues
    issues: [
      !envVarSet && "VAULT_COOKIES_B64 env var is not set",
      envVarSet && envVarLength < 100 && "VAULT_COOKIES_B64 looks too short — may be truncated",
      !fileExists && "Cookies file was not created — check if cache dir is writable",
      fileExists && !hasInstagramDomain && "Cookies file doesn't contain .instagram.com cookies",
      fileExists && !hasSessionId && "Cookies file is missing the 'sessionid' cookie — required for Instagram",
    ].filter(Boolean),
  });
}
