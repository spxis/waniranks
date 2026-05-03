"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoveredLink, DiscoverPayload } from "@/lib/news/newsDiscover";
import type { NewsArticle } from "@/lib/news/newsTypes";
import { getStoredEnum, setStoredEnum } from "@/lib/clientStorage";
import NewsArticleView from "./NewsArticleView";
import type { ArticlePanelTab } from "./NewsArticleView";
import NewsDiscoverSessions from "./NewsDiscoverSessions";
import NewsReaderForm from "./NewsReaderForm";
import NewsHistoryPanel from "./NewsHistoryPanel";
import NewsKanjiHistoryPanel from "./NewsKanjiHistoryPanel";
import { NewsReaderErrorState, NewsReaderLoadingState } from "./NewsReaderStatus";
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
  clearDiscoverCache,
  deleteDiscoverCache,
  listDiscoverCache,
  type DiscoverCacheSession,
  readArticleCache,
  readDiscoverCache,
  writeArticleCache,
  writeDiscoverCache,
} from "./newsClientCache";
import { fallbackNewsError } from "./newsReaderUtils";

type Mode = "article" | "site";
const NEWS_READER_MODE_KEY = "uk:news-reader-mode";
const NEWS_READER_TAB_KEY = "uk:news-reader-tab";
type DiscoverState = {
  baseUrl: string | null;
  links: DiscoveredLink[];
  cached: boolean;
  cachedAgeMs?: number;
  fetchedAt?: string;
};
const EMPTY_DISCOVER: DiscoverState = { baseUrl: null, links: [], cached: false };

type Props = {
  devSampleUrls?: string[];
  userWkLevel?: number | null;
};
type RouteChanges = {
  url?: string | null;
  site?: string | null;
};
type FetchDiscoverOptions = {
  forceRefresh?: boolean;
  preserveArticle?: boolean;
  navigation?: "replace" | "push";
};

