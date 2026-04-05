"use client";

import { useEffect, useState } from "react";

const JP_FONT_STORAGE_KEY = "wr:jp-font";
const THEME_STORAGE_KEY = "wr:theme";

type JpFontMode = "sans" | "serif";
type ThemeMode = "light" | "dark";

export default function AppFooter() {
  const [jpFontMode, setJpFontMode] = useState<JpFontMode>("sans");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(JP_FONT_STORAGE_KEY);
      const mode: JpFontMode = stored === "serif" ? "serif" : "sans";
      setJpFontMode(mode);
      document.documentElement.setAttribute("data-jp-font", mode);
    } catch {
      document.documentElement.setAttribute("data-jp-font", "sans");
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      const mode: ThemeMode = stored === "dark" ? "dark" : "light";
      setThemeMode(mode);
      document.documentElement.setAttribute("data-theme", mode);
    } catch {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  function toggleJapaneseFont() {
    const next: JpFontMode = jpFontMode === "sans" ? "serif" : "sans";
    setJpFontMode(next);

    try {
      window.localStorage.setItem(JP_FONT_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }

    document.documentElement.setAttribute("data-jp-font", next);
  }

  function toggleTheme() {
    const next: ThemeMode = themeMode === "light" ? "dark" : "light";
    setThemeMode(next);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }

    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <footer className="mt-8 border-t border-line/70 bg-surface/70 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-foreground/85">WaniRanks. Built for steady daily progress.</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/60">Theme</span>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground"
          >
            {themeMode === "light" ? "Dark" : "Light"}
          </button>
          <span className="ml-2 text-xs font-bold uppercase tracking-[0.08em] text-foreground/60">JP Font</span>
          <button
            type="button"
            onClick={toggleJapaneseFont}
            className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground"
          >
            {jpFontMode === "sans" ? "Sans" : "Serif"}
          </button>
        </div>
      </div>
    </footer>
  );
}
