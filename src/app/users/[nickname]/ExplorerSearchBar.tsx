"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

export default function ExplorerSearchBar() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [srStatus, setSrStatus] = useState("");
  const activeRequestIdRef = useRef<string | null>(null);
  const submitLockedRef = useRef(false);
  const throttleUntilRef = useRef(0);
  const clearIndicatorTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onComplete = (event: Event) => {
      const custom = event as CustomEvent<{ requestId?: string; ok?: boolean; message?: string }>;
      const requestId = custom.detail?.requestId ?? null;
      if (!requestId || requestId !== activeRequestIdRef.current) {
        return;
      }

      activeRequestIdRef.current = null;
      submitLockedRef.current = false;
      setIsSearching(false);
      setSearchState(custom.detail?.ok ? "done" : "error");
      setSrStatus(custom.detail?.ok ? "Search complete." : custom.detail?.message ?? "No matches found.");

      if (clearIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(clearIndicatorTimeoutRef.current);
      }
      clearIndicatorTimeoutRef.current = window.setTimeout(() => {
        setSearchState("idle");
      }, 1200);
    };

    window.addEventListener("wr:explorer-search-complete", onComplete as EventListener);
    return () => {
      window.removeEventListener("wr:explorer-search-complete", onComplete as EventListener);
      if (clearIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(clearIndicatorTimeoutRef.current);
      }
    };
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (typeof window === "undefined") {
      return;
    }

    const trimmed = query.trim();
    const now = Date.now();
    if (!trimmed || submitLockedRef.current || now < throttleUntilRef.current) {
      return;
    }

    submitLockedRef.current = true;
    throttleUntilRef.current = now + 800;

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    activeRequestIdRef.current = requestId;
    setIsSearching(true);
    setSearchState("searching");
    setSrStatus("Searching...");

    const params = new URLSearchParams(window.location.search);
    params.set("find", trimmed);

    const next = `${window.location.pathname}?${params.toString()}#explorer`;
    window.history.pushState(null, "", next);

    window.dispatchEvent(
      new CustomEvent("wr:explorer-search", {
        detail: { query: trimmed, requestId },
      }),
    );
  }

  return (
    <form onSubmit={submitSearch} className="w-full" aria-busy={isSearching}>
      <div className="flex w-full items-center gap-2 rounded-full border border-line bg-surface px-2 py-1">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search kanji, hiragana, or romaji"
          className="h-9 min-w-0 flex-1 rounded-full bg-transparent px-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-500"
          aria-label="Search level explorer"
          disabled={isSearching}
        />
        <button
          type="submit"
          disabled={isSearching || submitLockedRef.current || !query.trim()}
          className="inline-flex h-9 items-center rounded-full border border-accent bg-accent px-4 text-xs font-bold uppercase tracking-[0.08em] text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSearching ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/80 border-t-transparent"
                aria-hidden="true"
              />
              Searching
            </span>
          ) : (
            "Search"
          )}
        </button>
        <span
          className="inline-flex h-7 w-7 items-center justify-center"
          role="status"
          aria-live="polite"
          aria-label={
            searchState === "searching"
              ? "Searching"
              : searchState === "done"
                ? "Search complete"
                : searchState === "error"
                  ? "Search failed"
                  : "Search idle"
          }
        >
          {searchState === "searching" ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/70 border-t-transparent" />
          ) : null}
          {searchState === "done" ? (
            <span className="inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
          ) : null}
          {searchState === "error" ? (
            <span className="inline-flex h-3.5 w-3.5 rounded-full bg-red-500" />
          ) : null}
        </span>
      </div>
      <span className="sr-only" aria-live="polite">
        {srStatus}
      </span>
    </form>
  );
}
