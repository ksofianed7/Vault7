"use client";

interface PlatformBadgeProps {
  platform: "youtube" | "instagram" | "tiktok" | "pinterest" | "unknown";
  size?: "sm" | "md";
}

const STYLES: Record<string, { label: string; color: string; dot: string }> = {
  youtube: { label: "YouTube", color: "text-[#ff6b4a]", dot: "#ff6b4a" },
  instagram: { label: "Instagram", color: "text-[#e8c547]", dot: "#e8c547" },
  tiktok: { label: "TikTok", color: "text-cream", dot: "#f5efe0" },
  pinterest: { label: "Pinterest", color: "text-[#ff6b4a]", dot: "#e60023" },
  unknown: { label: "Unknown", color: "text-warm", dot: "#8a8474" },
};

export function PlatformBadge({ platform, size = "sm" }: PlatformBadgeProps) {
  const s = STYLES[platform];
  if (!s || platform === "unknown") return null;
  const text = size === "md" ? "text-[11px]" : "text-[10px]";
  return (
    <div className={`inline-flex items-center gap-1.5 ${text} font-mono uppercase tracking-wider ${s.color}`}>
      <span
        className="block h-1 w-1 rounded-full"
        style={{ background: s.dot }}
      />
      {s.label}
    </div>
  );
}
