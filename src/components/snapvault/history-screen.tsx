"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Trash2, Film, Music, Clock, Archive } from "lucide-react";
import { useSnapVault } from "@/lib/store";
import { detectPlatform, formatTime, formatDuration } from "@/lib/platform";
import { PlatformBadge } from "./platform-badge";
import { toast } from "sonner";

export function HistoryScreen() {
  const history = useSnapVault((s) => s.history);
  const clearHistory = useSnapVault((s) => s.clearHistory);
  const removeHistory = useSnapVault((s) => s.removeHistory);
  const [q, setQ] = useState("");

  const filtered = history.filter(
    (h) =>
      h.title.toLowerCase().includes(q.toLowerCase()) ||
      h.author.toLowerCase().includes(q.toLowerCase()) ||
      h.url.toLowerCase().includes(q.toLowerCase())
  );

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-md surface-inset">
          <Archive className="h-5 w-5 text-warm" strokeWidth={1.5} />
        </div>
        <h3 className="mt-5 font-display text-[20px] font-medium text-cream">
          The archive is empty
        </h3>
        <p className="mt-2 font-mono text-[11px] text-warm max-w-[260px] leading-relaxed">
          Saved videos and audio will appear here, with thumbnails and trim details intact.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-[28px] font-medium tracking-tight text-cream">
            Archive
          </h2>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-warm">
            {history.length} {history.length === 1 ? "item" : "items"} saved
          </div>
        </div>
        <button
          onClick={() => {
            clearHistory();
            toast.success("Archive cleared");
          }}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-warm hover:text-[#e5484d]"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>

      {/* Search */}
      <div className="surface-inset flex items-center gap-2.5 rounded-md px-3 py-2.5">
        <Search className="h-3.5 w-3.5 text-warm" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search the archive"
          className="flex-1 bg-transparent font-mono text-[12px] text-cream placeholder:text-[#5a5448] outline-none"
        />
      </div>

      {/* List */}
      <div className="divide-y divide-[rgba(245,239,224,0.08)]">
        <AnimatePresence initial={false}>
          {filtered.map((h, idx) => {
            const info = detectPlatform(h.url);
            const catalog = String(history.length - idx).padStart(3, "0");
            return (
              <motion.div
                key={h.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="group flex items-center gap-3 py-3"
              >
                {/* Catalog number */}
                <span className="font-mono text-[10px] tabular-nums text-warm shrink-0 w-7">
                  №{catalog}
                </span>

                {/* Thumbnail */}
                <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-sm bg-[#0a0908]">
                  <img src={h.thumbnail} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
                  <div className="absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded-sm bg-ink/80">
                    {h.format === "video" ? (
                      <Film className="h-2 w-2 text-cream" />
                    ) : (
                      <Music className="h-2 w-2 text-cream" />
                    )}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={info.platform} />
                  </div>
                  <div className="mt-1 truncate font-display text-[14px] font-medium text-cream">
                    {h.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-warm">
                    <span>{h.author}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDuration(h.duration)}
                    </span>
                  </div>
                  {(h.trimStart !== 0 || h.trimEnd !== h.duration) && (
                    <div className="mt-0.5 font-mono text-[9px] tabular-nums text-coral">
                      IN {formatTime(h.trimStart ?? 0)} · OUT {formatTime(h.trimEnd ?? h.duration)}
                    </div>
                  )}
                </div>

                {/* Quality + size + delete */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="font-mono text-[10px] tabular-nums text-cream/70">
                    {h.quality}
                  </span>
                  {h.fileSize && (
                    <span className="font-mono text-[9px] tabular-nums text-amber">
                      {h.fileSize}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      removeHistory(h.id);
                      toast.success("Removed");
                    }}
                    className="text-warm opacity-0 group-hover:opacity-100 hover:text-[#e5484d] transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