export default function NewsReader({ devSampleUrls = [], userWkLevel = null }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialUrlParam = searchParams.get("url") ?? "";
  const initialSiteParam = searchParams.get("site") ?? "";

  const [mode, setMode] = useState<Mode>(() =>
    getStoredEnum<Mode>(NEWS_READER_MODE_KEY, ["article", "site"], "article"),
  );
  const [activeTab, setActiveTab] = useState<ArticlePanelTab>(() =>
    getStoredEnum<ArticlePanelTab>(NEWS_READER_TAB_KEY, ["article", "kanji", "history", "stats"], "article"),
  );
  const [url, setUrl] = useState(initialUrlParam);
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<NewsHistoryEntry[]>([]);
  const [kanjiHistory, setKanjiHistory] = useState<NewsKanjiHistoryEntry[]>([]);
  const [discover, setDiscover] = useState<DiscoverState>(EMPTY_DISCOVER);
  const [discoverSessions, setDiscoverSessions] = useState<DiscoverCacheSession[]>([]);
  const [activeDiscoverQuery, setActiveDiscoverQuery] = useState<string | null>(initialSiteParam || null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const lastFetchedUrl = useRef<string | null>(null);

  useEffect(() => {
    setHistory(readNewsHistory());
  }, []);

  const refreshDiscoverSessions = useCallback(() => {
    setDiscoverSessions(listDiscoverCache());
  }, []);

  useEffect(() => {
    refreshDiscoverSessions();
  }, [refreshDiscoverSessions]);

  useEffect(() => {
    setStoredEnum(NEWS_READER_MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    setStoredEnum(NEWS_READER_TAB_KEY, activeTab);
  }, [activeTab]);

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

  const updateRoute = useCallback(
    (changes: RouteChanges, method: "replace" | "push" = "replace") => {
      const params = new URLSearchParams(searchParams.toString());
      if (changes.url !== undefined) {
        if (changes.url) params.set("url", changes.url);
        else params.delete("url");
      }
      if (changes.site !== undefined) {
        if (changes.site) params.set("site", changes.site);
        else params.delete("site");
      }

      const query = params.toString();
      const next = query ? `${pathname}?${query}` : pathname;
      const currentQuery = searchParams.toString();
      const current = currentQuery ? `${pathname}?${currentQuery}` : pathname;
      if (next === current) return;

      if (method === "push") {
        router.push(next, { scroll: false });
      } else {
        router.replace(next, { scroll: false });
      }
    },
    [pathname, router, searchParams],
  );

  const fetchArticle = useCallback(
    async (target: string, navigation: "replace" | "push" = "replace") => {
      const trimmed = target.trim();
      if (!trimmed) {
        return;
      }

      lastFetchedUrl.current = trimmed;
      setLoading(true);
      setError(null);
      setArticle(null);
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
        updateRoute({ url: trimmed, site: activeDiscoverQuery === null ? undefined : activeDiscoverQuery }, navigation);
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
          setError(payload?.error ?? fallbackNewsError("read", response.status));
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
        updateRoute({ url: trimmed, site: activeDiscoverQuery === null ? undefined : activeDiscoverQuery }, navigation);
      } catch {
        setError("Network problem — try again.");
      } finally {
        setLoading(false);
      }
    },
    [activeDiscoverQuery, updateRoute],
  );

  const fetchDiscover = useCallback(
    async (target: string, options: FetchDiscoverOptions = {}) => {
      const trimmed = target.trim();
      if (!trimmed) {
        return;
      }

      const { forceRefresh = false, preserveArticle = false, navigation = "replace" } = options;

      setDiscoverLoading(true);
      setDiscoverError(null);
      setDiscover(EMPTY_DISCOVER);
      setActiveDiscoverQuery(trimmed);
      if (!preserveArticle) {
        setArticle(null);
        setError(null);
        lastFetchedUrl.current = null;
      }
      updateRoute({ site: trimmed, url: preserveArticle ? undefined : null }, navigation);

      if (!forceRefresh) {
        const cached = readDiscoverCache(trimmed);
        if (cached) {
          setDiscover({
            baseUrl: cached.baseUrl,
            links: cached.links,
            cached: true,
            cachedAgeMs: cached.cachedAgeMs,
            fetchedAt: cached.fetchedAt,
          });
          refreshDiscoverSessions();
          setDiscoverLoading(false);
          return;
        }
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
          setDiscoverError((payload as { error?: string } | null)?.error ?? fallbackNewsError("scan", response.status));
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
        refreshDiscoverSessions();
      } catch {
        setDiscoverError("Network problem — try again.");
      } finally {
        setDiscoverLoading(false);
      }
    },
    [refreshDiscoverSessions, updateRoute],
  );

  useEffect(() => {
    const siteParam = searchParams.get("site")?.trim() ?? "";
    if (siteParam) {
      setActiveDiscoverQuery(siteParam);
      const cachedDiscover = readDiscoverCache(siteParam);
      if (cachedDiscover) {
        setDiscover({
          baseUrl: cachedDiscover.baseUrl,
          links: cachedDiscover.links,
          cached: true,
          cachedAgeMs: cachedDiscover.cachedAgeMs,
          fetchedAt: cachedDiscover.fetchedAt,
        });
      }
    }

    const param = searchParams.get("url") ?? "";
    if (!param) {
      setArticle(null);
      setLoading(false);
      setError(null);
      lastFetchedUrl.current = null;
      return;
    }

    if (param === lastFetchedUrl.current) {
      return;
    }

    setUrl(param);
    setMode("article");
    void fetchArticle(param, "replace");
  }, [searchParams, fetchArticle]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "site") await fetchDiscover(url, { navigation: "push" });
    else await fetchArticle(url, "push");
  }

  function handleSelectHistory(target: string) {
    setUrl(target);
    setMode("article");
    setActiveTab("article");
    void fetchArticle(target);
  }

  function handleRemoveHistory(target: string) { setHistory(removeNewsView(target)); }

  function handleClearHistory() { clearNewsHistory(); setHistory([]); }

  function handleSelectDiscovered(target: string) {
    setUrl(target);
    setMode("article");
    setActiveTab("article");
    void fetchArticle(target, "push");
  }

  function handleOpenDiscoverSession(target: string) { setMode("site"); setUrl(target); void fetchDiscover(target, { navigation: "push" }); }

  function handleRefreshDiscoverSession(target: string) {
    setMode("site");
    setUrl(target);
    void fetchDiscover(target, {
      forceRefresh: true,
      preserveArticle: true,
      navigation: "replace",
    });
  }

  function handleRemoveDiscoverSession(target: string) {
    deleteDiscoverCache(target);
    refreshDiscoverSessions();
    if (activeDiscoverQuery === target) {
      setDiscover(EMPTY_DISCOVER);
      setDiscoverError(null);
      setActiveDiscoverQuery(null);
      updateRoute({ site: null, url: null }, "replace");
    }
  }

  function handleClearDiscoverSessions() {
    clearDiscoverCache();
    setDiscoverSessions([]);
    setDiscover(EMPTY_DISCOVER);
    setDiscoverError(null);
    setActiveDiscoverQuery(null);
    updateRoute({ site: null, url: null }, "replace");
  }

  return (
    <div className="space-y-6">
      <NewsReaderForm
        mode={mode}
        onChangeMode={setMode}
        url={url}
        onChangeUrl={setUrl}
        loading={loading}
        discoverLoading={discoverLoading}
        devSampleUrls={devSampleUrls}
        onSubmit={handleSubmit}
      />

      <NewsDiscoverSessions
        sessions={discoverSessions}
        activeQueryUrl={activeDiscoverQuery}
        loading={discoverLoading}
        onOpen={handleOpenDiscoverSession}
        onRefresh={handleRefreshDiscoverSession}
        onRemove={handleRemoveDiscoverSession}
        onClearAll={handleClearDiscoverSessions}
      />

      {loading ? <NewsReaderLoadingState label="Fetching the article..." /> : null}

      {error ? <NewsReaderErrorState message={error} /> : null}

      {article && !loading ? (
        <NewsArticleView
          article={article}
          userWkLevel={userWkLevel}
          activeTab={activeTab}
          onTabChangeAction={setActiveTab}
          historyCount={kanjiHistory.length}
          statsCount={kanjiHistory.length}
          historyPanel={
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
          }
          statsPanel={<NewsStatsClient />}
        />
      ) : null}

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
            if (activeDiscoverQuery) {
              updateRoute({ site: null }, "replace");
              setActiveDiscoverQuery(null);
            }
          }}
        />
      ) : null}

      <NewsHistoryPanel
        entries={history}
        activeUrl={article ? lastFetchedUrl.current : null}
        onSelect={handleSelectHistory}
        onRemove={handleRemoveHistory}
        onClear={handleClearHistory}
      />
    </div>
  );
}
