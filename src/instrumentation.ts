/**
 * Next.js instrumentation hook — runs once when the server starts.
 * We use this to start the auto-restart timer.
 */
export async function register() {
  // Only run on the server (not during build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutoRestart } = await import("./lib/auto-restart");
    startAutoRestart();
  }
}
