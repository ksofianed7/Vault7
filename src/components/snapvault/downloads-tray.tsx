"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, AlertCircle, X } from "lucide-react";
import { useSnapVault } from "@/lib/store";
import { formatTime } from "@/lib/platform";

export function DownloadsTray() {
  const downloads = useSnapVault((s) => s.downloads);
  const remove = useSnapVault((s) => s.removeDownload);

  return (
    <AnimatePresence>
      {downloads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="surface rounded-lg overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-[rgba(245,239,224,0.06)] px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-warm">
              In progress · {downloads.length}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            <AnimatePresence initial={false}>
              {downloads.map((d) => (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-[rgba(245,239,224,0.04)] last:border-0"
                >
                  <div className="relative h-9 w-12 shrink-0 overflow-hidden rounded-sm bg-[#0a0908]">
                    <img src={d.thumbnail} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="truncate font-display text-[13px] font-medium text-cream">
                        {d.title}
                      </span>
                      <span className="ml-2 shrink-0 font-mono text-[10px] tabular-nums text-warm">
                        {d.status === "completed" ? "done" : `${Math.round(d.progress * 100)}%`}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-[rgba(245,239,224,0.06)]">
                        <motion.div
                          className="absolute inset-y-0 left-0 bg-coral"
                          animate={{ width: `${d.progress * 100}%` }}
                          transition={{ ease: "easeOut" }}
                        />
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-warm">
                        {d.format}
                      </span>
                      <span className="font-mono text-[9px] tabular-nums text-warm">
                        {d.quality}
                      </span>
                      {(d.trimStart !== 0 || d.trimEnd !== d.duration) && (
                        <span className="font-mono text-[9px] tabular-nums text-coral">
                          {formatTime(d.trimStart)}-{formatTime(d.trimEnd)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {d.status === "completed" ? (
                      <Check className="h-3.5 w-3.5 text-coral" strokeWidth={3} />
                    ) : d.status === "failed" ? (
                      <AlertCircle className="h-3.5 w-3.5 text-[#e5484d]" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-warm" />
                    )}
                  </div>
                  <button
                    onClick={() => remove(d.id)}
                    className="grid h-6 w-6 place-items-center rounded text-warm hover:text-cream"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
