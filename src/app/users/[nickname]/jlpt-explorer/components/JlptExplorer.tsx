"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toRomaji } from "wanakana";

import jlptReadings from "@/data/jlptReadings.json";
import JlptExplorerContent from "./JlptExplorerContent";
import {
  normalizeReadingForSearch,
  normalizeSearch,
  stripReadingSeparators,
} from "../lib/jlptDisplay";
import type { JlptItem, UserKanjiItem } from "../../explorerTypes";

type Props = {
  accountId: string;
  isActive: boolean;
  items: JlptItem[];
  showEnglish?: boolean;
  studyMode?: boolean;
  userKanjiItems?: UserKanjiItem[];
};

type JlptReadingsRecord = Record<string, { nLevel: number; readings: string[]; meanings?: string[] }>;

type JlptFilter = "all" | "kanji" | "none";

const JLPT_REMOTE_PAGE_SIZE = 240;

export default function JlptExplorer({
  accountId,
  isActive,
  items,
  showEnglish = false,
  studyMode = false,
  userKanjiItems = [],
}: Props) {
  const hasInitialItems = items.length > 0;
  const hasInitialUserKanji = userKanjiItems.length > 0;
  const [pagedItems, setPagedItems] = useState<JlptItem[]>(items);
  const [remoteTotal, setRemoteTotal] = useState<number>(items.length);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data: firstPageData } = useSWR<{
    jlptItems: JlptItem[];
    pagination?: { offset: number; limit: number; total: number; hasMore: boolean };
  }>(
    isActive && !hasInitialItems
      ? `/api/accounts/${accountId}/jlpt?offset=0&limit=${JLPT_REMOTE_PAGE_SIZE}&includeItems=1&includeUserIndex=0`
      : null,
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load JLPT explorer data.");
      }
      return (await response.json()) as {
        jlptItems: JlptItem[];
        pagination?: { offset: number; limit: number; total: number; hasMore: boolean };
      };
    },
    { revalidateOnFocus: false },
  );

  const { data: userIndexData } = useSWR<{ userKanjiItems: UserKanjiItem[] }>(
    isActive && !hasInitialUserKanji
      ? `/api/accounts/${accountId}/jlpt?offset=0&limit=0&includeItems=0&includeUserIndex=1`
      : null,
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load JLPT user index.");
      }
      return (await response.json()) as { userKanjiItems: UserKanjiItem[] };
    },
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!hasInitialItems && firstPageData?.jlptItems) {
      setPagedItems(firstPageData.jlptItems);
      setRemoteTotal(firstPageData.pagination?.total ?? firstPageData.jlptItems.length);
    }
  }, [firstPageData, hasInitialItems]);

  const effectiveItems = hasInitialItems ? items : pagedItems;
  const effectiveUserKanjiItems = hasInitialUserKanji ? userKanjiItems : (userIndexData?.userKanjiItems ?? []);
  const isLoadingData = !hasInitialItems && !firstPageData;
  const hasMoreRemote = !hasInitialItems && effectiveItems.length < remoteTotal;

  const loadMoreRemote = useCallback(async () => {
    if (!hasMoreRemote || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/accounts/${accountId}/jlpt?offset=${effectiveItems.length}&limit=${JLPT_REMOTE_PAGE_SIZE}&includeItems=1&includeUserIndex=0`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error("Could not load more JLPT data.");
      }

      const payload = (await response.json()) as {
        jlptItems: JlptItem[];
        pagination?: { total: number };
      };

      setPagedItems((prev) => {
        const existing = new Set(prev.map((item) => item.kanji));
        const merged = [...prev, ...payload.jlptItems.filter((item) => !existing.has(item.kanji))];
        return merged;
      });
      if (payload.pagination?.total) {
        setRemoteTotal(payload.pagination.total);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [accountId, effectiveItems.length, hasMoreRemote, isLoadingMore]);

  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [stickyLevels, setStickyLevels] = useState(false);
  const [wkFilter, setWkFilter] = useState<JlptFilter>("all");
  const [wkLevelFilter, setWkLevelFilter] = useState<number | "none" | null>(null);
  const [query, setQuery] = useState("");
  const [selectedKanji, setSelectedKanji] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onExplorerPageChange = () => {
      setSelectedKanji(null);
    };

    window.addEventListener("wr:explorer-page-change", onExplorerPageChange as EventListener);
    return () => {
      window.removeEventListener("wr:explorer-page-change", onExplorerPageChange as EventListener);
    };
  }, []);
  const lastHandledFindQueryRef = useRef<string>("");

  const userKanjiByChar = useMemo(() => {
    const map = new Map<string, {
      subjectId?: number;
      characters: string;
      meanings?: string[];
      primaryReadings?: string[];
      readings?: string[];
      meaningExplanation?: string;
      readingExplanation?: string;
      startedAt?: string | null;
      passedAt?: string | null;
      availableAt?: string | null;
      status?: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
      srsStage?: number;
      wkLevel?: number | null;
    }>();

    for (const item of effectiveUserKanjiItems) {
      const current = map.get(item.characters);
      if (!current || (item.srsStage ?? 0) >= (current.srsStage ?? 0)) {
        map.set(item.characters, item);
      }
    }

    return map;
  }, [effectiveUserKanjiItems]);

  const counts = useMemo(() => {
    const noneCount = effectiveItems.filter((item) => !userKanjiByChar.has(item.kanji)).length;
    return {
      all: effectiveItems.length,
      kanji: effectiveItems.length - noneCount,
      none: noneCount,
      n5: effectiveItems.filter((item) => item.nLevel === 5).length,
      n4: effectiveItems.filter((item) => item.nLevel === 4).length,
      n3: effectiveItems.filter((item) => item.nLevel === 3).length,
      n2: effectiveItems.filter((item) => item.nLevel === 2).length,
      n1: effectiveItems.filter((item) => item.nLevel === 1).length,
    };
  }, [effectiveItems, userKanjiByChar]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const records = jlptReadings as JlptReadingsRecord;

    return effectiveItems.filter((item) => {
      const levelPass = selectedLevels.has(item.nLevel);

      if (!levelPass) {
        return false;
      }

      const userMatch = userKanjiByChar.get(item.kanji);
      const wkPass =
        wkFilter === "all"
          ? true
          : wkFilter === "kanji"
            ? Boolean(userMatch)
            : !userMatch;

      if (!wkPass) {
        return false;
      }

      if (wkLevelFilter !== null) {
        const itemWkLevel = userMatch?.wkLevel ?? null;
        if (wkLevelFilter === "none") {
          if (itemWkLevel !== null && itemWkLevel !== undefined) return false;
        } else {
          if (itemWkLevel !== wkLevelFilter) return false;
        }
      }

      if (!normalizedQuery) {
        return true;
      }

      const preload = records[item.kanji];
      const readings = [
        ...item.kunReadings,
        ...item.onReadings,
        ...item.nanoriReadings,
        ...(preload?.readings ?? []),
      ];
      const meanings = [
        ...(item.primaryMeaning ? [item.primaryMeaning] : []),
        ...item.meanings,
        ...(preload?.meanings ?? []),
      ];
      const romaji = normalizeSearch(toRomaji(item.kanji, { upcaseKatakana: false }));
      const readingRomajiMatch = readings.some((reading) =>
        normalizeSearch(toRomaji(stripReadingSeparators(reading), { upcaseKatakana: false })).includes(normalizedQuery),
      );

      const readingMatch = readings.some((reading) => {
        const normalizedReading = normalizeSearch(reading);
        const normalizedNoSeparator = normalizeReadingForSearch(reading);
        return normalizedReading.includes(normalizedQuery) || normalizedNoSeparator.includes(normalizedQuery);
      });

      return (
        item.kanji.includes(query.trim()) ||
        normalizeSearch(item.kanji).includes(normalizedQuery) ||
        romaji.includes(normalizedQuery) ||
        readingMatch ||
        readingRomajiMatch ||
        meanings.some((meaning) => normalizeSearch(meaning).includes(normalizedQuery))
      );
    });
  }, [effectiveItems, query, selectedLevels, userKanjiByChar, wkFilter, wkLevelFilter]);

  useEffect(() => {
    const computeColumns = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setGridColumns(4);
        return;
      }

      if (window.matchMedia("(min-width: 640px)").matches) {
        setGridColumns(2);
        return;
      }

      setGridColumns(1);
    };

    computeColumns();

    const sm = window.matchMedia("(min-width: 640px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    sm.addEventListener("change", computeColumns);
    lg.addEventListener("change", computeColumns);

    return () => {
      sm.removeEventListener("change", computeColumns);
      lg.removeEventListener("change", computeColumns);
    };
  }, []);

  function toggleNLevel(level: number) {
    if (!stickyLevels) {
      setSelectedLevels(new Set([level]));
      return;
    }

    setSelectedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        if (next.size === 1) {
          return next;
        }
        next.delete(level);
        return next;
      }

      next.add(level);
      return next;
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const runFromUrl = () => {
      const fromUrl = new URLSearchParams(window.location.search).get("findJlpt");
      const trimmed = fromUrl?.trim() ?? "";

      if (!trimmed) {
        setQuery("");
        return;
      }

      if (lastHandledFindQueryRef.current === trimmed) {
        return;
      }

      lastHandledFindQueryRef.current = trimmed;
      setQuery(trimmed);
    };

    runFromUrl();

    const onSearch = (event: Event) => {
      const custom = event as CustomEvent<{ query?: string; requestId?: string; scope?: "level" | "jlpt" }>;
      if (custom.detail?.scope !== "jlpt") {
        return;
      }

      const nextQuery = custom.detail?.query?.trim() ?? "";
      const requestId = custom.detail?.requestId;
      lastHandledFindQueryRef.current = nextQuery;
      setQuery(nextQuery);

      const normalizedQuery = normalizeSearch(nextQuery);
      const matchedCount = effectiveItems.filter((item) => {
        const levelPass =
          selectedLevels.has(item.nLevel);

        if (!levelPass) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const romaji = normalizeSearch(toRomaji(item.kanji, { upcaseKatakana: false }));
        const preload = (jlptReadings as JlptReadingsRecord)[item.kanji];
        const readings = [
          ...item.kunReadings,
          ...item.onReadings,
          ...item.nanoriReadings,
          ...(preload?.readings ?? []),
        ];
        const meanings = [
          ...(item.primaryMeaning ? [item.primaryMeaning] : []),
          ...item.meanings,
          ...(preload?.meanings ?? []),
        ];
        const readingRomajiMatch = readings.some((reading) =>
          normalizeSearch(toRomaji(stripReadingSeparators(reading), { upcaseKatakana: false })).includes(normalizedQuery),
        );

        const readingMatch = readings.some((reading) => {
          const normalizedReading = normalizeSearch(reading);
          const normalizedNoSeparator = normalizeReadingForSearch(reading);
          return normalizedReading.includes(normalizedQuery) || normalizedNoSeparator.includes(normalizedQuery);
        });

        return (
          item.kanji.includes(nextQuery) ||
          normalizeSearch(item.kanji).includes(normalizedQuery) ||
          romaji.includes(normalizedQuery) ||
          readingMatch ||
          readingRomajiMatch ||
          meanings.some((meaning) => normalizeSearch(meaning).includes(normalizedQuery))
        );
      }).length;

      if (requestId) {
        window.dispatchEvent(
          new CustomEvent("wr:explorer-search-complete", {
            detail: {
              requestId,
              ok: true,
              message: `Found ${matchedCount} JLPT result${matchedCount === 1 ? "" : "s"}.`,
            },
          }),
        );
      }
    };

    const onPopState = () => {
      runFromUrl();
    };

    window.addEventListener("wr:explorer-search", onSearch as EventListener);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("wr:explorer-search", onSearch as EventListener);
      window.removeEventListener("popstate", onPopState);
    };
  }, [effectiveItems, selectedLevels]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("jlptKanji")?.trim() ?? "";
      setSelectedKanji(fromUrl || null);
    };

    applyFromUrl();

    const onPopState = () => {
      applyFromUrl();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (selectedKanji) {
      params.set("jlptKanji", selectedKanji);
    } else {
      params.delete("jlptKanji");
    }

    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) {
      window.history.replaceState(null, "", next);
    }
  }, [selectedKanji]);

  const selectedItem = selectedKanji
    ? filteredItems.find((item) => item.kanji === selectedKanji) ?? null
    : null;

  const availableWkLevels = useMemo(() => {
    const levels = new Set<number>();
    for (const item of effectiveItems) {
      const match = userKanjiByChar.get(item.kanji);
      if (typeof match?.wkLevel === "number") levels.add(match.wkLevel);
    }
    return Array.from(levels).sort((a, b) => a - b);
  }, [effectiveItems, userKanjiByChar]);

  return (
    <JlptExplorerContent
      items={effectiveItems}
      showEnglish={showEnglish}
      studyMode={studyMode}
      counts={counts}
      selectedLevels={selectedLevels}
      stickyLevels={stickyLevels}
      wkFilter={wkFilter}
      wkLevelFilter={wkLevelFilter}
      availableWkLevels={availableWkLevels}
      filteredItems={filteredItems}
      selectedKanji={selectedKanji}
      selectedItem={selectedItem}
      gridColumns={gridColumns}
      userKanjiByChar={userKanjiByChar}
      isLoadingData={isLoadingData}
      isLoadingMore={isLoadingMore}
      hasMoreRemote={hasMoreRemote}
      onLoadMoreRemote={loadMoreRemote}
      onSetSelectedLevels={setSelectedLevels}
      onToggleNLevel={toggleNLevel}
      onSetWkFilter={setWkFilter}
      onSetWkLevelFilter={setWkLevelFilter}
      onSetStickyLevels={setStickyLevels}
      onSetSelectedKanji={setSelectedKanji}
    />
  );
}
