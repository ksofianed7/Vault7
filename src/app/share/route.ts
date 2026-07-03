import { NextRequest, NextResponse } from "next/server";

/**
 * GET /share?url=... or /share?text=...
 *
 * Handles Android share intents. Redirects to / with the URL as a query param
 * so the main page can auto-fetch it.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const url = sp.get("url");
  const text = sp.get("text");

  let targetUrl = "/";

  if (url) {
    targetUrl = `/?url=${encodeURIComponent(url)}`;
  } else if (text) {
    // Extract URL from text
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      targetUrl = `/?url=${encodeURIComponent(urlMatch[0])}`;
    }
  }

  return NextResponse.redirect(new URL(targetUrl, req.url));
}
