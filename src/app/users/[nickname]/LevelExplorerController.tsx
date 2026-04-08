"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toRomaji } from "wanakana";

import LevelRelatedPanels from "./LevelRelatedPanels";
import type { LevelItem, RelatedReference, Snapshot, SrsFilter } from "./explorerTypes";
import {
  buildLevelExplorerStorageKeys,
  buildLevelExplorerUrl,
  JLPT_FILTER_ALLOWED,
  parseLevelExplorerUrlState,
  persistEnum,
  persistFlag,
  persistOptionalPositiveInteger,
  persistTypeVisibility,
  readStoredEnum,
  readStoredFlag,
  readStoredPositiveInteger,
  readStoredTypeVisibility,
  REVIEW_TIMING_ALLOWED,
  SRS_FILTER_ALLOWED,
  TYPE_FILTER_ALLOWED,
  type JlptFilter,
  type ReviewTimingFilter,
  type TypeFilter,
} from "./levelExplorerState";
import {
  buildCombinedSnapshot,
  computeJlptCounts,
  computeLevelItemCounts,
  computeReviewTimingCounts,
  filterAndSortLevelItems,
  itemMatchesLevelSearch,
  passesReviewTimingFilter,
} from "./levelExplorerSelectors";

type Props = {
  accountId: string;
  maxLevel: number;
  initialSnapshot: Snapshot;
  initialSrsFilter?: SrsFilter;
  showEnglish?: boolean;
};

function snapshotHasComponentKanjiData(snapshot: Snapshot): boolean {
  const vocabularyItems = snapshot.items.filter((item) => item.subjectType === "vocabulary");
  const kanjiItems = snapshot.items.filter((item) => item.subjectType === "kanji");

  return (
    vocabularyItems.every((item) =>
      Array.isArray(item.componentKanji) &&
      (item.componentKanji ?? []).every((related) => Object.hasOwn(related as object, "reading")),
    ) &&
    kanjiItems.every((item) =>
      (item.usedInVocabulary ?? []).every((related) => Object.hasOwn(related as object, "reading")) &&
      (item.radicals ?? []).every((related) => Object.hasOwn(related as object, "reading")) &&
      (item.visuallySimilar ?? []).every((related) => Object.hasOwn(related as object, "reading")),
    )
  );
}

function normalizeSnapshot(raw: Snapshot): Snapshot {
  return {
    ...raw,
    items: raw.items.map((item) => ({
      ...item,
      subjectType: item.subjectType ?? "kanji",
      wkLevel: item.wkLevel ?? raw.level,
      characters: item.characters ?? "?",
      meanings: item.meanings ?? [],
      readings: item.readings ?? [],
      primaryReadings: item.primaryReadings ?? [],
      radicals: item.radicals ?? [],
      visuallySimilar: item.visuallySimilar ?? [],
      usedInVocabulary: item.usedInVocabulary ?? [],
      componentKanji: item.componentKanji ?? [],
      meaningExplanation: item.meaningExplanation ?? "",
      readingExplanation: item.readingExplanation ?? "",
      jlptLevel: item.jlptLevel ?? null,
      startedAt: item.startedAt ?? null,
      passedAt: item.passedAt ?? null,
      availableAt: item.availableAt ?? null,
    })),
  };
}

function statusClass(status: LevelItem["status"]): string {
  switch (status) {
    case "locked":
      return "bg-surface-muted text-foreground/70";
    case "apprentice":
      return "bg-pink-100 text-pink-700";
    case "guru":
      return "bg-violet-100 text-violet-700";
    case "master":
      return "bg-sky-100 text-sky-700";
    case "enlightened":
      return "bg-amber-100 text-amber-700";
    case "burned":
      return "bg-surface-muted text-foreground/80";
  }
}

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

