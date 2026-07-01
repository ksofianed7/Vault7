"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Film, Music, Instagram, Check, AlertCircle } from "lucide-react";
import { useSnapVault, type DownloadFormat } from "@/lib/store";
import { toast } from "sonner";
import { VaultLogo } from "./logo";

export function SettingsScreen() {
  const settings = useSnapVault((s) => s.settings);
  const update = useSnapVault((s) => s.updateSettings);
  const clearHistory = useSnapVault((s) => s.clearHistory);

  // Read-only Instagram auth status (operator-configured via env var)
  const [igAuthed, setIgAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth-status")
      .then((r) => r.json())
      .then((d) => setIgAuthed(!!d.instagram))
      .catch(() => setIgAuthed(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Section: Default format */}
      <Section number="01" title="Default format" hint="What loads first when you paste a link">
        <div className="grid grid-cols-2 gap-2">
          <Choice
            active={settings.defaultFormat === "video"}
            onClick={() => update({ defaultFormat: "video" as DownloadFormat })}
            icon={<Film className="h-4 w-4" />}
            label="Video"
            hint="MP4 · 360p to 4K"
          />
          <Choice
            active={settings.defaultFormat === "audio"}
            onClick={() => update({ defaultFormat: "audio" as DownloadFormat })}
            icon={<Music className="h-4 w-4" />}
            label="Audio"
            hint="MP3 · only real bitrates"
          />
        </div>
      </Section>

      {/* Section: Behavior */}
      <Section number="02" title="Behavior" hint="How Vault responds to your actions">
        <Toggle
          label="Auto-open timeline"
          desc="Show the trim timeline when a video loads"
          value={settings.autoTrim}
          onChange={(v) => update({ autoTrim: v })}
        />
        <Toggle
          label="Persist to archive"
          desc="Keep a local log of saved items on this device"
          value={settings.saveHistory}
          onChange={(v) => update({ saveHistory: v })}
        />
        <Toggle
          label="Haptic feedback"
          desc="Subtle vibration on tap (Android PWA only)"
          value={settings.hapticFeedback}
          onChange={(v) => update({ hapticFeedback: v })}
        />
      </Section>

      {/* Section: Storage */}
      <Section number="03" title="Storage" hint="Manage what stays on this device">
        <button
          onClick={() => {
            clearHistory();
            toast.success("Archive cleared");
          }}
          className="surface-inset hover:bg-[rgba(229,72,77,0.06)] w-full rounded-md px-4 py-3 text-left font-mono text-[11px] text-cream/80 transition"
        >
          Clear archive
        </button>
      </Section>

      {/* About */}
      <Section number="04" title="Colophon" hint="What this is and how it works">
        <div className="surface-inset rounded-md p-4">
          <div className="flex items-center gap-3">
            <VaultLogo size={28} />
            <div className="flex-1">
              <div className="font-display text-[16px] font-medium text-cream">Vault</div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-warm">
                v.05 · po-token + ig cookies
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[rgba(245,239,224,0.05)] space-y-2">
            {/* Platform auth status — read-only, shows what's working */}
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="flex items-center gap-1.5 text-cream/70">
                <Check className="h-3 w-3 text-coral" strokeWidth={3} />
                YouTube
              </span>
              <span className="text-warm">PO Token — no login</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="flex items-center gap-1.5 text-cream/70">
                <Check className="h-3 w-3 text-coral" strokeWidth={3} />
                TikTok
              </span>
              <span className="text-warm">Impersonation — no login</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="flex items-center gap-1.5 text-cream/70">
                <Instagram className="h-3 w-3" />
                Instagram
              </span>
              {igAuthed === null ? (
                <span className="text-warm">…</span>
              ) : igAuthed ? (
                <span className="flex items-center gap-1 text-amber">
                  <Check className="h-3 w-3" strokeWidth={3} />
                  Cookies configured
                </span>
              ) : (
                <span className="flex items-center gap-1 text-warm">
                  <AlertCircle className="h-3 w-3" />
                  Needs operator cookies
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[rgba(245,239,224,0.05)] font-mono text-[10px] leading-relaxed text-warm">
            Vault uses{" "}
            <code className="text-coral">yt-dlp</code> with the{" "}
            <code className="text-coral">BgUtils PO Token</code> provider for
            YouTube, and operator-side cookies for Instagram. Real metadata,
            real storyboards, real waveforms, real downloads.
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  number,
  title,
  hint,
  children,
}: {
  number?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2.5 min-w-0">
          {number && (
            <span className="font-mono text-[10px] tabular-nums text-coral shrink-0">
              {number}
            </span>
          )}
          <h3 className="font-display text-[20px] font-medium tracking-tight text-cream truncate">
            {title}
          </h3>
        </div>
        {hint && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-warm text-right shrink-0">
            {hint}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Choice({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative flex flex-col items-start gap-1.5 rounded-md border px-4 py-3.5 text-left transition ${
        active
          ? "border-coral bg-[rgba(255,107,74,0.06)]"
          : "surface-inset border-transparent hover:border-[rgba(245,239,224,0.1)]"
      }`}
    >
      <div className={active ? "text-coral" : "text-warm"}>{icon}</div>
      <div className={`font-display text-[15px] font-medium ${active ? "text-cream" : "text-cream/80"}`}>
        {label}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-warm">{hint}</div>
    </motion.button>
  );
}

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="surface-inset flex items-center justify-between rounded-md px-4 py-3">
      <div className="min-w-0 flex-1 pr-3">
        <div className="font-display text-[14px] font-medium text-cream">{label}</div>
        <div className="mt-0.5 font-mono text-[10px] text-warm">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          value ? "bg-coral" : "bg-[rgba(245,239,224,0.1)]"
        }`}
        style={value ? { boxShadow: "0 0 12px rgba(255, 107, 74, 0.4)" } : undefined}
      >
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-0.5 h-4 w-4 rounded-full bg-cream"
          style={{ left: value ? "calc(100% - 18px)" : 2 }}
        />
      </button>
    </div>
  );
}
