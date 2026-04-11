"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  items: JlptItem[];
  showEnglish?: boolean;
  studyMode?: boolean;
  userKanjiItems?: UserKanjiItem[];
};

type JlptReadingsRecord = Record<string, { nLevel: number; readings: string[]; meanings?: string[] }>;

type JlptFilter = "all" | "kanji" | "none";

export default function JlptExplorer({
  items,
  showEnglish = false,
  studyMode = false,
  userKanjiItems = [],
}: Props) {
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [stickyLevels, setStickyLevels] = useState(false);
  const [wkFilter, setWkFilter] = useState<JlptFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedKanji, setSelectedKanji] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState(1);
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

    for (const item of userKanjiItems) {
      const current = map.get(item.characters);
      if (!current || (item.srsStage ?? 0) >= (current.srsStage ?? 0)) {
        map.set(item.characters, item);
      }
    }

    return map;
  }, [userKanjiItems]);

  const counts = useMemo(() => {
    const noneCount = items.filter((item) => !userKanjiByChar.has(item.kanji)).length;
    return {
      all: items.length,
      kanji: items.length - noneCount,
      none: noneCount,
      n5: items.filter((item) => item.nLevel === 5).length,
      n4: items.filter((item) => item.nLevel === 4).length,
      n3: items.filter((item) => item.nLevel === 3).length,
      n2: items.filter((item) => item.nLevel === 2).length,
      n1: items.filter((item) => item.nLevel === 1).length,
    };
  }, [items, userKanjiByChar]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const records = jlptReadings as JlptReadingsRecord;

    return items.filter((item) => {
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
  }, [items, query, selectedLevels, userKanjiByChar, wkFilter]);

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
      const matchedCount = items.filter((item) => {
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
  }, [items, selectedLevels]);

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

  return (
    <JlptExplorerContent
      items={items}
      showEnglish={showEnglish}
      studyMode={studyMode}
      counts={counts}
      selectedLevels={selectedLevels}
      stickyLevels={stickyLevels}
      wkFilter={wkFilter}
      filteredItems={filteredItems}
      selectedKanji={selectedKanji}
      selectedItem={selectedItem}
      gridColumns={gridColumns}
      userKanjiByChar={userKanjiByChar}
      onSetSelectedLevels={setSelectedLevels}
      onToggleNLevel={toggleNLevel}
      onSetWkFilter={setWkFilter}
      onSetStickyLevels={setStickyLevels}
      onSetSelectedKanji={setSelectedKanji}
    />
  );
}