function formatDate(input: string | null | undefined): string {
  if (!input) {
    return "-";
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

type NextReviewBadge = {
  label: string;
  className: string;
};

function formatNextReviewBadge(input: string | null | undefined): NextReviewBadge | null {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const deltaMs = parsed.getTime() - Date.now();
  const absMs = Math.abs(deltaMs);

  if (deltaMs <= 0) {
    if (absMs < 15 * 60 * 1000) {
      return {
        label: "Due now",
        className: "border-orange-300 bg-orange-50 text-orange-700",
      };
    }

    if (absMs < 24 * 60 * 60 * 1000) {
      const hours = Math.max(1, Math.round(absMs / (60 * 60 * 1000)));
      return {
        label: `Overdue ${hours}h`,
        className: "border-orange-300 bg-orange-50 text-orange-700",
      };
    }

    const days = Math.max(1, Math.round(absMs / (24 * 60 * 60 * 1000)));
    return {
      label: `Overdue ${days}d`,
      className: "border-red-300 bg-red-50 text-red-700",
    };
  }

  if (absMs < 15 * 60 * 1000) {
    return {
      label: "Due soon",
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  }

  if (absMs < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(absMs / (60 * 1000)));
    return {
      label: `In ${minutes}m`,
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  }

  if (absMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(absMs / (60 * 60 * 1000)));
    return {
      label: `In ${hours}h`,
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  }

  const days = Math.max(1, Math.round(absMs / (24 * 60 * 60 * 1000)));
  return {
    label: `In ${days}d`,
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
  };
}

function stripHtml(input: string | undefined): string {
  if (!input) {
    return "";
  }

  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function primaryReadingForDisplay(item: LevelItem): string | null {
  const reading = (item.primaryReadings ?? [])[0] ?? null;
  if (reading) {
    return reading;
  }

  if (item.subjectType === "radical") {
    return null;
  }

  return "-";
}

function glyphSubtitleForDisplay(item: LevelItem): string | null {
  if (item.subjectType === "radical") {
    return item.meanings[0] ?? null;
  }

  return primaryReadingForDisplay(item);
}

function englishSubtitleForDisplay(item: LevelItem): string | null {
  if (item.subjectType === "radical") {
    return item.meanings[0] ?? null;
  }

  const reading = primaryReadingForDisplay(item);
  if (!reading) {
    return null;
  }

  const pronunciation = pronunciationForReading(reading);
  return pronunciation ? `${reading} / ${pronunciation}` : reading;
}

function titleForDisplay(item: LevelItem, showEnglish: boolean): string {
  if (showEnglish) {
    return item.meanings.join(", ") || "-";
  }

  const subtitle = glyphSubtitleForDisplay(item);
  if (subtitle && subtitle !== "-") {
    return subtitle;
  }

  return item.characters || "-";
}

function glyphHasReading(item: LevelItem): boolean {
  return Boolean(glyphSubtitleForDisplay(item));
}

function pronunciationForReading(reading: string | null | undefined): string | null {
  if (!reading) {
    return null;
  }

  const trimmed = reading.trim();
  if (!trimmed || trimmed === "-") {
    return null;
  }

  const romaji = toRomaji(trimmed, { upcaseKatakana: false }).trim();
  if (!romaji || romaji === trimmed) {
    return null;
  }

  return romaji;
}

function ReadingWithPronunciation({
  reading,
  className,
}: {
  reading: string;
  className?: string;
}) {
  const pronunciation = pronunciationForReading(reading);

  if (!pronunciation) {
    return <span className={className}>{reading}</span>;
  }

  return (
    <span
      className={className}
      title={`Pronunciation: ${pronunciation}`}
      aria-label={`${reading} pronunciation ${pronunciation}`}
    >
      {reading}
    </span>
  );
}

function ReadingListWithPronunciation({
  readings,
  mode = "tooltip",
}: {
  readings: string[];
  mode?: "tooltip" | "inline" | "plain";
}) {
  if (readings.length === 0) {
    return <span>-</span>;
  }

  if (mode === "plain") {
    return <>{readings.join(", ")}</>;
  }

  if (mode === "inline") {
    return (
      <>
        {readings.map((reading, index) => {
          const pronunciation = pronunciationForReading(reading);
          const label = pronunciation ? `${reading} / ${pronunciation}` : reading;

          return (
            <Fragment key={`${reading}-${index}`}>
              {index > 0 ? ", " : null}
              <span>{label}</span>
            </Fragment>
          );
        })}
      </>
    );
  }

  return (
    <>
      {readings.map((reading, index) => (
        <Fragment key={`${reading}-${index}`}>
          {index > 0 ? ", " : null}
          <ReadingWithPronunciation reading={reading} />
        </Fragment>
      ))}
    </>
  );
}

function secondaryReadingsForDisplay(item: LevelItem): string[] {
  const primary = new Set((item.primaryReadings ?? []).map((reading) => reading.trim()));
  const allReadings = (item.readings ?? [])
    .map((reading) => reading.trim())
    .filter((reading) => Boolean(reading));

  const seen = new Set<string>();
  const secondary: string[] = [];

  for (const reading of allReadings) {
    if (primary.has(reading) || seen.has(reading)) {
      continue;
    }

    seen.add(reading);
    secondary.push(reading);
  }

  return secondary;
}

export default function LevelExplorerController({
  accountId,
  maxLevel,
  initialSnapshot,
  initialSrsFilter = "all",
  showEnglish = false,
}: Props) {
  const storageKeys = useMemo(() => buildLevelExplorerStorageKeys(accountId), [accountId]);
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set([initialSnapshot.level]));
  const [snapshotsByLevel, setSnapshotsByLevel] = useState<Map<number, Snapshot>>(
    new Map([[initialSnapshot.level, normalizeSnapshot(initialSnapshot)]]),
  );
  const [srsFilter, setSrsFilter] = useState<SrsFilter>(initialSrsFilter);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [jlptFilter, setJlptFilter] = useState<JlptFilter>("all");
  const [reviewTimingFilter, setReviewTimingFilter] = useState<ReviewTimingFilter>("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    initialSnapshot.items[0]?.subjectId ?? null,
  );
  const [visibleTypes, setVisibleTypes] = useState({
    radical: true,
    kanji: true,
    vocabulary: true,
  });
  const [stickyMerge, setStickyMerge] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [searchMatchedSubjectIds, setSearchMatchedSubjectIds] = useState<Set<number> | null>(null);
  const [searchAvailableLevels, setSearchAvailableLevels] = useState<Set<number> | null>(null);
  const [gridColumns, setGridColumns] = useState(1);
  const applyingUrlStateRef = useRef(false);
  const hasHydratedUrlStateRef = useRef(false);
  const pendingHistoryModeRef = useRef<"replace" | "push">("replace");
  const lastHandledFindQueryRef = useRef<string>("");

  function markHistoryPush() {
    pendingHistoryModeRef.current = "push";
  }

  function writeUrlState() {
    if (typeof window === "undefined") {
      return;
    }

    const nextSearch = buildLevelExplorerUrl(window.location.search, {
      levels: selectedLevels,
      subjectId: selectedSubjectId,
      srs: srsFilter,
      type: typeFilter,
      jlpt: jlptFilter,
      review: reviewTimingFilter,
      stickyMerge,
    });
    const next = `${window.location.pathname}?${nextSearch}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === current) {
      pendingHistoryModeRef.current = "replace";
      return;
    }

    const mode = pendingHistoryModeRef.current;
    pendingHistoryModeRef.current = "replace";

    if (mode === "push") {
      window.history.pushState(null, "", next);
      return;
    }

    window.history.replaceState(null, "", next);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyFromUrl = () => {
      applyingUrlStateRef.current = true;
      const parsed = parseLevelExplorerUrlState(
        window.location.search,
        maxLevel,
        initialSnapshot.level,
      );

      setSelectedLevels(parsed.levels);
      setSelectedSubjectId(parsed.subjectId);
      setSrsFilter(parsed.srs);
      setTypeFilter(parsed.type);
      setJlptFilter(parsed.jlpt);
      setReviewTimingFilter(parsed.review);
      setStickyMerge(parsed.stickyMerge);

      for (const level of parsed.levels.values()) {
        void ensureLevelLoaded(level);
      }

      window.setTimeout(() => {
        applyingUrlStateRef.current = false;
      }, 0);
    };

    applyFromUrl();
    hasHydratedUrlStateRef.current = true;

    const onPopState = () => {
      applyFromUrl();
    };

    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedUrlStateRef.current || applyingUrlStateRef.current) {
      return;
    }

    writeUrlState();
  }, [
    selectedLevels,
    selectedSubjectId,
    srsFilter,
    typeFilter,
    jlptFilter,
    reviewTimingFilter,
    stickyMerge,
  ]);

  useEffect(() => {
    try {
      setVisibleTypes((prev) => readStoredTypeVisibility(window.localStorage, storageKeys.typeVisibility, prev));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [storageKeys.typeVisibility]);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has("subject")) {
        return;
      }

      const parsed = readStoredPositiveInteger(window.localStorage, storageKeys.selectedSubject);
      if (parsed !== null) {
        setSelectedSubjectId(parsed);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [storageKeys.selectedSubject]);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has("sticky")) {
        return;
      }

      if (readStoredFlag(window.localStorage, storageKeys.stickyMerge)) {
        setStickyMerge(true);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [storageKeys.stickyMerge]);

  useEffect(() => {
    try {
      if (readStoredFlag(window.localStorage, storageKeys.filtersCollapsed)) {
        setFiltersCollapsed(true);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [storageKeys.filtersCollapsed]);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has("srs")) {
        return;
      }

      const stored = readStoredEnum(window.localStorage, storageKeys.srsFilter, SRS_FILTER_ALLOWED);
      if (stored) {
        setSrsFilter(stored);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [storageKeys.srsFilter]);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has("type")) {
        return;
      }

      const stored = readStoredEnum(window.localStorage, storageKeys.typeFilter, TYPE_FILTER_ALLOWED);
      if (stored) {
        setTypeFilter(stored);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [storageKeys.typeFilter]);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has("jlpt")) {
        return;
      }

      const stored = readStoredEnum(window.localStorage, storageKeys.jlptFilter, JLPT_FILTER_ALLOWED);
      if (stored) {
        setJlptFilter(stored);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [storageKeys.jlptFilter]);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has("review")) {
        return;
      }

      const stored = readStoredEnum(
        window.localStorage,
        storageKeys.reviewTimingFilter,
        REVIEW_TIMING_ALLOWED,
      );
      if (stored) {
        setReviewTimingFilter(stored);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [storageKeys.reviewTimingFilter]);

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

  useEffect(() => {
    try {
      persistEnum(window.localStorage, storageKeys.srsFilter, srsFilter);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [srsFilter, storageKeys.srsFilter]);

  useEffect(() => {
    try {
      persistEnum(window.localStorage, storageKeys.typeFilter, typeFilter);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [typeFilter, storageKeys.typeFilter]);

  useEffect(() => {
    try {
      persistEnum(window.localStorage, storageKeys.jlptFilter, jlptFilter);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [jlptFilter, storageKeys.jlptFilter]);

  useEffect(() => {
    try {
      persistEnum(window.localStorage, storageKeys.reviewTimingFilter, reviewTimingFilter);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [reviewTimingFilter, storageKeys.reviewTimingFilter]);

  useEffect(() => {
    try {
      persistOptionalPositiveInteger(window.localStorage, storageKeys.selectedSubject, selectedSubjectId);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [selectedSubjectId, storageKeys.selectedSubject]);

  function setVisibleTypesAndPersist(next: typeof visibleTypes) {
    const hasAtLeastOneVisible = next.radical || next.kanji || next.vocabulary;
    const normalized = hasAtLeastOneVisible
      ? next
      : {
          radical: true,
          kanji: true,
          vocabulary: true,
        };

    setVisibleTypes(normalized);
    try {
      persistTypeVisibility(window.localStorage, storageKeys.typeVisibility, normalized);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }

  function toggleTypeVisibility(type: "radical" | "kanji" | "vocabulary") {
    markHistoryPush();

    const visibleCount =
      Number(visibleTypes.radical) + Number(visibleTypes.kanji) + Number(visibleTypes.vocabulary);
    if (visibleTypes[type] && visibleCount === 1) {
      return;
    }

    setVisibleTypesAndPersist({
      ...visibleTypes,
      [type]: !visibleTypes[type],
    });
    setSelectedSubjectId(null);
    setTypeFilter("all");
  }

  function enableAllTypes() {
    markHistoryPush();
    setVisibleTypesAndPersist({ radical: true, kanji: true, vocabulary: true });
    setSelectedSubjectId(null);
    setTypeFilter("all");
  }

  function setStickyMergeAndPersist(next: boolean) {
    markHistoryPush();

    setStickyMerge(next);

    try {
      persistFlag(window.localStorage, storageKeys.stickyMerge, next);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }

    if (!next) {
      const firstSelected = Array.from(selectedLevels.values()).sort((a, b) => a - b)[0] ?? initialSnapshot.level;
      setSelectedLevels(new Set([firstSelected]));
    }
  }

  function setTypeFilterAndEnsureVisible(nextType: TypeFilter) {
    markHistoryPush();

    setTypeFilter(nextType);

    if (nextType === "all") {
      return;
    }

    if (!visibleTypes[nextType]) {
      setVisibleTypesAndPersist({
        ...visibleTypes,
        [nextType]: true,
      });
    }
  }

  function setSrsFilterWithHistory(nextStatus: SrsFilter) {
    markHistoryPush();

    setSelectedSubjectId(null);
    setSrsFilter(nextStatus);
  }

  function setFiltersCollapsedAndPersist(next: boolean) {
    setFiltersCollapsed(next);

    try {
      persistFlag(window.localStorage, storageKeys.filtersCollapsed, next);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }

  const levelOptions = useMemo(() => {
    return Array.from({ length: maxLevel }, (_, index) => index + 1);
  }, [maxLevel]);

  const combinedSnapshot = useMemo(() => {
    return buildCombinedSnapshot(selectedLevels, snapshotsByLevel, normalizeSnapshot(initialSnapshot));
  }, [initialSnapshot, selectedLevels, snapshotsByLevel]);

  async function ensureLevelLoaded(level: number, forceReload = false): Promise<Snapshot | undefined> {
    if (!forceReload && snapshotsByLevel.has(level)) {
      return snapshotsByLevel.get(level);
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/levels/${level}`, { cache: "no-store" });
      const data = (await response.json()) as { error?: string; snapshot?: Snapshot };

      if (!response.ok || !data.snapshot) {
        throw new Error(data.error ?? "Could not load level details.");
      }

      const normalized = normalizeSnapshot(data.snapshot);
      setSnapshotsByLevel((prev) => {
        const map = new Map(prev);
        map.set(level, normalized);
        return map;
      });
      return normalized;
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load level details.");
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const current = snapshotsByLevel.get(initialSnapshot.level);
    if (!current) {
      return;
    }

    if (!snapshotHasComponentKanjiData(current)) {
      void ensureLevelLoaded(initialSnapshot.level, true);
    }
  }, [initialSnapshot.level, snapshotsByLevel]);

  async function toggleLevel(level: number) {
    markHistoryPush();

    setError("");
    setSelectedSubjectId(null);

    if (searchAvailableLevels && !searchAvailableLevels.has(level)) {
      return;
    }

    if (!stickyMerge) {
      setSelectedLevels(new Set([level]));
      await ensureLevelLoaded(level);
      return;
    }

    const next = new Set(selectedLevels);
    if (next.has(level)) {
      if (next.size === 1) {
        return;
      }
      next.delete(level);
      setSelectedLevels(next);
      return;
    }

    next.add(level);
    setSelectedLevels(next);
    await ensureLevelLoaded(level);
  }

  async function selectAllLevelsAndClearSearch() {
    markHistoryPush();

    const allLevels = new Set(levelOptions);
    setSelectedSubjectId(null);
    setSelectedLevels(allLevels);

    setSearchMatchedSubjectIds(null);
    setSearchAvailableLevels(null);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("findLevel");
      params.delete("findJlpt");
      const next = `${window.location.pathname}?${params.toString()}#explorer`;
      window.history.pushState(null, "", next);
      window.dispatchEvent(
        new CustomEvent("wr:explorer-search-clear", {
          detail: { scope: "all" },
        }),
      );
    }

    await Promise.all(levelOptions.map((level) => ensureLevelLoaded(level)));
  }

  const filteredItems = useMemo(() => {
    return filterAndSortLevelItems(combinedSnapshot.items, {
      srsFilter,
      typeFilter,
      jlptFilter,
      reviewTimingFilter,
      visibleTypes,
      searchMatchedSubjectIds,
    });
  }, [
    combinedSnapshot.items,
    srsFilter,
    typeFilter,
    jlptFilter,
    reviewTimingFilter,
    visibleTypes,
    searchMatchedSubjectIds,
  ]);

  const selectedItem = filteredItems.find((item) => item.subjectId === selectedSubjectId) ?? null;
  const selectedItemFromAll =
    selectedSubjectId === null
      ? null
      : combinedSnapshot.items.find((item) => item.subjectId === selectedSubjectId) ?? null;
  const selectedItemIndex = selectedItem
    ? filteredItems.findIndex((item) => item.subjectId === selectedItem.subjectId)
    : -1;
  const detailInsertIndex =
    selectedItemIndex >= 0
      ? Math.min(
          filteredItems.length - 1,
          Math.floor(selectedItemIndex / gridColumns) * gridColumns + (gridColumns - 1),
        )
      : -1;

  const counts = useMemo(() => {
    return computeLevelItemCounts(combinedSnapshot.items);
  }, [combinedSnapshot.items]);

  const jlptCounts = useMemo(() => {
    return computeJlptCounts(combinedSnapshot.items);
  }, [combinedSnapshot.items]);

  const reviewTimingCounts = useMemo(() => {
    return computeReviewTimingCounts(combinedSnapshot.items);
  }, [combinedSnapshot.items]);

  const selectedLevelList = Array.from(selectedLevels.values()).sort((a, b) => a - b);

  useEffect(() => {
    if (!selectedItemFromAll) {
      return;
    }

    if (selectedItem) {
      return;
    }

    if (selectedItemFromAll.subjectType && typeFilter !== selectedItemFromAll.subjectType) {
      setTypeFilter(selectedItemFromAll.subjectType);
    }

    if (
      selectedItemFromAll.subjectType &&
      !visibleTypes[selectedItemFromAll.subjectType]
    ) {
      setVisibleTypesAndPersist({
        ...visibleTypes,
        [selectedItemFromAll.subjectType]: true,
      });
    }

    if (srsFilter !== "all" && selectedItemFromAll.status !== srsFilter) {
      setSrsFilter("all");
    }

    if (jlptFilter !== "all") {
      const expectedJlpt = Number(jlptFilter.slice(1));
      const matchesJlpt = selectedItemFromAll.subjectType === "kanji" && selectedItemFromAll.jlptLevel === expectedJlpt;

      if (!matchesJlpt) {
        setJlptFilter("all");
      }
    }

    if (!passesReviewTimingFilter(selectedItemFromAll, reviewTimingFilter)) {
      setReviewTimingFilter("all");
    }

  }, [
    selectedItem,
    selectedItemFromAll,
    typeFilter,
    visibleTypes,
    srsFilter,
    jlptFilter,
    reviewTimingFilter,
  ]);

  function badgeClass(active: boolean): string {
    return active
      ? "border-accent bg-accent text-white"
      : "border-line bg-surface text-foreground hover:bg-surface-muted";
  }

  function typeBadgeClass(type: TypeFilter, active: boolean, disabled: boolean): string {
    if (disabled) {
      return disabledBadgeClass();
    }

    if (type === "radical") {
      return active
        ? "border-radical bg-radical text-white"
        : "border-radical/50 bg-radical/10 text-radical hover:bg-radical/20";
    }

    if (type === "kanji") {
      return active
        ? "border-kanji bg-kanji text-white"
        : "border-kanji/50 bg-kanji/10 text-kanji hover:bg-kanji/20";
    }

    if (type === "vocabulary") {
      return active
        ? "border-vocabulary bg-vocabulary text-white"
        : "border-vocabulary/50 bg-vocabulary/10 text-vocabulary hover:bg-vocabulary/20";
    }

    return badgeClass(active);
  }

  function subjectTypePillClass(type: LevelItem["subjectType"]): string {
    if (type === "radical") {
      return "subject-pill subject-pill--radical";
    }

    if (type === "kanji") {
      return "subject-pill subject-pill--kanji";
    }

    if (type === "vocabulary") {
      return "subject-pill subject-pill--vocabulary";
    }

    return "subject-pill";
  }

  function disabledBadgeClass(): string {
    return "cursor-not-allowed border-line bg-surface-muted text-foreground/45";
  }

  function typeCardClass(type: LevelItem["subjectType"], selected: boolean): string {
    const selectedRing = selected ? "ring-2 ring-accent" : "";
    if (type === "radical") {
      return `border-radical/50 bg-surface text-foreground ${selectedRing}`;
    }
    if (type === "kanji") {
      return `border-kanji/50 bg-surface text-foreground ${selectedRing}`;
    }
    if (type === "vocabulary") {
      return `border-vocabulary/50 bg-surface text-foreground ${selectedRing}`;
    }
    return `border-line bg-surface text-foreground ${selectedRing}`;
  }

  function lockedCardStateClass(item: LevelItem): string {
    if (item.status !== "locked" && item.srsStage > 0) {
      return "";
    }

    return "bg-surface-muted/90 text-foreground/60";
  }

  function typeGlyphBoxClass(type: LevelItem["subjectType"]): string {
    if (type === "radical") {
      return "border-radical/50 bg-radical/15 text-radical";
    }
    if (type === "kanji") {
      return "border-kanji/50 bg-kanji/15 text-kanji";
    }
    if (type === "vocabulary") {
      return "border-vocabulary/50 bg-vocabulary/15 text-vocabulary";
    }
    return "border-line bg-surface text-foreground";
  }

  function glyphTextSizeClass(characters: string): string {
    const length = Array.from(characters).length;
    if (length >= 5) {
      return "text-4xl";
    }
    if (length >= 3) {
      return "text-5xl";
    }
    return "text-6xl";
  }

  const kanjiByCharacter = useMemo(() => {
    return new Map(
      combinedSnapshot.items
        .filter((item) => item.subjectType === "kanji")
        .map((item) => [item.characters, item]),
    );
  }, [combinedSnapshot.items]);

  const subjectById = useMemo(() => {
    return new Map(combinedSnapshot.items.map((item) => [item.subjectId, item]));
  }, [combinedSnapshot.items]);

  const vocabularyKanjiLinks = useMemo(() => {
    if (!selectedItem || selectedItem.subjectType !== "vocabulary") {
      return [] as Array<{ char: string; subjectId: number; reading: string; wkLevel: number | null }>;
    }

    const componentLinks = (selectedItem.componentKanji ?? [])
      .map((component) => {
        const found = subjectById.get(component.subjectId);
        return {
          char: component.label,
          subjectId: component.subjectId,
          reading:
            typeof component.reading === "string" && component.reading.length > 0
              ? component.reading
              : found
                ? (found.primaryReadings ?? [])[0] ?? "-"
                : "-",
          wkLevel:
            typeof component.wkLevel === "number"
              ? component.wkLevel
              : typeof found?.wkLevel === "number"
                ? found.wkLevel
                : null,
        };
      })
      .filter((item) => Boolean(item.char));

    if (componentLinks.length > 0) {
      return componentLinks;
    }

    return Array.from(selectedItem.characters)
      .map((char) => {
        const found = kanjiByCharacter.get(char);
        if (!found) {
          return null;
        }

        return {
          char,
          subjectId: found.subjectId,
          reading: (found.primaryReadings ?? [])[0] ?? "-",
          wkLevel: typeof found.wkLevel === "number" ? found.wkLevel : null,
        };
      })
      .filter(
        (value): value is { char: string; subjectId: number; reading: string; wkLevel: number | null } =>
          value !== null,
      );
  }, [selectedItem, kanjiByCharacter, subjectById]);

  const hasPrimaryRelatedPanel = selectedItem
    ? selectedItem.subjectType === "vocabulary"
      ? vocabularyKanjiLinks.length > 0
      : (selectedItem.radicals?.length ?? 0) > 0
    : false;
  const hasVisuallySimilarPanel = (selectedItem?.visuallySimilar?.length ?? 0) > 0;
  const hasUsedInVocabularyPanel = (selectedItem?.usedInVocabulary?.length ?? 0) > 0;
  const selectedMeaningExplanation = stripHtml(selectedItem?.meaningExplanation) || "-";
  const selectedReadingExplanationRaw = stripHtml(selectedItem?.readingExplanation);
  const showReadingExplanation = selectedReadingExplanationRaw.length > 0;

  async function jumpToKanji(subjectId: number, wkLevel: number | null) {
    markHistoryPush();

    if (typeof wkLevel === "number") {
      await ensureLevelLoaded(wkLevel);
      setSelectedLevels((prev) => {
        if (stickyMerge) {
          const next = new Set(prev);
          next.add(wkLevel);
          return next;
        }

        return new Set([wkLevel]);
      });
    }

    setTypeFilter("kanji");
    setSrsFilter("all");
    setJlptFilter("all");
    setReviewTimingFilter("all");
    setSelectedSubjectId(subjectId);
  }

  async function searchAndReveal(rawQuery: string, requestId?: string) {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      if (typeof window !== "undefined" && requestId) {
        window.dispatchEvent(
          new CustomEvent("wr:explorer-search-complete", {
            detail: { requestId, ok: false, message: "Please enter a search term." },
          }),
        );
      }
      return;
    }

    setError("");
    let ok = false;
    let completionMessage = "";

    const matchesById = new Map<number, LevelItem>();

    function collectMatches(items: LevelItem[]) {
      for (const item of items) {
        if (itemMatchesLevelSearch(item, trimmed)) {
          matchesById.set(item.subjectId, item);
        }
      }
    }

    collectMatches(combinedSnapshot.items);

    for (let level = 1; level <= maxLevel; level += 1) {
      const snapshot = snapshotsByLevel.get(level) ?? (await ensureLevelLoaded(level));
      collectMatches(snapshot?.items ?? []);
    }

    const matchedItems = Array.from(matchesById.values()).sort((a, b) => {
      if ((a.wkLevel ?? 0) !== (b.wkLevel ?? 0)) {
        return (a.wkLevel ?? 0) - (b.wkLevel ?? 0);
      }
      return a.subjectId - b.subjectId;
    });

    if (matchedItems.length === 0) {
      completionMessage = `No item matched "${trimmed}".`;
      setError(completionMessage);
      setSearchMatchedSubjectIds(new Set());
      setSearchAvailableLevels(new Set());
    } else {
      markHistoryPush();

      const levelsWithMatches = new Set<number>();
      for (const item of matchedItems) {
        levelsWithMatches.add(typeof item.wkLevel === "number" ? item.wkLevel : initialSnapshot.level);
      }

      setSelectedLevels(levelsWithMatches.size > 0 ? levelsWithMatches : new Set([initialSnapshot.level]));
      setSearchAvailableLevels(levelsWithMatches);
      setVisibleTypesAndPersist({ radical: true, kanji: true, vocabulary: true });
      setTypeFilter("all");
      setSrsFilter("all");
      setJlptFilter("all");
      setReviewTimingFilter("all");
      setSelectedSubjectId(null);
      setSearchMatchedSubjectIds(new Set(matchedItems.map((item) => item.subjectId)));

      ok = true;
      completionMessage = `Found ${matchedItems.length} result${matchedItems.length === 1 ? "" : "s"}.`;
    }

    if (typeof window !== "undefined" && requestId) {
      window.dispatchEvent(
        new CustomEvent("wr:explorer-search-complete", {
          detail: { requestId, ok, message: completionMessage },
        }),
      );
    }
  }

  async function jumpToRelatedSubject(subjectId: number, targetLevel?: number | null) {
    markHistoryPush();

    if (typeof targetLevel === "number") {
      await ensureLevelLoaded(targetLevel);
      setSelectedLevels((prev) => {
        if (stickyMerge) {
          const next = new Set(prev);
          next.add(targetLevel);
          return next;
        }

        return new Set([targetLevel]);
      });
    }

    const found = subjectById.get(subjectId);

    if (found?.subjectType) {
      setTypeFilterAndEnsureVisible(found.subjectType);
    } else {
      setTypeFilter("all");
    }

    setSrsFilter("all");
    setJlptFilter("all");
    setReviewTimingFilter("all");

    setSelectedSubjectId(subjectId);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const runFromUrl = () => {
      const fromUrl = new URLSearchParams(window.location.search).get("findLevel");
      const trimmed = fromUrl?.trim() ?? "";
      if (!trimmed) {
        setSearchMatchedSubjectIds(null);
        setSearchAvailableLevels(null);
        return;
      }

      if (lastHandledFindQueryRef.current === trimmed) {
        return;
      }

      lastHandledFindQueryRef.current = trimmed;
      void searchAndReveal(trimmed);
    };

    runFromUrl();

    const onSearch = (event: Event) => {
      const custom = event as CustomEvent<{ query?: string; requestId?: string; scope?: "level" | "jlpt" }>;
      if (custom.detail?.scope === "jlpt") {
        return;
      }

      const query = custom.detail?.query ?? "";
      const requestId = custom.detail?.requestId;
      const trimmed = query.trim();
      if (!trimmed) {
        return;
      }

      lastHandledFindQueryRef.current = trimmed;
      void searchAndReveal(trimmed, requestId);
    };

    const onPopState = () => {
      runFromUrl();
    };

    const onClear = (event: Event) => {
      const custom = event as CustomEvent<{ scope?: "level" | "jlpt" | "all" }>;
      const scope = custom.detail?.scope ?? "all";
      if (scope !== "all" && scope !== "level") {
        return;
      }

      setSearchMatchedSubjectIds(null);
      setSearchAvailableLevels(null);
    };

    window.addEventListener("wr:explorer-search", onSearch as EventListener);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("wr:explorer-search-clear", onClear as EventListener);
    return () => {
      window.removeEventListener("wr:explorer-search", onSearch as EventListener);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("wr:explorer-search-clear", onClear as EventListener);
    };
  }, [combinedSnapshot.items, maxLevel, snapshotsByLevel]);

  function relatedReferenceCardClass(
    type: LevelItem["subjectType"],
    isClickable: boolean,
    size: "normal" | "large",
  ): string {
    const base =
      "rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70";
    const sizeClass = size === "large" ? "px-4 py-3" : "px-3 py-2";

    if (type === "radical") {
      return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-radical/50 bg-radical/10 text-radical hover:bg-radical/20" : "border-radical/30 bg-radical/5 text-radical/80"}`;
    }

    if (type === "kanji") {
      return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-kanji/50 bg-kanji/10 text-kanji hover:bg-kanji/20" : "border-kanji/30 bg-kanji/5 text-kanji/80"}`;
    }

    if (type === "vocabulary") {
      return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-vocabulary/50 bg-vocabulary/10 text-vocabulary hover:bg-vocabulary/20" : "border-vocabulary/30 bg-vocabulary/5 text-vocabulary/80"}`;
    }

    return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-line bg-surface text-foreground hover:bg-surface-muted" : "border-line bg-surface-muted text-foreground/60"}`;
  }

  function renderRelatedReferenceCards(items: RelatedReference[], options?: { large?: boolean }) {
    if (items.length === 0) {
      return <p className="mt-2 text-foreground/60">-</p>;
    }

    const size = options?.large ? "large" : "normal";

    function labelClass(label: string): string {
      if (size === "normal") {
        return "text-xl";
      }

      const length = Array.from(label).length;
      if (length <= 2) {
        return "text-4xl";
      }
      if (length <= 4) {
        return "text-3xl";
      }
      return "text-2xl";
    }

    const expandedItems = items.flatMap((item) => {
      const segments = item.label
        .split(/[、,]/)
        .map((segment) => segment.trim())
        .filter((segment) => Boolean(segment));

      if (segments.length <= 1) {
        return [item];
      }

      return segments.map((segment, index) => ({
        subjectId: item.subjectId,
        label: segment,
        wkLevel: item.wkLevel ?? null,
        reading: null,
        fallbackKey: `${item.subjectId}-${segment}-${index}`,
      }));
    });

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {expandedItems.map((entry, index) => {
          const item = {
            subjectId: entry.subjectId,
            label: entry.label,
            wkLevel: "wkLevel" in entry ? entry.wkLevel : null,
            reading: "reading" in entry ? entry.reading : null,
          };
          const linked = subjectById.get(item.subjectId) ?? null;
          const isClickable = linked !== null || typeof item.wkLevel === "number";
          const relationType = linked?.subjectType;
          const reading = typeof item.reading === "string" && item.reading.trim() ? item.reading : null;
          const subtitle = (() => {
            if (!reading) {
              return null;
            }

            if (!showEnglish) {
              return reading;
            }

            const pronunciation = pronunciationForReading(reading);
            return pronunciation ? `${reading} / ${pronunciation}` : reading;
          })();
          const key =
            "fallbackKey" in entry && typeof entry.fallbackKey === "string"
              ? entry.fallbackKey
              : `${item.subjectId}-${item.label}-${index}`;

          if (!isClickable) {
            return (
              <span
                key={key}
                className={`${relatedReferenceCardClass(relationType, false, size)} inline-flex flex-col items-center`}
              >
                <span className={`${labelClass(item.label)} font-black leading-none`}>{item.label}</span>
                {subtitle ? (
                  <span className="mt-1 text-center text-sm font-semibold leading-none text-foreground/70">
                    {subtitle}
                  </span>
                ) : null}
              </span>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                void jumpToRelatedSubject(item.subjectId, item.wkLevel ?? linked?.wkLevel ?? null);
              }}
              className={`${relatedReferenceCardClass(relationType, true, size)} inline-flex flex-col items-center`}
            >
              <span className={`${labelClass(item.label)} font-black leading-none`}>{item.label}</span>
              {subtitle ? (
                <span className="mt-1 text-center text-sm font-semibold leading-none text-foreground/70">
                  {subtitle}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  function renderVocabularyKanjiCards() {
    if (vocabularyKanjiLinks.length === 0) {
      return <p className="mt-2 text-foreground/60">-</p>;
    }

    return (
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {vocabularyKanjiLinks.map((item) => (
          (() => {
            const subtitle = (() => {
              if (!showEnglish) {
                return item.reading;
              }

              const pronunciation = pronunciationForReading(item.reading);
              return pronunciation ? `${item.reading} / ${pronunciation}` : item.reading;
            })();

            return (
          <button
            key={`${selectedItem?.subjectId ?? "vocab"}-${item.subjectId}`}
            type="button"
            onClick={() => jumpToKanji(item.subjectId, item.wkLevel)}
            className="inline-flex cursor-pointer flex-col items-center rounded-xl border border-kanji/50 bg-kanji/10 px-4 py-3 text-center text-kanji transition hover:bg-kanji/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            <span className="text-4xl font-black leading-none">{item.char}</span>
            {subtitle ? (
              <span className="mt-1 w-full text-center text-sm font-semibold leading-none text-foreground/70">
                {subtitle}
              </span>
            ) : null}
          </button>
            );
          })()
        ))}
      </div>
    );
  }

  return (
    <section id="explorer" className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
      <header className="flex flex-col gap-3 border-b border-line bg-surface-muted px-5 py-4">
        <div>
          <h2 className="text-xl font-black text-foreground">WaniKani Explorer</h2>
          <p className="text-xs uppercase tracking-[0.08em] text-foreground/70">
            Click one or more level badges to combine data
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void selectAllLevelsAndClearSearch();
            }}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
              searchAvailableLevels === null && selectedLevels.size === levelOptions.length,
            )}`}
          >
            All
          </button>
          {levelOptions.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              disabled={searchAvailableLevels !== null && !searchAvailableLevels.has(level)}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                selectedLevels.has(level),
              )}`}
            >
              L{level}
            </button>
          ))}
          </div>
          <button
            type="button"
            onClick={() => setStickyMergeAndPersist(!stickyMerge)}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
              stickyMerge
                ? "border-accent bg-accent text-white"
                : "border-line bg-surface text-foreground"
            }`}
            aria-pressed={stickyMerge}
          >
            Sticky {stickyMerge ? "On" : "Off"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={enableAllTypes}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
              visibleTypes.radical && visibleTypes.kanji && visibleTypes.vocabulary,
            )}`}
          >
            All ({formatNumber(counts.all)})
          </button>
          {([
            ["radical", counts.radical],
            ["kanji", counts.kanji],
            ["vocabulary", counts.vocabulary],
          ] as const).map(([type, count]) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleTypeVisibility(type)}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${typeBadgeClass(
                type,
                visibleTypes[type],
                false,
              )}`}
            >
              {type} ({formatNumber(count)})
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Selected levels</p>
          <p className="mt-1 text-2xl font-black text-foreground">{selectedLevelList.join(", ")}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Total Items</p>
          <p className="mt-1 text-2xl font-black text-foreground">{formatNumber(combinedSnapshot.items.length)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Kanji Learned</p>
          <p className="mt-1 text-2xl font-black text-accent">{formatNumber(combinedSnapshot.kanjiLearned)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Kanji Locked</p>
          <p className="mt-1 text-2xl font-black text-hot">{formatNumber(combinedSnapshot.kanjiLocked)}</p>
        </div>
      </div>

      <div className="border-b border-line px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">JLPT mix (kanji in selected levels)</p>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {([
            ["N5", jlptCounts.n5],
            ["N4", jlptCounts.n4],
            ["N3", jlptCounts.n3],
            ["N2", jlptCounts.n2],
            ["N1", jlptCounts.n1],
          ] as const).map(([label, count]) => (
            <div key={label} className="rounded-xl border border-line bg-surface-muted p-2 text-center">
              <p className="text-[10px] font-bold uppercase text-foreground/70">{label}</p>
              <p className="text-2xl font-black text-foreground">{formatNumber(count)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-line px-5 py-4">
        <section className="rounded-2xl border border-line bg-surface-muted/60 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/70">Filters</p>
            <button
              type="button"
              onClick={() => setFiltersCollapsedAndPersist(!filtersCollapsed)}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground"
              aria-expanded={!filtersCollapsed}
            >
              {filtersCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
          {!filtersCollapsed ? <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "apprentice", "guru", "master", "enlightened", "burned", "locked"] as const).map(
            (status) => (
              (() => {
                const count = counts[status];
                const disabled = status !== "all" && count === 0;

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSrsFilterWithHistory(status)}
                    disabled={disabled}
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                      disabled ? disabledBadgeClass() : badgeClass(srsFilter === status)
                    }`}
                  >
                    {status} ({formatNumber(count)})
                  </button>
                );
              })()
            ),
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "n5", "n4", "n3", "n2", "n1"] as const).map((level) => {
            const count = level === "all" ? counts.kanji : jlptCounts[level];
            const disabled = level !== "all" && count === 0;

            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  markHistoryPush();
                  setSelectedSubjectId(null);
                  setJlptFilter(level);
                  if (level !== "all") {
                    setTypeFilterAndEnsureVisible("kanji");
                  }
                }}
                disabled={disabled}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                  disabled ? disabledBadgeClass() : badgeClass(jlptFilter === level)
                }`}
              >
                {level === "all" ? "JLPT All" : level.toUpperCase()} ({formatNumber(count)})
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["all", "Review All", combinedSnapshot.items.length],
            ["overdue", "Overdue", reviewTimingCounts.overdue],
            ["next1h", "Starts <= 1h", reviewTimingCounts.next1h],
            ["next8h", "Starts <= 8h", reviewTimingCounts.next8h],
            ["next24h", "Starts <= 24h", reviewTimingCounts.next24h],
            ["next72h", "Starts <= 72h", reviewTimingCounts.next72h],
          ] as const).map(([timing, label, count]) => {
            const disabled = timing !== "all" && count === 0;

            return (
              <button
                key={timing}
                type="button"
                onClick={() => {
                  markHistoryPush();
                  setSelectedSubjectId(null);
                  setReviewTimingFilter(timing);
                }}
                disabled={disabled}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                  disabled ? disabledBadgeClass() : badgeClass(reviewTimingFilter === timing)
                }`}
              >
                {label} ({formatNumber(count)})
              </button>
            );
          })}
        </div>
          </div> : null}
        </section>
      </div>

      {loading ? <p className="px-5 py-4 text-sm text-foreground/70">Loading level data...</p> : null}
      {searchMatchedSubjectIds ? (
        <p className="px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/70">
          Showing {formatNumber(searchMatchedSubjectIds.size)} search result{searchMatchedSubjectIds.size === 1 ? "" : "s"}
        </p>
      ) : null}
      {error ? <p className="px-5 py-4 text-sm text-red-700">{error}</p> : null}

      <div className="p-5">
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-foreground/70">
            No items visible. Expand one or more types above.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filteredItems.map((item, index) => (
              <Fragment key={`${item.subjectType}-${item.subjectId}`}>
                <button
                  type="button"
                  onClick={() => {
                    markHistoryPush();
                    setSelectedSubjectId((prev) => (prev === item.subjectId ? null : item.subjectId));
                  }}
                  className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${typeCardClass(
                    item.subjectType,
                    selectedItem?.subjectId === item.subjectId,
                  )} ${lockedCardStateClass(item)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {selectedItem?.subjectId === item.subjectId ? (
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-accent/40 bg-accent/15 text-accent"
                        title="Viewing details. Click this card to close."
                        aria-label="Viewing details"
                      >
                        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                          <path
                            d="M8.5 14a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Zm0-1.7a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Zm4.6 1.2 3.2 3.2"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : (
                      <span />
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <span className={subjectTypePillClass(item.subjectType)}>{item.subjectType}</span>
                      {item.subjectType === "kanji" && item.jlptLevel ? (
                        <span className="subject-pill border-line bg-surface text-foreground">
                          N{item.jlptLevel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p
                    className={`mt-2 text-xl font-black leading-tight ${
                      item.status === "locked" || item.srsStage <= 0 ? "text-foreground/60" : "text-foreground"
                    }`}
                  >
                    {titleForDisplay(item, showEnglish)}
                  </p>
                  <div
                    className={`mt-3 rounded-xl border ${
                      glyphHasReading(item)
                        ? "flex min-h-[6rem] w-full flex-col items-center justify-center px-3 py-2"
                        : "flex min-h-[6rem] w-full items-center justify-center px-3 py-3"
                    } ${typeGlyphBoxClass(item.subjectType)} ${
                      item.status === "locked" || item.srsStage <= 0 ? "opacity-60" : ""
                    }`}
                  >
                    <p className={`${glyphTextSizeClass(item.characters)} font-black leading-none whitespace-nowrap`}>
                      {item.characters}
                    </p>
                    {(() => {
                      const subtitle = glyphSubtitleForDisplay(item);
                      if (!subtitle) {
                        return null;
                      }

                      return (
                        <p className="mt-1 w-full text-center text-sm font-semibold text-foreground/70 whitespace-nowrap">
                          <ReadingWithPronunciation reading={subtitle} />
                        </p>
                      );
                    })()}
                  </div>
                  <div className="mt-3 grid grid-cols-3 items-center gap-2">
                    <span
                      className={`justify-self-start rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(item.status)}`}
                    >
                      {item.status}
                    </span>
                    {item.status !== "burned" ? (
                      (() => {
                        const nextReviewBadge = formatNextReviewBadge(item.availableAt);
                        if (!nextReviewBadge) {
                          return <span />;
                        }

                        return (
                          <span
                            className={`justify-self-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.03em] ${nextReviewBadge.className}`}
                          >
                            {nextReviewBadge.label}
                          </span>
                        );
                      })()
                    ) : (
                      <span />
                    )}
                    <span className="justify-self-end rounded-full border border-line bg-surface px-2 py-1 text-xs font-bold text-foreground">
                      SRS {item.srsStage}
                    </span>
                  </div>
                </button>

                {selectedItem && index === detailInsertIndex ? (
                  <section className="col-span-1 rounded-2xl border-2 border-accent/35 bg-surface p-5 sm:col-span-2 lg:col-span-4">
                    <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-x-3">
                      <div className="row-span-2 inline-flex">
                        <div
                          className={`inline-flex rounded-2xl border ${
                            glyphHasReading(selectedItem)
                              ? "min-h-[5.75rem] min-w-[5.75rem] flex-col items-center justify-center px-4 py-3"
                              : "min-h-[5.75rem] min-w-[5.75rem] items-center justify-center px-4 py-3"
                          } ${typeGlyphBoxClass(selectedItem.subjectType)}`}
                        >
                          <div>
                            <h3 className="text-center text-4xl font-black leading-none text-current">{selectedItem.characters}</h3>
                            {(() => {
                              const subtitle = showEnglish
                                ? englishSubtitleForDisplay(selectedItem)
                                : glyphSubtitleForDisplay(selectedItem);
                              if (!subtitle) {
                                return null;
                              }

                              return (
                                <p className="mt-1 w-full text-center text-sm font-semibold text-foreground/85">
                                  <ReadingWithPronunciation reading={subtitle} />
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-start gap-1 sm:justify-end">
                        <span className={`subject-pill ${statusClass(selectedItem.status)}`}>{selectedItem.status}</span>
                        <span className={subjectTypePillClass(selectedItem.subjectType)}>{selectedItem.subjectType}</span>
                        <span className="subject-pill border-line bg-surface text-foreground">WK {selectedItem.wkLevel}</span>
                        {selectedItem.subjectType === "kanji" && selectedItem.jlptLevel ? (
                          <span className="subject-pill border-line bg-surface text-foreground">
                            N{selectedItem.jlptLevel}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-3xl font-black leading-tight text-foreground">
                          {titleForDisplay(selectedItem, showEnglish)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-foreground/70">Primary reading</p>
                        <p className="mt-1 font-semibold text-foreground/90">
                          {selectedItem.subjectType === "radical"
                            ? "Not applicable"
                            : (
                                <ReadingListWithPronunciation
                                  readings={selectedItem.primaryReadings ?? []}
                                  mode={showEnglish ? "inline" : "plain"}
                                />
                              )}
                        </p>
                      </div>
                      <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-foreground/70">Secondary readings</p>
                        <p className="mt-1 font-semibold text-foreground/90">
                          {selectedItem.subjectType === "radical"
                            ? "Not applicable"
                            : (
                                <ReadingListWithPronunciation
                                  readings={secondaryReadingsForDisplay(selectedItem)}
                                  mode={showEnglish ? "inline" : "plain"}
                                />
                              )}
                        </p>
                      </div>
                      <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-foreground/70">Started</p>
                        <p className="mt-1 font-semibold text-foreground/90">{formatDate(selectedItem.startedAt)}</p>
                      </div>
                      <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-foreground/70">Next review</p>
                        <p className="mt-1 font-semibold text-foreground/90">{formatDate(selectedItem.availableAt)}</p>
                      </div>
                      <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-foreground/70">Passed</p>
                        <p className="mt-1 font-semibold text-foreground/90">{formatDate(selectedItem.passedAt)}</p>
                      </div>
                    </div>

                    <div className={`mt-4 grid gap-3 ${showReadingExplanation ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
                      <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-foreground/70">Meaning explanation</p>
                        <p className="mt-2 text-foreground/90">{selectedMeaningExplanation}</p>
                      </article>
                      {showReadingExplanation ? (
                        <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                          <p className="text-xs font-bold uppercase text-foreground/70">Reading explanation</p>
                          <p className="mt-2 text-foreground/90">{selectedReadingExplanationRaw}</p>
                        </article>
                      ) : null}
                    </div>

                    <LevelRelatedPanels
                      hasPrimary={hasPrimaryRelatedPanel}
                      hasVisuallySimilar={hasVisuallySimilarPanel}
                      hasUsedInVocabulary={hasUsedInVocabularyPanel}
                      primaryTitle={selectedItem.subjectType === "vocabulary" ? "Kanji" : "Radicals"}
                      primaryContent={
                        selectedItem.subjectType === "vocabulary"
                          ? renderVocabularyKanjiCards()
                          : renderRelatedReferenceCards(selectedItem.radicals ?? [], {
                              large: selectedItem.subjectType === "kanji",
                            })
                      }
                      visuallySimilarContent={renderRelatedReferenceCards(selectedItem.visuallySimilar ?? [], {
                        large: selectedItem.subjectType === "kanji",
                      })}
                      usedInVocabularyContent={renderRelatedReferenceCards(selectedItem.usedInVocabulary ?? [], {
                        large: true,
                      })}
                    />
                  </section>
                ) : null}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
