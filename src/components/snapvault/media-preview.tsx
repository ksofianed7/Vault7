"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";
import type { VideoMeta } from "@/lib/platform";
import { PlatformBadge } from "./platform-badge";
import { formatDuration } from "@/lib/platform";

interface MediaPreviewProps {
  meta: VideoMeta;
}

export function MediaPreview({ meta }: MediaPreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.9, 0.3, 1] }}
      className="surface relative overflow-hidden rounded-lg"
    >
      {/* Filmstrip top sprocket row */}
      <div className="h-3 sprocket-holes bg-[#0a0908]" />

      {/* Thumbnail */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0a0908]">
        <img
          src={meta.thumbnail}
          alt={meta.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {/* Warm grade overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(14,13,11,0) 50%, rgba(14,13,11,0.85) 100%)",
          }}
        />

        {/* Top metadata row */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <PlatformBadge platform={meta.platform} size="md" />
          <div className="font-mono text-[10px] text-cream/80 bg-ink/60 px-1.5 py-0.5 rounded">
            {formatDuration(meta.duration)}
          </div>
        </div>

        {/* Center play affordance */}
        <div className="absolute inset-0 grid place-items-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="grid h-12 w-12 place-items-center rounded-full bg-cream/95 text-ink"
            aria-label="Preview"
          >
            <Play className="h-4 w-4 fill-current translate-x-0.5" />
          </motion.button>
        </div>
      </div>

      {/* Filmstrip bottom sprocket row */}
      <div className="h-3 sprocket-holes bg-[#0a0908]" />

      {/* Meta */}
      <div className="p-4">
        <h3 className="font-display text-[17px] font-medium leading-snug text-cream line-clamp-2">
          {meta.title}
        </h3>
        <div className="mt-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-warm">
          <span className="text-cream/80">{meta.author}</span>
          {meta.views && (
            <>
              <span>·</span>
              <span>{meta.views}</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
