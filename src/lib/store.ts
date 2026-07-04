"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VideoMeta, QualityOption, Platform, MediaBundle } from "@/lib/platform";

export type DownloadFormat = "video" | "audio";
export type DownloadStatus = "queued" | "fetching" | "downloading" | "processing" | "completed" | "failed";

export interface DownloadItem {
  id: string;
  url: string;
  platform: Platform;
  title: string;
  author: string;
  thumbnail: string;
  duration: number;
  format: DownloadFormat;
  quality: string;
  ext: string;
  trimStart: number;
  trimEnd: number;
  progress: number;
  status: DownloadStatus;
  fileSize?: string;
  error?: string;
  createdAt: number;
}

export interface HistoryItem {
  id: string;
  url: string;
  platform: Platform;
  title: string;
  author: string;
  thumbnail: string;
  duration: number;
  format: DownloadFormat;
  quality: string;
  trimStart?: number;
  trimEnd?: number;
  fileSize?: string;
  createdAt: number;
}

interface Settings {
  defaultFormat: DownloadFormat;
  defaultQuality: string;
  autoTrim: boolean;
  saveHistory: boolean;
  hapticFeedback: boolean;
  filenameTemplate: string; // e.g. "{title} - {author}"
}

interface SnapVaultState {
  // Current media being inspected (after URL paste + fetch)
  currentMedia: VideoMeta | null;
  // Real media bundle for trim preview (storyboard + waveform + audio)
  mediaBundle: MediaBundle | null;
  isFetching: boolean;
  isPreparingMedia: boolean;
  fetchError: string | null;

  // Active download queue
  downloads: DownloadItem[];

  // History
  history: HistoryItem[];

  // Settings
  settings: Settings;

  // Actions
  setCurrentMedia: (m: VideoMeta | null) => void;
  setMediaBundle: (b: MediaBundle | null) => void;
  setFetching: (b: boolean) => void;
  setPreparingMedia: (b: boolean) => void;
  setFetchError: (e: string | null) => void;

  addDownload: (d: DownloadItem) => void;
  updateDownload: (id: string, patch: Partial<DownloadItem>) => void;
  removeDownload: (id: string) => void;

  addHistory: (h: HistoryItem) => void;
  clearHistory: () => void;
  removeHistory: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
}

export const useSnapVault = create<SnapVaultState>()(
  persist(
    (set) => ({
      currentMedia: null,
      mediaBundle: null,
      isFetching: false,
      isPreparingMedia: false,
      fetchError: null,
      downloads: [],
      history: [],
      settings: {
        defaultFormat: "video",
        defaultQuality: "1080p",
        autoTrim: false,
        saveHistory: true,
        hapticFeedback: true,
        filenameTemplate: "{title}",
      },

      setCurrentMedia: (m) => set({ currentMedia: m, fetchError: null }),
      setMediaBundle: (b) => set({ mediaBundle: b }),
      setFetching: (b) => set({ isFetching: b }),
      setPreparingMedia: (b) => set({ isPreparingMedia: b }),
      setFetchError: (e) => set({ fetchError: e }),

      addDownload: (d) =>
        set((s) => ({ downloads: [d, ...s.downloads].slice(0, 50) })),
      updateDownload: (id, patch) =>
        set((s) => ({
          downloads: s.downloads.map((d) =>
            d.id === id ? { ...d, ...patch } : d
          ),
        })),
      removeDownload: (id) =>
        set((s) => ({ downloads: s.downloads.filter((d) => d.id !== id) })),

      addHistory: (h) =>
        set((s) => ({
          history: [h, ...s.history.filter((x) => x.id !== h.id)].slice(0, 200),
        })),
      clearHistory: () => set({ history: [] }),
      removeHistory: (id) =>
        set((s) => ({ history: s.history.filter((h) => h.id !== id) })),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: "snapvault-store",
      partialize: (s) => ({
        history: s.history,
        settings: s.settings,
      }),
    }
  )
);

export function uid(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
