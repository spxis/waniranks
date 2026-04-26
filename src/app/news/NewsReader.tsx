"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DiscoveredLink, DiscoverPayload } from "@/lib/news/newsDiscover";
import type { NewsArticle } from "@/lib/news/newsTypes";

import NewsArticleView from "./NewsArticleView";
import NewsHistoryPanel from "./NewsHistoryPanel";
import NewsKanjiHistoryPanel from "./NewsKanjiHistoryPanel";
import NewsSiteLinks from "./NewsSiteLinks";
import NewsStatsClient from "./stats/NewsStatsClient";
import {
  clearNewsHistory,
  readNewsHistory,
  recordNewsView,
  removeNewsView,
  type NewsHistoryEntry,
} from "./newsHistory";
import { openNewsGlyphRun } from "./newsGlyphRunner";
import {
  NEWS_KANJI_HISTORY_EVENT,
  clearNewsKanjiHistory,
  readNewsKanjiHistory,
  removeNewsKanjiHistory,
  type NewsKanjiHistoryEntry,
} from "./newsKanjiHistory";
import {
  readArticleCache,
  readDiscoverCache,
  writeArticleCache,
  writeDiscoverCache,
} from "./newsClientCache";

type Mode = "article" | "site";
type ReaderTab = "article" | "history" | "stats";

type DiscoverState = {
  baseUrl: string | null;
  links: DiscoveredLink[];
  cached: boolean;
  cachedAgeMs?: number;
  fetchedAt?: string;
};

const EMPTY_DISCOVER: DiscoverState = {
  baseUrl: null,
  links: [],
  cached: false,
};

type Props = {
  devSampleUrls?: string[];
};

export default function NewsReader({ devSampleUrls = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialUrlParam = searchParams.get("url") ?? "";

  const [mode, setMode] = useState<Mode>("article");
  const [activeTab, setActiveTab] = useState<ReaderTab>("article");
  const [url, setUrl] = useState(initialUrlParam);
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<NewsHistoryEntry[]>([]);
  const [kanjiHistory, setKanjiHistory] = useState<NewsKanjiHistoryEntry[]>([]);
  const [discover, setDiscover] = useState<DiscoverState>(EMPTY_DISCOVER);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const lastFetchedUrl = useRef<string | null>(null);

  useEffect(() => {
    setHistory(readNewsHistory());
  }, []);

  useEffect(() => {
    const refresh = () => {
      setKanjiHistory(readNewsKanjiHistory());
    };
    refresh();
    window.addEventListener(NEWS_KANJI_HISTORY_EVENT, refresh);
    return () => {
      window.removeEventListener(NEWS_KANJI_HISTORY_EVENT, refresh);
    };
  }, []);

  const fetchArticle = useCallback(
    async (target: string) => {
      const trimmed = target.trim();
      if (!trimmed) {
        return;
      }

      lastFetchedUrl.current = trimmed;
      setLoading(true);
      setError(null);
      setArticle(null);
      setDiscover(EMPTY_DISCOVER);
      setDiscoverError(null);

      const cached = readArticleCache(trimmed);
      if (cached) {
        setArticle(cached);
        setHistory(
          recordNewsView({
            url: trimmed,
            title: cached.title,
            siteName: cached.siteName,
          }),
        );
        const nextUrl = `/news?url=${encodeURIComponent(trimmed)}`;
        if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
          router.replace(nextUrl, { scroll: false });
        }
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/news/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { article?: NewsArticle; error?: string }
          | null;

        if (!response.ok || !payload?.article) {
          setError(payload?.error ?? "Couldn't read that article.");
          return;
        }

        setArticle(payload.article);
        writeArticleCache(trimmed, payload.article);
        setHistory(
          recordNewsView({
            url: trimmed,
            title: payload.article.title,
            siteName: payload.article.siteName,
          }),
        );
        const next = `/news?url=${encodeURIComponent(trimmed)}`;
        if (`${window.location.pathname}${window.location.search}` !== next) {
          router.replace(next, { scroll: false });
        }
      } catch {
        setError("Network problem — try again.");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  const fetchDiscover = useCallback(async (target: string) => {
    const trimmed = target.trim();
    if (!trimmed) {
      return;
    }

    setDiscoverLoading(true);
    setDiscoverError(null);
    setDiscover(EMPTY_DISCOVER);
    setArticle(null);
    setError(null);

    const cached = readDiscoverCache(trimmed);
    if (cached) {
      setDiscover({
        baseUrl: cached.baseUrl,
        links: cached.links,
        cached: true,
        cachedAgeMs: cached.cachedAgeMs,
        fetchedAt: cached.fetchedAt,
      });
      setDiscoverLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/news/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (DiscoverPayload & { error?: string })
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("links" in payload) || !payload.links) {
        setDiscoverError((payload as { error?: string } | null)?.error ?? "Couldn't scan that page.");
        return;
      }

      const data = payload as DiscoverPayload;
      writeDiscoverCache(trimmed, data.baseUrl, data.links);
      setDiscover({
        baseUrl: data.baseUrl,
        links: data.links,
        cached: false,
        fetchedAt: data.fetchedAt,
      });
    } catch {
      setDiscoverError("Network problem — try again.");
    } finally {
      setDiscoverLoading(false);
    }
  }, []);

  useEffect(() => {
    const param = searchParams.get("url") ?? "";
    if (!param || param === lastFetchedUrl.current) {
      return;
    }
    setUrl(param);
    setMode("article");
    void fetchArticle(param);
  }, [searchParams, fetchArticle]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "site") {
      await fetchDiscover(url);
    } else {
      await fetchArticle(url);
    }
  }

  function handleSelectHistory(target: string) {
    setUrl(target);
    setMode("article");
    setActiveTab("article");
    void fetchArticle(target);
  }

  function handleRemoveHistory(target: string) {
    setHistory(removeNewsView(target));
  }

  function handleClearHistory() {
    clearNewsHistory();
    setHistory([]);
  }

  function handleSelectDiscovered(target: string) {
    setUrl(target);
    setMode("article");
    setActiveTab("article");
    void fetchArticle(target);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="news-url"
            className="block text-xs font-bold uppercase tracking-[0.14em] text-foreground/70"
          >
            {mode === "site" ? "Section / homepage URL" : "Article URL"}
          </label>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="news-url"
            type="url"
            inputMode="url"
            placeholder="https://..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="h-11 flex-1 rounded-full border border-line bg-surface px-5 text-sm text-foreground placeholder:text-foreground/40 focus:border-accent focus:outline-none"
            required
          />
          <button
            type="submit"
            disabled={(loading || discoverLoading) || !url.trim()}
            className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-accent px-6 text-sm font-bold uppercase tracking-[0.14em] text-surface transition hover:bg-accent-2 disabled:opacity-50"
          >
            {mode === "site"
              ? discoverLoading
                ? "Scanning…"
                : "Find articles"
              : loading
                ? "Reading…"
                : "Read"}
          </button>
        </div>
        <p className="text-xs text-foreground/60">
          You provide the link, so you take responsibility for the source. Articles you read are cached locally in your browser to avoid re-fetching the same page.
        </p>
        {devSampleUrls.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/55">
              Dev samples
            </span>
            {devSampleUrls.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setUrl(sample)}
                className="rounded-full border border-line bg-surface-muted px-3 py-1 text-[11px] font-semibold text-foreground/80 transition hover:border-accent hover:text-accent"
              >
                {hostnameOf(sample)}
              </button>
            ))}
          </div>
        ) : null}
      </form>

      {loading ? <LoadingState label="Fetching the article…" /> : null}
      <ReaderTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        articleCount={article ? 1 : 0}
        historyCount={history.length}
        statsCount={kanjiHistory.length}
      />

      {activeTab === "article" ? (
        <>
          {error ? <ErrorState message={error} /> : null}
          {article && !loading ? <NewsArticleView article={article} /> : null}

          {(discover.links.length > 0 || discoverLoading || discoverError) && !article ? (
            <NewsSiteLinks
              baseUrl={discover.baseUrl}
              links={discover.links}
              cached={discover.cached}
              cachedAgeMs={discover.cachedAgeMs}
              fetchedAt={discover.fetchedAt}
              loading={discoverLoading}
              error={discoverError}
              onSelect={handleSelectDiscovered}
              onDismiss={() => {
                setDiscover(EMPTY_DISCOVER);
                setDiscoverError(null);
              }}
            />
          ) : null}
        </>
      ) : null}

      {activeTab === "history" ? (
        <div className="space-y-6">
          <NewsHistoryPanel
            entries={history}
            activeUrl={article ? lastFetchedUrl.current : null}
            onSelect={handleSelectHistory}
            onRemove={handleRemoveHistory}
            onClear={handleClearHistory}
          />

          <NewsKanjiHistoryPanel
            entries={kanjiHistory}
            onSelect={(run) => {
              void openNewsGlyphRun(run);
            }}
            onRemove={(run) => {
              setKanjiHistory(removeNewsKanjiHistory(run));
            }}
            onClear={() => {
              clearNewsKanjiHistory();
              setKanjiHistory([]);
            }}
          />
        </div>
      ) : null}

      {activeTab === "stats" ? <NewsStatsClient /> : null}
    </div>
  );
}

