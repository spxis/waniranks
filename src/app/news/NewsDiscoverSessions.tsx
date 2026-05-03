"use client";

import NewsCacheBadge from "./NewsCacheBadge";
import type { DiscoverCacheSession } from "./newsClientCache";
import { hostnameOf } from "./newsReaderUtils";

type Props = {
  sessions: DiscoverCacheSession[];
  activeQueryUrl: string | null;
  loading: boolean;
  onOpen: (queryUrl: string) => void;
  onRefresh: (queryUrl: string) => void;
  onRemove: (queryUrl: string) => void;
  onClearAll: () => void;
};

export default function NewsDiscoverSessions({
  sessions,
  activeQueryUrl,
  loading,
  onOpen,
  onRefresh,
  onRemove,
  onClearAll,
}: Props) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-[1.75rem] border border-line/80 bg-surface/85 p-5 shadow-[0_18px_60px_-40px_rgba(15,111,255,0.4)]">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Scanned sites</p>
          <h2 className="text-base font-semibold text-foreground">Pick up where you left off</h2>
        </div>
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-full border border-line px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/70 hover:border-accent hover:text-accent"
        >
          Clear all
        </button>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {sessions.map((session) => {
          const active = activeQueryUrl === session.queryUrl;
          return (
            <li
              key={session.queryUrl}
              className={`rounded-2xl border p-3 ${
                active ? "border-accent/60 bg-accent/5" : "border-line/80 bg-surface-muted/70"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground" title={session.queryUrl}>
                    {hostnameOf(session.queryUrl)}
                  </p>
                  <NewsCacheBadge
                    cached
                    cachedAgeMs={session.cachedAgeMs}
                    fetchedAt={session.fetchedAt}
                    className="shrink-0"
                  />
                </div>
                <p className="line-clamp-1 text-[11px] text-foreground/55" title={session.queryUrl}>
                  {session.queryUrl}
                </p>
                <p className="text-[11px] font-semibold text-foreground/70">{session.links.length} links</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(session.queryUrl)}
                    disabled={loading}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/75 hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => onRefresh(session.queryUrl)}
                    disabled={loading}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/75 hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(session.queryUrl)}
                    disabled={loading}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/75 hover:border-hot hover:text-hot disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
