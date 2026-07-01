"use client";

import { useRef } from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { useSnapVault, uid, type DownloadItem, type HistoryItem } from "@/lib/store";
import type { VideoMeta, QualityOption } from "@/lib/platform";
import type { DownloadFormat } from "@/lib/store";

interface DownloadButtonProps {
  meta: VideoMeta;
  format: DownloadFormat;
  quality: QualityOption | undefined;
  trimStart: number;
  trimEnd: number;
  customFilename?: string;
  onDone: () => void;
}

export function DownloadButton({
  meta,
  format,
  quality,
  trimStart,
  trimEnd,
  customFilename,
  onDone,
}: DownloadButtonProps) {
  const [stage, setStage] = useState<"idle" | "fetching" | "processing" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);

  const addDownload = useSnapVault((s) => s.addDownload);
  const updateDownload = useSnapVault((s) => s.updateDownload);
  const removeDownload = useSnapVault((s) => s.removeDownload);
  const addHistory = useSnapVault((s) => s.addHistory);

  async function handleDownload() {
    if (!quality) {
      toast.error("Pick a quality first");
      return;
    }

    const isTrimmed = trimStart > 0.1 || trimEnd < meta.duration - 0.1;
    const id = uid("dl");
    const item: DownloadItem = {
      id,
      url: meta.url,
      platform: meta.platform,
      title: meta.title,
      author: meta.author,
      thumbnail: meta.thumbnail,
      duration: meta.duration,
      format,
      quality: quality.label,
      ext: quality.ext,
      trimStart,
      trimEnd,
      progress: 0,
      status: "fetching",
      createdAt: Date.now(),
    };
    addDownload(item);

    setStage("fetching");
    setProgress(0);

    // Simulate indeterminate progress while yt-dlp runs server-side.
    // (Server-Sent Events would be cleaner; this is good enough for the UI.)
    let current = 0;
    const tick = setInterval(() => {
      current = Math.min(0.92, current + Math.random() * 0.08);
      setProgress(current);
      updateDownload(id, { progress: current, status: "downloading" });
    }, 600);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: meta.url,
          format,
          qualityId: quality.id,           // real yt-dlp format_id
          qualityLabel: quality.label,
          ext: quality.ext,
          trimStart: isTrimmed ? trimStart : undefined,
          trimEnd: isTrimmed ? trimEnd : undefined,
          title: meta.title,
          author: meta.author,
          thumbnail: meta.thumbnail,
          duration: meta.duration,
          customFilename: customFilename || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Download failed" }));
        throw new Error(err.error ?? "Download failed");
      }
      const data = await res.json();

      clearInterval(tick);
      setProgress(1);
      updateDownload(id, {
        progress: 1,
        status: "completed",
        fileSize: data.size,
      });
      setStage("done");

      // Trigger the actual file download in the browser
      if (data.downloadUrl) {
        const a = document.createElement("a");
        a.href = data.downloadUrl;
        a.download = data.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      const hist: HistoryItem = {
        id,
        url: meta.url,
        platform: meta.platform,
        title: meta.title,
        author: meta.author,
        thumbnail: meta.thumbnail,
        duration: meta.duration,
        format,
        quality: quality.label,
        trimStart: isTrimmed ? trimStart : undefined,
        trimEnd: isTrimmed ? trimEnd : undefined,
        fileSize: data.size,
        createdAt: Date.now(),
      };
      addHistory(hist);

      toast.success("Saved to vault", {
        description: `${format.toUpperCase()} · ${quality.label} · ${data.size}`,
      });

      setTimeout(() => {
        setStage("idle");
        setProgress(0);
        setTimeout(() => removeDownload(id), 3000);
        onDone();
      }, 1500);
    } catch (e) {
      clearInterval(tick);
      setStage("error");
      updateDownload(id, { status: "failed", error: (e as Error).message });
      toast.error("Download failed", { description: (e as Error).message });
      setTimeout(() => setStage("idle"), 2500);
    }
  }

  const isWorking = stage === "fetching" || stage === "processing";

  return (
    <button
      ref={btnRef}
      onClick={handleDownload}
      disabled={isWorking}
      className="group relative w-full overflow-hidden rounded-lg bg-cream text-ink disabled:opacity-90"
    >
      {/* Progress fill */}
      {(isWorking || stage === "done") && (
        <motion.div
          className="absolute inset-y-0 left-0 bg-coral"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ ease: "linear", duration: 0.3 }}
        />
      )}

      <div className="relative flex items-center justify-center gap-2.5 px-5 py-4">
        <AnimatePresence mode="wait">
          {stage === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <Download className="h-4 w-4" strokeWidth={2.5} />
              <span className="font-display text-[15px] font-medium tracking-tight">
                Save to vault
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider opacity-60">
                {quality?.label ?? "—"}
              </span>
            </motion.div>
          )}
          {(stage === "fetching" || stage === "processing") && (
            <motion.div
              key="working"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-mono text-[12px] tabular-nums">
                {String(Math.round(progress * 100)).padStart(2, "0")}%
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                downloading
              </span>
            </motion.div>
          )}
          {stage === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2.5 text-cream"
            >
              <Check className="h-4 w-4" strokeWidth={3} />
              <span className="font-display text-[15px] font-medium tracking-tight">
                Saved
              </span>
            </motion.div>
          )}
          {stage === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2.5"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="font-display text-[15px]">Failed — retry</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </button>
  );
}
