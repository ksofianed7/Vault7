"use client";

import { motion } from "framer-motion";

export type Tab = "download" | "history" | "settings";

interface BottomNavProps {
  tab: Tab;
  setTab: (t: Tab) => void;
  historyCount: number;
}

// Custom marks — not lucide stock icons
function VaultMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="5" y="5" width="6" height="6" fill="currentColor" />
    </svg>
  );
}
function ArchiveMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="2.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="7" width="12" height="2.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="11" width="12" height="2.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
function TuneMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 4 L14 4 M2 8 L14 8 M2 12 L14 12" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11" cy="4" r="1.5" fill="currentColor" />
      <circle cx="5" cy="8" r="1.5" fill="currentColor" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function BottomNav({ tab, setTab, historyCount }: BottomNavProps) {
  const items: Array<{ id: Tab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: "download", label: "Vault", icon: <VaultMark /> },
    { id: "history", label: "Archive", icon: <ArchiveMark />, badge: historyCount },
    { id: "settings", label: "Tune", icon: <TuneMark /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-md px-4 pb-3">
        <div className="surface-raised rounded-full px-2 py-1.5 flex items-center justify-between">
          {items.map((it) => {
            const active = tab === it.id;
            return (
              <button
                key={it.id}
                onClick={() => setTab(it.id)}
                className="relative flex flex-1 items-center justify-center gap-2 py-2 px-3"
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-full bg-[rgba(255,107,74,0.12)]"
                  />
                )}
                <motion.div
                  animate={{
                    color: active ? "#ff6b4a" : "#8a8474",
                  }}
                  className="relative"
                >
                  {it.icon}
                </motion.div>
                <motion.span
                  animate={{
                    color: active ? "#f5efe0" : "#8a8474",
                  }}
                  className="relative font-mono text-[10px] uppercase tracking-wider"
                >
                  {it.label}
                </motion.span>
                {it.badge && it.badge > 0 ? (
                  <span className="relative ml-0.5 font-mono text-[9px] tabular-nums text-warm">
                    {it.badge > 99 ? "99+" : it.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
