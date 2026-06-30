"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { UrlInput } from "./url-input";
import { MediaPreview } from "./media-preview";
import { FormatPicker } from "./format-picker";
import { TrimTool } from "./trim-tool";
import { DownloadButton } from "./download-button";
import { DownloadsTray } from "./downloads-tray";
import { useSnapVault, type DownloadFormat } from "@/lib/store";
import type { VideoMeta, MediaBundle } from "@/lib/platform";

export function DownloadScreen() {
  const [loading, setLoading] = useState(false);
  const [showTrim, setShowTrim] = useState(false);
  const [format, setFormat] = useState<DownloadFormat>("video");
  const [qualityId, setQualityId] = useState("");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const media = useSnapVault((s) => s.currentMedia);
  const setMedia = useSnapVault((s) => s.setCurrentMedia);
  const settings = useSnapVault((s) => s.settings);

  const bundle = useSnapVault((s) => s.mediaBundle);
  const setBundle = useSnapVault((s) => s.setMediaBundle);
  const [preparingBundle, setPreparingBundle] = useState(false);

  useEffect(() => {
    if (media) {
      setFormat(settings.defaultFormat);
      setTrimStart(0);
      setTrimEnd(media.duration);
      setShowTrim(settings.autoTrim);
      const firstVideo = media.qualities.find((q) => q.type === "video");
      const firstAudio = media.qualities.find((q) => q.type === "audio");
      setQualityId(
        (settings.defaultFormat === "video" ? firstVideo : firstAudio)?.id ??
          media.qualities[0]?.id ??
          ""
      );

      // Kick off the real media bundle preparation (storyboard + waveform + audio)
      // so the trim tool has real assets ready when expanded.
      prepareBundle(media.url);
    }
  }, [media, settings.defaultFormat, settings.autoTrim]);

  // Clear bundle when media is cleared or URL changes
  useEffect(() => {
    if (!media) setBundle(null);
  }, [media, setBundle]);

  async function prepareBundle(url: string) {
    setPreparingBundle(true);
    try {
      const res = await fetch("/api/media/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Prepare failed" }));
        throw new Error(err.error ?? "Prepare failed");
      }
      const data: MediaBundle = await res.json();
      setBundle(data);
      // OVERRIDE the trim tool's duration with the bundle's REAL probed
      // duration. The fetch-meta endpoint returns a synthetic duration (since
      // yt-dlp isn't available in sandbox), but the bundle is real ffmpeg output.
      // In production with yt-dlp, fetch-meta and bundle durations will match.
      if (data.duration > 0) {
        setTrimStart(0);
        setTrimEnd(data.duration);
      }
    } catch (e) {
      // Don't toast error — just silently fall back to no bundle (trim tool
      // will show empty state). The download flow still works.
      console.warn("Media bundle prepare failed:", (e as Error).message);
      setBundle(null);
    } finally {
      setPreparingBundle(false);
    }
  }

  async function handleFetch(url: string) {
    setLoading(true);
    setBundle(null);
    try {
      const res = await fetch("/api/fetch-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Fetch failed" }));
        throw new Error(err.error);
      }
      const data: VideoMeta = await res.json();
      setMedia(data);
      toast.success("Source acquired", {
        description: data.title.slice(0, 50),
      });
    } catch (e) {
      toast.error("Couldn't fetch that link", {
        description: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }

  const selectedQuality = (() => {
    if (!media) return undefined;
    const opts = media.qualities.filter((q) => q.type === format);
    return opts.find((q) => q.id === qualityId) ?? opts[0];
  })();

  return (
    <div className="space-y-6">
      {/* Editorial hero — asymmetric, not centered */}
      <div className="relative">
        {/* Issue / date marker */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-coral">
              № 01
            </span>
            <span className="h-px w-8 bg-[rgba(245,239,224,0.1)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-warm">
              The Vault
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-warm">
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>

        {/* Big editorial headline */}
        <h1 className="font-display text-[42px] leading-[0.95] tracking-tight text-cream">
          Keep the frame,
          <br />
          <span className="italic font-light text-coral">drop the noise.</span>
        </h1>

        <p className="mt-5 max-w-[280px] text-[13px] leading-relaxed text-cream/60">
          A considered downloader for YouTube, Instagram, and TikTok.
          Pick the moment, choose the format, archive it.
        </p>

        {/* Hairline rule — editorial detail */}
        <div className="hairline mt-6" />
      </div>

      {/* URL input with figure caption */}
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-warm">
            Fig. 01 — Input
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-warm">
            source
          </span>
        </div>
        <UrlInput onSubmit={handleFetch} loading={loading} />
      </div>

      {/* Loading state */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="surface-inset rounded-lg p-8 flex flex-col items-center text-center"
          >
            <Loader2 className="h-4 w-4 animate-spin text-coral" />
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-warm">
              Acquiring source…
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media + controls */}
      <AnimatePresence>
        {media && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.2, 0.9, 0.3, 1] }}
            className="space-y-6"
          >
            <MediaPreview meta={media} />

            {/* Format + quality */}
            <div className="surface rounded-lg p-4">
              <FormatPicker
                meta={media}
                format={format}
                setFormat={setFormat}
                qualityId={qualityId}
                setQualityId={setQualityId}
              />
            </div>

            {/* Trim section */}
            <div>
              <button
                onClick={() => setShowTrim((s) => !s)}
                className="flex w-full items-center justify-between py-1"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-display text-[20px] font-medium tracking-tight text-cream">
                    Trim
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-warm">
                    {showTrim ? "collapse" : "expand"}
                  </span>
                  {/* Media bundle status indicator */}
                  {preparingBundle && (
                    <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-coral">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      preparing
                    </span>
                  )}
                  {bundle && !preparingBundle && (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-amber">
                      ready
                    </span>
                  )}
                </div>
                {showTrim ? (
                  <ChevronUp className="h-4 w-4 text-warm" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-warm" />
                )}
              </button>

              <AnimatePresence initial={false}>
                {showTrim && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.2, 0.9, 0.3, 1] }}
                    className="overflow-hidden mt-3"
                  >
                    <TrimTool
                      duration={bundle?.duration ?? media.duration}
                      trimStart={trimStart}
                      trimEnd={trimEnd}
                      setTrimStart={setTrimStart}
                      setTrimEnd={setTrimEnd}
                      bundle={bundle}
                      format={format}
                      preparing={preparingBundle}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Download */}
            <DownloadButton
              meta={media}
              format={format}
              quality={selectedQuality}
              trimStart={trimStart}
              trimEnd={trimEnd}
              onDone={() => {}}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active downloads */}
      <DownloadsTray />
    </div>
  );
}
