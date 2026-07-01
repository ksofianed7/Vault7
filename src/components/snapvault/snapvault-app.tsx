"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSnapVault } from "@/lib/store";
import { VaultLogo } from "./logo";
import { DownloadScreen } from "./download-screen";
import { HistoryScreen } from "./history-screen";
import { SettingsScreen } from "./settings-screen";
import { SideNav, BottomNav, type Tab } from "./bottom-nav";

export function VaultApp() {
  const [tab, setTab] = useState<Tab>("download");
  const historyCount = useSnapVault((s) => s.history.length);

  return (
    <div className="relative min-h-screen">
      {/* Desktop: fixed sidebar nav (hidden on mobile) */}
      <SideNav tab={tab} setTab={setTab} historyCount={historyCount} />

      {/* Mobile: bottom nav (hidden on desktop) */}
      <BottomNav tab={tab} setTab={setTab} historyCount={historyCount} />

      {/* Main content — offset for sidebar on desktop, full width on mobile */}
      <div className="lg:pl-64">
        {/* Desktop top bar (hidden on mobile — mobile has its own header) */}
        <header className="hidden lg:flex sticky top-0 z-40 items-center justify-between px-12 py-5 border-b border-[rgba(245,239,224,0.04)] bg-[#0e0d0b]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-coral">
              № 01
            </span>
            <span className="h-px w-8 bg-[rgba(245,239,224,0.1)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-warm">
              The Vault — A considered downloader
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-coral animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-warm">
              v.05 · ready
            </span>
          </div>
        </header>

        {/* Screens — centered with max width, generous padding on desktop */}
        <div className="mx-auto max-w-md px-5 pb-32 pt-8 lg:max-w-2xl lg:px-12 lg:pb-12 lg:pt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.2, 0.9, 0.3, 1] }}
            >
              {tab === "download" && <DownloadScreen />}
              {tab === "history" && <HistoryScreen />}
              {tab === "settings" && <SettingsScreen />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