function ReaderTabs({
  activeTab,
  onChange,
  articleCount,
  historyCount,
  statsCount,
}: {
  activeTab: ReaderTab;
  onChange: (next: ReaderTab) => void;
  articleCount: number;
  historyCount: number;
  statsCount: number;
}) {
  return (
    <div className="inline-flex flex-wrap overflow-hidden rounded-full border border-line bg-surface-muted text-[11px] font-bold uppercase tracking-[0.12em]">
      <button
        type="button"
        onClick={() => onChange("article")}
        className={`inline-flex items-center gap-1 px-3 py-1 ${activeTab === "article" ? "bg-accent text-surface" : "text-foreground/70"}`}
      >
        <span>Article</span>
        <span className="text-[10px] opacity-85">{articleCount}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("history")}
        className={`inline-flex items-center gap-1 px-3 py-1 ${activeTab === "history" ? "bg-accent text-surface" : "text-foreground/70"}`}
      >
        <span>History</span>
        <span className="text-[10px] opacity-85">{historyCount}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("stats")}
        className={`inline-flex items-center gap-1 px-3 py-1 ${activeTab === "stats" ? "bg-accent text-surface" : "text-foreground/70"}`}
      >
        <span>Stats</span>
        <span className="text-[10px] opacity-85">{statsCount}</span>
      </button>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (next: Mode) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-line bg-surface text-[11px] font-bold uppercase tracking-[0.14em]">
      <button
        type="button"
        onClick={() => onChange("article")}
        className={`px-3 py-1 transition ${mode === "article" ? "bg-accent text-surface" : "text-foreground/70 hover:text-accent"}`}
      >
        Article
      </button>
      <button
        type="button"
        onClick={() => onChange("site")}
        className={`px-3 py-1 transition ${mode === "site" ? "bg-accent text-surface" : "text-foreground/70 hover:text-accent"}`}
      >
        Site
      </button>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-6 text-center text-sm font-semibold uppercase tracking-[0.14em] text-foreground/60">
      {label}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-hot/60 bg-hot/10 p-4 text-sm text-foreground">
      {message}
    </div>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
