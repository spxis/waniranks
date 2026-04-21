"use client";

import { useCallback, useEffect, useState } from "react";

export type GlyphFontMode = "jpSans" | "jpSerif";

export const GLYPH_FONT_STORAGE_KEY = "wr:study-modal:glyph-font";
const GLYPH_FONT_CHANGE_EVENT = "wr:glyph-font-change";

function normalizeGlyphFontMode(value: string | null | undefined): GlyphFontMode {
  return value === "jpSerif" ? "jpSerif" : "jpSans";
}

export function glyphFontFamily(mode: GlyphFontMode): string {
  return mode === "jpSerif"
    ? '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif'
    : '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif';
}

export function setGlyphFontPreference(mode: GlyphFontMode): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(GLYPH_FONT_STORAGE_KEY, mode);
  } catch {
    // Ignore persistence failures.
  }

  window.dispatchEvent(new CustomEvent<GlyphFontMode>(GLYPH_FONT_CHANGE_EVENT, { detail: mode }));
}

export function useGlyphFontPreference() {
  const [mode, setMode] = useState<GlyphFontMode>(() => {
    if (typeof window === "undefined") {
      return "jpSans";
    }

    try {
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
      if (event.key !== GLYPH_FONT_STORAGE_KEY) {
        return;
      }

      setMode(normalizeGlyphFontMode(event.newValue));
    };

    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<GlyphFontMode>).detail;
      setMode(normalizeGlyphFontMode(detail));
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(GLYPH_FONT_CHANGE_EVENT, onCustom);

    return () => {
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
