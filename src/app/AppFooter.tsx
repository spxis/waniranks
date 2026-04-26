"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const JP_FONT_STORAGE_KEY = "wr:jp-font";
const THEME_STORAGE_KEY = "wr:theme";

type JpFontMode = "sans" | "serif";
type ThemeMode = "light" | "dark";

export default function AppFooter() {
  const [jpFontMode, setJpFontMode] = useState<JpFontMode>(() => {
    if (typeof window === "undefined") {
      return "sans";
    }

    try {
      return window.localStorage.getItem(JP_FONT_STORAGE_KEY) === "serif" ? "serif" : "sans";
    } catch {
      return "sans";
    }
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [googleSignedIn, setGoogleSignedIn] = useState(false);
  const [inviteSignedIn, setInviteSignedIn] = useState(false);

  const isLoggedIn = googleSignedIn || inviteSignedIn;

  useEffect(() => {
    document.documentElement.setAttribute("data-jp-font", jpFontMode);
  }, [jpFontMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    let mounted = true;

    async function loadSessionState() {
      try {
        const [googleResponse, inviteResponse] = await Promise.all([
          fetch("/api/auth/session", { cache: "no-store" }),
          fetch("/api/invite/session", { cache: "no-store" }),
        ]);

        const googlePayload = (await googleResponse.json()) as { user?: unknown };
        const invitePayload = (await inviteResponse.json()) as { signedIn?: boolean };

        if (!mounted) {
          return;
        }

        setGoogleSignedIn(Boolean(googlePayload.user));
        setInviteSignedIn(Boolean(invitePayload.signedIn));
      } catch {
        if (!mounted) {
          return;
        }

        setGoogleSignedIn(false);
        setInviteSignedIn(false);
      }
    }

    void loadSessionState();
    window.addEventListener("focus", loadSessionState);

    return () => {
      mounted = false;
      window.removeEventListener("focus", loadSessionState);
    };
  }, []);

  async function handleLogout() {
    try {
      if (inviteSignedIn) {
        await fetch("/api/invite/session", { method: "DELETE" });
      }
    } catch {
      // Continue to signout route even if invite-session cleanup fails.
    }

    if (googleSignedIn) {
      window.location.href = "/signout?callbackUrl=/";
      return;
    }

    window.location.href = "/";
  }

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
    <footer className="relative z-20 mt-8 border-t border-line/70 bg-surface/70 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-foreground/85">UmaKuma. Built for steady daily progress.</p>
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
          <a
            href="/admin"
            className="ml-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80"
          >
            Admin
          </a>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => {
                void handleLogout();
              }}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80"
            >
              Logout
            </button>
          ) : (
            <a
              href="/login"
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80"
            >
              Login
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
