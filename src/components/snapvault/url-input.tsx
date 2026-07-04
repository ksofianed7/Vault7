"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CornerDownLeft } from "lucide-react";
import { detectPlatform, isValidUrl } from "@/lib/platform";
import { PlatformBadge } from "./platform-badge";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  loading?: boolean;
  initialValue?: string;
}

export function UrlInput({ onSubmit, loading, initialValue }: UrlInputProps) {
  const [value, setValue] = useState(initialValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const info = detectPlatform(value);
  const valid = isValidUrl(value) && info.platform !== "unknown";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || loading) return;
    onSubmit(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        onClick={() => inputRef.current?.focus()}
        className="group surface-inset relative flex items-center gap-3 rounded-lg px-4 py-4 transition-all"
        style={{
          boxShadow: valid
            ? "0 0 0 1px rgba(255, 107, 74, 0.4), 0 0 24px -8px rgba(255, 107, 74, 0.4)"
            : "0 0 0 1px rgba(245, 239, 224, 0.06)",
        }}
      >
        {/* Prompt symbol — terminal feel */}
        <span className="font-mono text-[14px] text-coral select-none">/</span>

        <input
          ref={inputRef}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="paste a link to begin"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 bg-transparent font-mono text-[13px] text-cream placeholder:text-[#5a5448] outline-none"
        />

        {/* Submit arrow — appears when valid */}
        <AnimatePresence>
          {valid && !loading && (
            <motion.button
              type="submit"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileTap={{ scale: 0.92 }}
              className="grid h-7 w-7 place-items-center rounded-md bg-coral text-ink"
            >
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Status row — minimalist metadata */}
      <div className="mt-2 flex min-h-[16px] items-center justify-between px-1">
        <AnimatePresence mode="wait">
          {value && info.platform !== "unknown" ? (
            <motion.div
              key="badge"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <PlatformBadge platform={info.platform} />
              <span className="font-mono text-[9px] uppercase tracking-wider text-warm">
                detected
              </span>
            </motion.div>
          ) : value ? (
            <motion.span
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-mono text-[9px] uppercase tracking-wider text-[#a8856a]"
            >
              unsupported source
            </motion.span>
          ) : (
            <motion.span
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-warm"
            >
              <CornerDownLeft className="h-2.5 w-2.5" />
              youtube · instagram · tiktok · pinterest
            </motion.span>
          )}
        </AnimatePresence>

        {loading && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-mono text-[9px] uppercase tracking-wider text-coral"
          >
            fetching…
          </motion.span>
        )}
      </div>
    </form>
  );
}
