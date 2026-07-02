import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);

/**
 * GET /api/debug
 *
 * Debug endpoint to check if deno + PO token provider are working.
 * Remove this in production after debugging is done.
 */
export async function GET() {
  const results: Record<string, any> = {};

  // Check if deno exists
  try {
    const { stdout: denoVersion } = await exec("deno", ["--version"]);
    results.deno = { installed: true, version: denoVersion.trim().split("\n")[0] };
  } catch {
    results.deno = { installed: false, error: "deno not found in PATH" };
  }

  // Check if the PO token script exists
  const scriptPath = path.join(process.cwd(), "scripts/pot-provider/src/generate_once.ts");
  try {
    await access(scriptPath);
    results.potScript = { exists: true, path: scriptPath };
  } catch {
    results.potScript = { exists: false, path: scriptPath };
  }

  // Check if node_modules exists for the pot-provider
  const nodeModulesPath = path.join(process.cwd(), "scripts/pot-provider/node_modules");
  try {
    await access(nodeModulesPath);
    results.potNodeModules = { exists: true };
  } catch {
    results.potNodeModules = { exists: false };
  }

  // Check yt-dlp version
  try {
    const { stdout: ytdlpVersion } = await exec("yt-dlp", ["--version"]);
    results.ytDlp = { installed: true, version: ytdlpVersion.trim() };
  } catch {
    results.ytDlp = { installed: false };
  }

  // Check ffmpeg
  try {
    const { stdout: ffmpegVersion } = await exec("ffmpeg", ["-version"]);
    results.ffmpeg = { installed: true, version: ffmpegVersion.trim().split("\n")[0] };
  } catch {
    results.ffmpeg = { installed: false };
  }

  // Check env vars
  results.env = {
    VAULT_CACHE_DIR: process.env.VAULT_CACHE_DIR || "not set",
    NODE_ENV: process.env.NODE_ENV || "not set",
    HOSTNAME: process.env.HOSTNAME || "not set",
    DENO_DIR: process.env.DENO_DIR || "not set",
    PATH_has_usr_local_bin: (process.env.PATH || "").includes("/usr/local/bin"),
  };

  return NextResponse.json(results, { status: 200 });
}
