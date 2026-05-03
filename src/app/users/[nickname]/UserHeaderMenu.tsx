"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import UserAdminRefreshButton from "./UserAdminRefreshButton";
import type { ViewerMenuInfo } from "./UserDashboardTabs.types";

type UserHeaderMenuProps = {
  accountId?: string;
  viewedWkUsername?: string;
  viewerMenuInfo: ViewerMenuInfo | null;
};

function getInitials(name: string | null): string {
  if (!name) {
    return "??";
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return "??";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export default function UserHeaderMenu({ accountId, viewedWkUsername, viewerMenuInfo }: UserHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    try {
      return window.localStorage.getItem("wr:theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [jpFontMode, setJpFontMode] = useState<"sans" | "serif">(() => {
    if (typeof window === "undefined") {
      return "sans";
    }

    try {
      return window.localStorage.getItem("wr:jp-font") === "serif" ? "serif" : "sans";
    } catch {
      return "sans";
    }
  });
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  function toggleTheme() {
    const next = themeMode === "light" ? "dark" : "light";
    setThemeMode(next);
    try {
      window.localStorage.setItem("wr:theme", next);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
    document.documentElement.setAttribute("data-theme", next);
  }

  function toggleJpFont() {
    const next = jpFontMode === "sans" ? "serif" : "sans";
    setJpFontMode(next);
    try {
      window.localStorage.setItem("wr:jp-font", next);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
    document.documentElement.setAttribute("data-jp-font", next);
  }

  return (
    <div ref={menuRef} className="relative z-[120]">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open user menu"
        title="Menu"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full border border-line bg-surface text-lg font-bold text-foreground transition hover:bg-surface-muted"
      >
        ≡
      </button>

      {open ? (
        <aside className="absolute right-0 z-[130] mt-2 w-[min(88vw,300px)] rounded-2xl border border-line bg-surface p-3 shadow-[0_18px_40px_rgba(8,16,36,0.18)]">
          <div className="space-y-3">
            <section>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">Account</p>
              {viewerMenuInfo ? (
                <>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/60">
                    {viewerMenuInfo.provider === "google" ? "Signed in with Google" : "Invite session"}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface-muted text-[11px] font-black text-foreground">
                      {getInitials(viewerMenuInfo.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-foreground">{viewerMenuInfo.name}</p>
                      {viewerMenuInfo.email ? (
                        <p className="truncate text-xs text-foreground/70">{viewerMenuInfo.email}</p>
                      ) : null}
                    </div>
                  </div>
                  {viewerMenuInfo.wkUsername ? (
                    <p className="mt-1 text-xs text-foreground/70">@{viewerMenuInfo.wkUsername}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-sm font-semibold text-foreground/80">Not signed in</p>
              )}
            </section>

            <section className="border-t border-line pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/60">Navigation</p>
              <div className="mt-2 space-y-2">
                {viewedWkUsername ? (
                  <Link
                    href={`/users/${encodeURIComponent(viewedWkUsername)}/history`}
                    className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                  >
                    History
                  </Link>
                ) : null}
                <Link
                  href="/"
                  className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                >
                  Leaderboard
                </Link>
                <Link
                  href="/admin"
                  className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                >
                  Admin
                </Link>
                <Link
                  href="/admin/users"
                  className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                >
                  Manage users
                </Link>
                {viewerMenuInfo?.wkUsername ? (
                  <Link
                    href={`/users/${encodeURIComponent(viewerMenuInfo.wkUsername)}`}
                    className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                  >
                    Open my profile
                  </Link>
                ) : null}
              </div>
            </section>

            <section className="border-t border-line pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/60">Preferences</p>
              <div className="mt-2 space-y-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                >
                  Theme: {themeMode === "light" ? "Light" : "Dark"}
                </button>

                <button
                  type="button"
                  onClick={toggleJpFont}
                  className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                >
                  JP Font: {jpFontMode === "sans" ? "Sans" : "Serif"}
                </button>
              </div>
            </section>

            <section className="border-t border-line pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/60">Actions</p>
              <div className="mt-2 space-y-2">
                {accountId ? (
                  <UserAdminRefreshButton
                    accountId={accountId}
                    label="Refresh user"
                    ariaLabel="Refresh user"
                    showMessage={false}
                    buttonClassName="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                  />
                ) : null}

                {viewerMenuInfo?.provider === "google" ? (
                  <Link
                    href="/signout?callbackUrl=/"
                    className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                  >
                    Sign out
                  </Link>
                ) : viewerMenuInfo?.provider === "invite" ? (
                  <Link
                    href="/invite"
                    className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                  >
                    Manage invite
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                    >
                      Login with Google
                    </Link>
                    <Link
                      href="/invite"
                      className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
                    >
                      Use invite code
                    </Link>
                  </>
                )}
              </div>
            </section>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
