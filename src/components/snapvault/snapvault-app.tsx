"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSnapVault } from "@/lib/store";
import { VaultLogo } from "./logo";
import { DownloadScreen } from "./download-screen";
import { HistoryScreen } from "./history-screen";
import { SettingsScreen } from "./settings-screen";
import { BottomNav, type Tab } from "./bottom-nav";

export function VaultApp() {
  const [tab, setTab] = useState<Tab>("download");
  const historyCount = useSnapVault((s) => s.history.length);

  return (
    <div className="relative mx-auto min-h-screen max-w-md px-5 pb-32 pt-8">
      {/* Top bar — minimal, editorial */}
      <header className="mb-10 flex items-center justify-between">
        <VaultLogo size={24} withWordmark />
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-coral animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-warm">
            v.01 · ready
          </span>
        </div>
      </header>

      {/* Screens */}
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

      <BottomNav tab={tab} setTab={setTab} historyCount={historyCount} />
    </div>
  );
}
