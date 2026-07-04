"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { QualityOption, VideoMeta } from "@/lib/platform";
import type { DownloadFormat } from "@/lib/store";

interface FormatPickerProps {
  meta: VideoMeta;
  format: DownloadFormat;
  setFormat: (f: DownloadFormat) => void;
  qualityId: string;
  setQualityId: (id: string) => void;
}

export function FormatPicker({
  meta,
  format,
  setFormat,
  qualityId,
  setQualityId,
}: FormatPickerProps) {
  const options = meta.qualities.filter((q) => q.type === format);
  const effectiveId =
    options.find((o) => o.id === qualityId)?.id ?? options[0]?.id ?? "";

  return (
    <div>
      {/* Typographic toggle — no pill, just text with underline indicator */}
      <div className="flex items-center gap-6 border-b border-[rgba(245,239,224,0.06)]">
        {(["video", "audio"] as DownloadFormat[]).map((f) => {
          const active = format === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className="relative pb-2.5 pt-1"
            >
              <span
                className={`font-display text-[20px] font-medium tracking-tight transition-colors ${
                  active ? "text-cream" : "text-warm hover:text-cream/60"
                }`}
              >
                {f === "video" ? "Video" : "Audio"}
              </span>
              <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider text-warm">
                {f === "video" ? "mp4" : "mp3"}
              </span>
              {active && (
                <motion.div
                  layoutId="format-underline"
                  className="absolute -bottom-px left-0 right-0 h-0.5 bg-coral"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
        <div className="ml-auto pb-2.5 font-mono text-[9px] uppercase tracking-wider text-warm">
          {options.length} options
        </div>
      </div>

      {/* Quality list — vertical, like a pro audio app */}
      <div className="mt-1 divide-y divide-[rgba(245,239,224,0.05)]">
        {options.map((opt) => {
          const selected = opt.id === effectiveId;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setQualityId(opt.id)}
              className="group flex w-full items-center gap-4 py-3 text-left transition-colors hover:bg-[rgba(245,239,224,0.02)]"
            >
              {/* Selection indicator */}
              <div className="w-4 h-4 grid place-items-center shrink-0">
                {selected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <Check className="h-3.5 w-3.5 text-coral" strokeWidth={3} />
                  </motion.div>
                )}
              </div>

              {/* Quality label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-display text-[16px] font-medium tracking-tight ${
                      selected ? "text-cream" : "text-cream/70 group-hover:text-cream"
                    }`}
                  >
                    {opt.label}
                  </span>
                  {opt.fps ? (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-warm">
                      {opt.fps}fps
                    </span>
                  ) : null}
                  {opt.bitrate ? (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-warm">
                      {opt.bitrate}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Size */}
              {opt.size ? (
                <div className="font-mono text-[11px] tabular-nums text-warm">
                  {opt.size}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
