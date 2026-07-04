// Platform detection + types for Vault

export type Platform = "youtube" | "instagram" | "tiktok" | "pinterest" | "unknown";

export interface PlatformInfo {
  platform: Platform;
  label: string;
  color: string;       // tailwind text color class
  bg: string;          // tailwind bg color class (semi-transparent)
  gradient: string;    // gradient css for badges
}

const PLATFORM_PATTERNS: Array<{ platform: Platform; pattern: RegExp }> = [
  { platform: "youtube", pattern: /(youtube\.com|youtu\.be|youtube-nocookie\.com)/i },
  { platform: "instagram", pattern: /(instagram\.com|instagr\.am)/i },
  { platform: "tiktok", pattern: /(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i },
  { platform: "pinterest", pattern: /(pinterest\.com|pin\.it|pinimg\.com)/i },
];

export function detectPlatform(url: string): PlatformInfo {
  const trimmed = url.trim();
  for (const { platform, pattern } of PLATFORM_PATTERNS) {
    if (pattern.test(trimmed)) {
      switch (platform) {
        case "youtube":
          return {
            platform,
            label: "YouTube",
            color: "text-red-300",
            bg: "bg-red-500/15",
            gradient: "linear-gradient(135deg, #ff0000, #c4302b)",
          };
        case "instagram":
          return {
            platform,
            label: "Instagram",
            color: "text-pink-200",
            bg: "bg-pink-500/15",
            gradient: "linear-gradient(135deg, #f58529, #dd2a7b, #8134af)",
          };
        case "tiktok":
          return {
            platform,
            label: "TikTok",
            color: "text-cyan-200",
            bg: "bg-cyan-500/15",
            gradient: "linear-gradient(135deg, #25f4ee, #000, #fe2c55)",
          };
        case "pinterest":
          return {
            platform,
            label: "Pinterest",
            color: "text-red-200",
            bg: "bg-red-500/15",
            gradient: "linear-gradient(135deg, #e60023, #bd081c)",
          };
      }
    }
  }
  return {
    platform: "unknown",
    label: "Unknown",
    color: "text-white/70",
    bg: "bg-white/5",
    gradient: "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))",
  };
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export interface VideoMeta {
  url: string;
  platform: Platform;
  title: string;
  author: string;
  thumbnail: string;
  duration: number; // seconds
  views?: string;
  description?: string;
  qualities: QualityOption[];
}

/**
 * MediaBundle is the real pro-editor media prepared by /api/media/prepare.
 * It contains:
 *  - Real storyboard thumbnails extracted via ffmpeg (one per second of video)
 *  - Real waveform peaks computed from the source's audio track (not synthesized)
 *  - Real audio MP3 URL for playback during trim preview
 */
export interface MediaBundle {
  bundleId: string;
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  storyboard: string[];   // relative URLs to thumbnails
  waveform: number[];     // 0..1 peaks (real, not synthetic)
  audioUrl: string;       // relative URL to MP3
}

export interface QualityOption {
  id: string;
  label: string;       // "1080p"
  type: "video" | "audio";
  ext: string;         // "mp4" | "mp3"
  size?: string;       // "12.4 MB"
  fps?: number;
  bitrate?: string;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatTime(seconds: number): string {
  return formatDuration(seconds);
}
