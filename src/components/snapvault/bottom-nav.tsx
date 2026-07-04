"use client";

import { motion } from "framer-motion";
import { VaultLogo } from "./logo";

export type Tab = "download" | "history" | "settings";

interface NavProps {
  tab: Tab;
  setTab: (t: Tab) => void;
  historyCount: number;
}

// Custom marks — not lucide stock icons
function VaultMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="5" y="5" width="6" height="6" fill="currentColor" />
    </svg>
  );
}
function ArchiveMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="2.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="7" width="12" height="2.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="11" width="12" height="2.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
function TuneMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4 L14 4 M2 8 L14 8 M2 12 L14 12" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="11" cy="4" r="1.5" fill="currentColor" />
      <circle cx="5" cy="8" r="1.5" fill="currentColor" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

const navItems: Array<{ id: Tab; label: string; icon: React.ReactNode; badge?: number }> = [
  { id: "download", label: "Vault", icon: <VaultMark /> },
  { id: "history", label: "Archive", icon: <ArchiveMark /> },
  { id: "settings", label: "Tune", icon: <TuneMark /> },
];

/**
 * Desktop sidebar navigation — fixed left, vertical, editorial.
 * Hidden on mobile (lg:flex, hidden by default).
 */
export function SideNav({ tab, setTab, historyCount }: NavProps) {
  const items = navItems.map((it) =>
    it.id === "history" ? { ...it, badge: historyCount } : it
  );

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col border-r border-[rgba(245,239,224,0.04)] bg-[#0b0a08] z-40">
      {/* Logo at top */}
      <div className="px-8 py-8 border-b border-[rgba(245,239,224,0.04)]">
        <VaultLogo size={28} withWordmark />
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-4 py-8 space-y-1">
        {items.map((it) => {
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className={`relative flex w-full items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                active
                  ? "text-cream"
                  : "text-warm hover:text-cream/70"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="side-nav-active"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-md bg-[rgba(255,107,74,0.08)] border border-[rgba(255,107,74,0.2)]"
                />
              )}
              <div
                className="relative"
                style={{ color: active ? "#ff6b4a" : undefined }}
              >
                {it.icon}
              </div>
              <span className="relative font-display text-[15px] font-medium tracking-tight">
                {it.label}
              </span>
              {it.badge && it.badge > 0 ? (
                <span className="relative ml-auto font-mono text-[10px] tabular-nums text-warm">
                  {it.badge > 99 ? "99+" : it.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Footer — colophon hint */}
      <div className="px-8 py-6 border-t border-[rgba(245,239,224,0.04)]">
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-warm leading-relaxed">
          A considered<br />downloader
        </div>
        <div className="mt-2 font-mono text-[9px] text-[#5a5448]">
          yt-dlp · ffmpeg · po-token
        </div>
      </div>
    </aside>
  );
}

/**
 * Mobile bottom navigation — pill-shaped, fixed bottom.
 * Hidden on desktop (lg:hidden).
 */
export function BottomNav({ tab, setTab, historyCount }: NavProps) {
  const items = navItems.map((it) =>
    it.id === "history" ? { ...it, badge: historyCount } : it
  );

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
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
