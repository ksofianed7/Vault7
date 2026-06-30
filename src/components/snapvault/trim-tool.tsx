"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, Scissors, Loader2, Film, Music } from "lucide-react";
import { formatTime } from "@/lib/platform";
import type { MediaBundle } from "@/lib/platform";
import type { DownloadFormat } from "@/lib/store";

interface TrimToolProps {
  duration: number;
  trimStart: number;
  trimEnd: number;
  setTrimStart: (v: number) => void;
  setTrimEnd: (v: number) => void;
  // Real media bundle — provides storyboard for video mode, waveform for audio mode
  bundle: MediaBundle | null;
  // Current format — drives which timeline visualization to show
  format: DownloadFormat;
  // True while the backend is preparing the bundle
  preparing: boolean;
}

export function TrimTool({
  duration,
  trimStart,
  trimEnd,
  setTrimStart,
  setTrimEnd,
  bundle,
  format,
  preparing,
}: TrimToolProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [dragging, setDragging] = useState<null | "start" | "end" | "playhead">(null);
  const [playhead, setPlayhead] = useState(trimStart);
  const [playing, setPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const pct = (v: number) => `${(v / duration) * 100}%`;

  // REAL AUDIO SYNC — when playhead moves, seek the audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !bundle) return;
    if (Math.abs(audio.currentTime - playhead) > 0.15) {
      try {
        audio.currentTime = playhead;
      } catch {
        // seek may fail if metadata not loaded
      }
    }
  }, [playhead, bundle]);

  // Start / stop real audio playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !bundle) return;
    if (playing) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [playing, bundle]);

  // Real-time playhead sync from the audio element's timeupdate event
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !bundle) return;
    const onTimeUpdate = () => {
      const t = audio.currentTime;
      setPlayhead(t);
      // Auto-stop at trim end
      if (t >= trimEnd) {
        audio.pause();
        audio.currentTime = trimStart;
        setPlaying(false);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setPlayhead(trimStart);
    };
    const onCanPlay = () => setAudioReady(true);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("canplay", onCanPlay);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, [bundle, trimStart, trimEnd]);

  const updateFromClientX = useCallback(
    (clientX: number, which: "start" | "end" | "playhead") => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const t = ratio * duration;
      if (which === "start") {
        const newStart = Math.min(t, trimEnd - 0.3);
        setTrimStart(newStart);
        if (playhead < newStart) setPlayhead(newStart);
      } else if (which === "end") {
        const newEnd = Math.max(t, trimStart + 0.3);
        setTrimEnd(newEnd);
        if (playhead > newEnd) setPlayhead(newEnd);
      } else {
        setPlayhead(t);
      }
    },
    [duration, trimEnd, trimStart, playhead, setTrimEnd, setTrimStart]
  );

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      updateFromClientX(e.clientX, dragging);
    }
    function onUp() {
      setDragging(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, updateFromClientX]);

  const trimmedDuration = Math.max(0, trimEnd - trimStart);

  // Ruler ticks
  const tickInterval = duration > 120 ? 30 : duration > 30 ? 10 : 5;
  const ticks = Array.from({ length: Math.floor(duration / tickInterval) + 1 }, (_, i) => i * tickInterval);

  // Storyboard thumbnails (one per second). If bundle has fewer thumbs than
  // the duration, we tile them; if more, we slice.
  const storyboard = bundle?.storyboard ?? [];
  const thumbCount = Math.max(1, Math.min(storyboard.length, Math.ceil(duration)));

  // Real waveform peaks (from ffmpeg, not synthetic)
  const waveform = bundle?.waveform ?? [];

  const isVideoMode = format === "video";
  const showStoryboard = isVideoMode && storyboard.length > 0;
  const showWaveform = !isVideoMode && waveform.length > 0;

  return (
    <div className="surface rounded-lg overflow-hidden">
      {/* Hidden audio element for real playback */}
      {bundle?.audioUrl && (
        <audio
          ref={audioRef}
          src={bundle.audioUrl}
          preload="auto"
          crossOrigin="anonymous"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(245,239,224,0.06)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Scissors className="h-3 w-3 text-coral" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-warm">
            Timeline
          </span>
          {/* Mode badge — shows what's being displayed */}
          <span className="ml-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-coral">
            {isVideoMode ? <Film className="h-2.5 w-2.5" /> : <Music className="h-2.5 w-2.5" />}
            {isVideoMode ? "Storyboard" : "Waveform"}
          </span>
        </div>
        <div className="font-mono text-[11px] tabular-nums text-cream">
          {formatTime(trimmedDuration)}
          <span className="ml-1 text-warm">/ {formatTime(duration)}</span>
        </div>
      </div>

      {/* Ruler */}
      <div className="relative h-5 border-b border-[rgba(245,239,224,0.04)] bg-[#0a0908]">
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-0 bottom-0 flex flex-col items-center justify-end pb-1"
            style={{ left: pct(t) }}
          >
            <div className="w-px h-1.5 bg-[#5a5448]" />
            <span className="font-mono text-[8px] text-warm -translate-x-1/2 mt-0.5">
              {formatTime(t)}
            </span>
          </div>
        ))}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-20 select-none touch-none bg-[#0a0908] overflow-hidden"
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const t = ratio * duration;
          const dStart = Math.abs(t - trimStart);
          const dEnd = Math.abs(t - trimEnd);
          if (dStart < dEnd && dStart < duration * 0.05) {
            setDragging("start");
          } else if (dEnd < duration * 0.05) {
            setDragging("end");
          } else {
            setPlayhead(t);
            setDragging("playhead");
          }
        }}
      >
        {preparing ? (
          // Loading state — bundle is being generated by ffmpeg
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-warm">
              <Loader2 className="h-3 w-3 animate-spin text-coral" />
              {isVideoMode ? "Extracting storyboard…" : "Computing waveform…"}
            </div>
          </div>
        ) : showStoryboard ? (
          // VIDEO MODE — real storyboard thumbnails from ffmpeg
          <div className="absolute inset-0 flex">
            {Array.from({ length: thumbCount }).map((_, i) => {
              const thumbIdx = i % storyboard.length;
              const t = (i / thumbCount) * duration;
              const inRange = t >= trimStart && t <= trimEnd;
              return (
                <div
                  key={i}
                  className="flex-1 h-full relative overflow-hidden border-r border-[#0a0908] last:border-r-0"
                  style={{
                    opacity: inRange ? 1 : 0.35,
                    filter: inRange ? "none" : "grayscale(0.6) brightness(0.5)",
                  }}
                >
                  <img
                    src={storyboard[thumbIdx]}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                </div>
              );
            })}
          </div>
        ) : showWaveform ? (
          // AUDIO MODE — pro mirrored waveform: real ffmpeg data, centered axis,
          // gradient fill, peak indicators. No more flat bars.
          <div className="absolute inset-0 px-1 flex flex-col">
            {/* Center axis line */}
            <div className="absolute left-0 right-0 top-1/2 h-px bg-[rgba(245,239,224,0.06)]" />

            {/* Mirrored bars — top half + bottom half */}
            <div className="absolute inset-0 flex items-center gap-px px-1">
              {waveform.map((h, i) => {
                const t = (i / waveform.length) * duration;
                const inRange = t >= trimStart && t <= trimEnd;
                // Boost small values so the waveform is always visible
                const boosted = Math.max(0.04, Math.pow(h, 0.7));
                return (
                  <div
                    key={i}
                    className="flex-1 relative flex items-center justify-center"
                    style={{ height: "100%" }}
                  >
                    {/* Top half (going up from center) */}
                    <div
                      className="absolute bottom-1/2 w-full rounded-t-[1px]"
                      style={{
                        height: `${boosted * 50}%`,
                        background: inRange
                          ? "linear-gradient(180deg, #ff6b4a 0%, rgba(255, 107, 74, 0.5) 100%)"
                          : "rgba(245, 239, 224, 0.1)",
                      }}
                    />
                    {/* Bottom half (mirrored, going down from center) */}
                    <div
                      className="absolute top-1/2 w-full rounded-b-[1px]"
                      style={{
                        height: `${boosted * 50}%`,
                        background: inRange
                          ? "linear-gradient(0deg, #e8c547 0%, rgba(232, 197, 71, 0.4) 100%)"
                          : "rgba(245, 239, 224, 0.06)",
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* RMS / peak indicator dots at very loud moments (top 10%) */}
            <div className="absolute inset-0 pointer-events-none">
              {waveform.map((h, i) => {
                if (h < 0.6) return null;
                const t = (i / waveform.length) * duration;
                const inRange = t >= trimStart && t <= trimEnd;
                return (
                  <div
                    key={`peak-${i}`}
                    className="absolute top-1 w-1 h-1 rounded-full"
                    style={{
                      left: `${(i / waveform.length) * 100}%`,
                      background: inRange ? "#e8c547" : "rgba(232, 197, 71, 0.3)",
                      boxShadow: inRange ? "0 0 4px rgba(232, 197, 71, 0.8)" : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          // Fallback — no bundle yet, show empty state
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-wider text-warm">
            No media available
          </div>
        )}

        {/* Selected region overlay */}
        <div
          className="absolute top-0 bottom-0 border-x border-coral pointer-events-none"
          style={{
            left: pct(trimStart),
            width: `calc(${pct(trimEnd)} - ${pct(trimStart)})`,
            background: "rgba(255, 107, 74, 0.06)",
          }}
        />

        {/* Start handle */}
        <Handle side="start" time={trimStart} pct={pct(trimStart)} onPointerDown={() => setDragging("start")} />
        {/* End handle */}
        <Handle side="end" time={trimEnd} pct={pct(trimEnd)} onPointerDown={() => setDragging("end")} />

        {/* Playhead — amber, prominent */}
        <div
          className="absolute top-0 bottom-0 w-px bg-amber pointer-events-none z-20"
          style={{ left: pct(playhead), boxShadow: "0 0 8px rgba(232, 197, 71, 0.6)" }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rotate-45 bg-amber" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between border-t border-[rgba(245,239,224,0.06)] px-4 py-2.5">
        <div className="flex items-center gap-3 font-mono text-[10px] tabular-nums">
          <div>
            <span className="text-warm">IN </span>
            <span className="text-cream">{formatTime(trimStart)}</span>
          </div>
          <div className="w-px h-3 bg-[rgba(245,239,224,0.1)]" />
          <div>
            <span className="text-warm">OUT </span>
            <span className="text-cream">{formatTime(trimEnd)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setPlayhead(trimStart);
              if (audioRef.current) audioRef.current.currentTime = trimStart;
            }}
            className="grid h-7 w-7 place-items-center rounded text-warm hover:text-cream"
            aria-label="Skip to start"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              if (!bundle?.audioUrl) {
                // No audio available — just animate the playhead
                if (playhead >= trimEnd - 0.1) setPlayhead(trimStart);
                setPlaying((p) => !p);
                return;
              }
              if (playhead >= trimEnd - 0.1) {
                setPlayhead(trimStart);
                if (audioRef.current) audioRef.current.currentTime = trimStart;
              }
              setPlaying((p) => !p);
            }}
            className="grid h-8 w-8 place-items-center rounded-full bg-cream text-ink"
            aria-label={playing ? "Pause" : "Play"}
            disabled={preparing}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current translate-x-0.5" />}
          </button>
          <button
            onClick={() => {
              setPlayhead(trimEnd);
              if (audioRef.current) audioRef.current.currentTime = trimEnd;
            }}
            className="grid h-7 w-7 place-items-center rounded text-warm hover:text-cream"
            aria-label="Skip to end"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Audio status footer — only when audio is loading/ready */}
      {bundle?.audioUrl && (
        <div className="border-t border-[rgba(245,239,224,0.04)] px-4 py-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider">
          <span className="text-warm">
            {audioReady ? "Audio ready" : "Buffering audio…"}
          </span>
          <span className="text-warm">
            {formatTime(playhead)} <span className="text-coral">▸</span>
          </span>
        </div>
      )}
    </div>
  );
}

function Handle({
  side,
  time,
  pct,
  onPointerDown,
}: {
  side: "start" | "end";
  time: number;
  pct: string;
  onPointerDown: () => void;
}) {
  return (
    <motion.div
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown();
      }}
      whileTap={{ scale: 1.05 }}
      className="absolute top-0 bottom-0 z-30 flex w-5 -translate-x-1/2 cursor-ew-resize items-center justify-center"
      style={{ left: pct, touchAction: "none" }}
    >
      {/* Handle stem — full height, coral, prominent */}
      <div className="h-full w-1 bg-coral" style={{ boxShadow: "0 0 8px rgba(255, 107, 74, 0.6)" }} />
      {/* Grip — larger, easier to grab */}
      <div className="absolute top-1/2 -translate-y-1/2 h-10 w-4 rounded-sm bg-coral flex items-center justify-center shadow-lg">
        <div className="flex flex-col gap-0.5">
          <div className="h-2.5 w-px bg-ink/70" />
          <div className="h-2.5 w-px bg-ink/70" />
        </div>
      </div>
      {/* Time label — mono, below */}
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] tabular-nums text-coral bg-ink/80 px-1 rounded">
        {formatTime(time)}
      </div>
    </motion.div>
  );
}
