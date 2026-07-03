/**
 * Self-restart mechanism — exits the process every 2 hours to clear memory.
 * Railway automatically restarts the container when the process exits.
 *
 * This is a pragmatic solution for memory leaks in long-running Node.js
 * processes that spawn Python subprocesses (yt-dlp, ffmpeg). For small
 * user counts (1-5 users), the 10-second restart downtime is negligible.
 *
 * The timer only starts in production (NODE_ENV=production) to avoid
 * restarting during local development.
 */

const RESTART_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

let restartTimer: NodeJS.Timeout | null = null;

export function startAutoRestart() {
  // Only auto-restart in production
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  // Don't start twice
  if (restartTimer) {
    return;
  }

  console.log(`[auto-restart] Will restart in 2 hours to clear memory`);

  restartTimer = setTimeout(() => {
    console.log(`[auto-restart] 2 hours reached — exiting to clear memory. Railway will restart.`);
    process.exit(0);
  }, RESTART_INTERVAL_MS);

  // Don't keep the process alive just for this timer
  restartTimer.unref();
}

/**
 * Reset the restart timer (call this on active requests to delay restart
 * during active use). Optional — for now we just restart on the fixed interval.
 */
export function resetRestartTimer() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
    startAutoRestart();
  }
}
