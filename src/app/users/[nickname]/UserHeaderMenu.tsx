"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import UserAdminRefreshButton from "./UserAdminRefreshButton";
import type { ViewerMenuInfo } from "./UserDashboardTabs.types";

type UserHeaderMenuProps = {
  accountId: string;
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

export default function UserHeaderMenu({ accountId, viewerMenuInfo }: UserHeaderMenuProps) {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={menuRef} className="relative">
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
        <aside className="absolute right-0 mt-2 w-[min(88vw,300px)] rounded-2xl border border-line bg-surface p-3 shadow-[0_18px_40px_rgba(8,16,36,0.18)]">
          {viewerMenuInfo ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
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
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">Account</p>
              <p className="mt-1 text-sm font-semibold text-foreground/80">Not signed in</p>
            </>
          )}

          <div className="mt-3 space-y-2">
            <UserAdminRefreshButton
              accountId={accountId}
              label="Refresh user"
              ariaLabel="Refresh user"
              showMessage={false}
              buttonClassName="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
            />

            {viewerMenuInfo?.wkUsername ? (
              <Link
                href={`/users/${encodeURIComponent(viewerMenuInfo.wkUsername)}`}
                className="inline-flex h-9 w-full items-center justify-center rounded-full border border-line bg-surface-muted px-3 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface"
              >
                Open my profile
              </Link>
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
        </aside>
      ) : null}
    </div>
  );
}
