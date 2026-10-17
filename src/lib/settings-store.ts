"use client";

import { create } from "zustand";
import type { Settings } from "./types";

interface SettingsState {
  settings: Settings | null;
  loaded: boolean;
  load: () => Promise<void>;
  setSettings: (s: Settings) => void;
}

/** Magasin partagé des paramètres société (shell, login, factures PDF). */
export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loaded: false,
  load: async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        set({ settings: (await res.json()) as Settings, loaded: true });
        return;
      }
    } catch {
      /* silencieux */
    }
    set({ loaded: true });
  },
  setSettings: (settings) => set({ settings }),
}));
