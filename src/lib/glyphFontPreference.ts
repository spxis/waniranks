"use client";

import { useCallback, useEffect, useState } from "react";

export type GlyphFontMode = "jpSans" | "jpSerif";

export const GLYPH_FONT_STORAGE_KEY = "wr:study-modal:glyph-font";
const GLOBAL_JP_FONT_STORAGE_KEY = "wr:jp-font";
const GLYPH_FONT_CHANGE_EVENT = "wr:glyph-font-change";

function normalizeGlyphFontMode(value: string | null | undefined): GlyphFontMode {
  return value === "jpSerif" ? "jpSerif" : "jpSans";
}

export function glyphFontFamily(mode: GlyphFontMode): string {
  return mode === "jpSerif"
    ? "var(--font-jp-serif), serif"
    : "var(--font-jp-sans), sans-serif";
}

function fontModeFromDom(): GlyphFontMode | null {
  if (typeof document === "undefined") {
    return null;
  }

  const attr = document.documentElement.getAttribute("data-jp-font");
  if (attr === "serif") {
    return "jpSerif";
  }
  if (attr === "sans") {
    return "jpSans";
  }

  return null;
}

function globalStorageToMode(value: string | null | undefined): GlyphFontMode {
  return value === "serif" ? "jpSerif" : "jpSans";
}

function modeToGlobalStorage(mode: GlyphFontMode): "sans" | "serif" {
  return mode === "jpSerif" ? "serif" : "sans";
}

export function setGlyphFontPreference(mode: GlyphFontMode): void {
  if (typeof window === "undefined") {
    return;
  }

  const globalMode = modeToGlobalStorage(mode);

  try {
    window.localStorage.setItem(GLOBAL_JP_FONT_STORAGE_KEY, globalMode);
    window.localStorage.setItem(GLYPH_FONT_STORAGE_KEY, mode);
  } catch {
    // Ignore persistence failures.
  }

  document.documentElement.setAttribute("data-jp-font", globalMode);

  window.dispatchEvent(new CustomEvent<GlyphFontMode>(GLYPH_FONT_CHANGE_EVENT, { detail: mode }));
}

export function useGlyphFontPreference() {
  const [mode, setMode] = useState<GlyphFontMode>(() => {
    if (typeof window === "undefined") {
      return "jpSans";
    }

    const domMode = fontModeFromDom();
    if (domMode) {
      return domMode;
    }

    try {
      const globalStored = window.localStorage.getItem(GLOBAL_JP_FONT_STORAGE_KEY);
      if (globalStored === "serif" || globalStored === "sans") {
        return globalStorageToMode(globalStored);
      }

      return normalizeGlyphFontMode(window.localStorage.getItem(GLYPH_FONT_STORAGE_KEY));
    } catch {
      return "jpSans";
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === GLOBAL_JP_FONT_STORAGE_KEY) {
        setMode(globalStorageToMode(event.newValue));
        return;
      }

      if (event.key !== GLYPH_FONT_STORAGE_KEY) {
        return;
      }

      setMode(normalizeGlyphFontMode(event.newValue));
    };

    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<GlyphFontMode>).detail;
      setMode(normalizeGlyphFontMode(detail));
    };

    const observer = new MutationObserver(() => {
      const domMode = fontModeFromDom();
      if (domMode) {
        setMode(domMode);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-jp-font"],
    });

    window.addEventListener("storage", onStorage);
    window.addEventListener(GLYPH_FONT_CHANGE_EVENT, onCustom);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(GLYPH_FONT_CHANGE_EVENT, onCustom);
    };
  }, []);

  const setPreference = useCallback((nextMode: GlyphFontMode) => {
    setMode(nextMode);
    setGlyphFontPreference(nextMode);
  }, []);

  const toggle = useCallback(() => {
    setPreference(mode === "jpSans" ? "jpSerif" : "jpSans");
  }, [mode, setPreference]);

  return {
    mode,
    fontFamily: glyphFontFamily(mode),
    setPreference,
    toggle,
  };
}
