"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type CardData = {
  source: "oauth" | "invite";
  nickname: string;
  wkUsername: string;
  email: string | null;
};

type TopRightUserMenuProps = {
  card: CardData;
};

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "U";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export default function TopRightUserMenu({ card }: TopRightUserMenuProps) {
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
    <div ref={menuRef} className="fixed right-3 top-3 z-50">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open account menu"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface/90 px-2.5 text-xs font-bold uppercase tracking-[0.12em] text-foreground shadow-[0_8px_20px_rgba(8,16,36,0.12)] backdrop-blur transition hover:bg-surface-muted"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface-muted text-[10px] font-black text-foreground">
          {getInitials(card.nickname)}
        </span>
        <span className="hidden sm:inline">Account</span>
      </button>

      {open ? (
        <aside className="mt-2 w-[min(88vw,300px)] rounded-2xl border border-line bg-surface/95 p-3 shadow-[0_18px_40px_rgba(8,16,36,0.18)] backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
            {card.source === "oauth" ? "Signed in" : "Invite session"}
          </p>
          <p className="mt-1 truncate text-sm font-black text-foreground">{card.nickname}</p>
          <p className="truncate text-xs text-foreground/70">
            {card.wkUsername ? `@${card.wkUsername}` : card.email ?? ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {card.wkUsername ? (
              <Link
                href={`/users/${encodeURIComponent(card.wkUsername)}`}
                className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-surface px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface-muted"
              >
                Open profile
              </Link>
            ) : null}
            {card.source === "oauth" ? (
              <Link
                href="/signout?callbackUrl=/"
                className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-surface px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface-muted"
              >
                Sign out
              </Link>
            ) : (
              <Link
                href="/invite"
                className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-surface px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface-muted"
              >
                Manage invite
              </Link>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
