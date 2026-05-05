import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import type { LevelItem, Snapshot, SrsFilter } from "../../explorerTypes";
import {
  JLPT_FILTER_ALLOWED,
  REVIEW_TIMING_ALLOWED,
  SRS_FILTER_ALLOWED,
  TYPE_FILTER_ALLOWED,
  parseLevelExplorerUrlState,
  persistEnum,
  persistFlag,
  persistOptionalPositiveInteger,
  readStoredEnum,
  readStoredFlag,
  readStoredPositiveInteger,
  readStoredTypeVisibility,
  type JlptFilter,
  type ReviewTimingFilter,
  type TypeFilter,
} from "./levelExplorerState";
import { passesReviewTimingFilter } from "./levelExplorerSelectors";

type BaseSetters = {
  setSelectedLevels: Dispatch<SetStateAction<Set<number>>>;
  setSelectedSubjectId: Dispatch<SetStateAction<number | null>>;
  setSrsFilter: Dispatch<SetStateAction<SrsFilter>>;
  setTypeFilter: Dispatch<SetStateAction<TypeFilter>>;
  setJlptFilter: Dispatch<SetStateAction<JlptFilter>>;
  setReviewTimingFilter: Dispatch<SetStateAction<ReviewTimingFilter>>;
  setRecentOnly: Dispatch<SetStateAction<boolean>>;
  setStickyMerge: Dispatch<SetStateAction<boolean>>;
};

function setsEqual(left: Set<number>, right: Set<number>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

export function useLevelExplorerUrlHydration({
  maxLevel,
  initialLevel,
  ensureLevelLoaded,
  applyingUrlStateRef,
  hasHydratedUrlStateRef,
  setSelectedLevels,
  setSelectedSubjectId,
  setSrsFilter,
  setTypeFilter,
  setJlptFilter,
  setReviewTimingFilter,
  setRecentOnly,
  setStickyMerge,
}: {
  maxLevel: number;
  initialLevel: number;
  ensureLevelLoaded: (level: number) => Promise<Snapshot | undefined>;
  applyingUrlStateRef: MutableRefObject<boolean>;
  hasHydratedUrlStateRef: MutableRefObject<boolean>;
} & BaseSetters) {
  const ensureLevelLoadedRef = useRef(ensureLevelLoaded);

  useEffect(() => {
    ensureLevelLoadedRef.current = ensureLevelLoaded;
  }, [ensureLevelLoaded]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyFromUrl = async () => {
      applyingUrlStateRef.current = true;
      const parsed = parseLevelExplorerUrlState(window.location.search, maxLevel, initialLevel);
      const levelsArray = Array.from(parsed.levels.values()).sort((a, b) => a - b);
      const normalizedLevels = parsed.stickyMerge
        ? new Set(levelsArray)
        : new Set([levelsArray[levelsArray.length - 1] ?? initialLevel]);

      const params = new URLSearchParams(window.location.search);
      setSelectedLevels((prev) => (setsEqual(prev, normalizedLevels) ? prev : normalizedLevels));
      if (params.has("subject")) setSelectedSubjectId(parsed.subjectId);
      if (params.has("srs")) setSrsFilter(parsed.srs);
      if (params.has("type")) setTypeFilter(parsed.type);
      if (params.has("jlpt")) setJlptFilter(parsed.jlpt);
      if (params.has("review")) setReviewTimingFilter(parsed.review);
      if (params.has("recent")) setRecentOnly(parsed.recentOnly);
      if (params.has("sticky")) setStickyMerge(parsed.stickyMerge);

      for (const level of normalizedLevels.values()) {
        await ensureLevelLoadedRef.current(level);
      }

      applyingUrlStateRef.current = false;
      hasHydratedUrlStateRef.current = true;
    };

    void applyFromUrl();

    const onPopState = () => {
      void applyFromUrl();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [
    applyingUrlStateRef,
    hasHydratedUrlStateRef,
    initialLevel,
    maxLevel,
    setJlptFilter,
    setRecentOnly,
    setReviewTimingFilter,
    setSelectedLevels,
    setSelectedSubjectId,
    setSrsFilter,
    setStickyMerge,
    setTypeFilter,
  ]);
}

export function useLevelExplorerStorageHydration({
  storageKeys,
  setVisibleTypes,
  setSelectedSubjectId,
  setStickyMerge,
  setFiltersCollapsed,
  setSrsFilter,
  setTypeFilter,
  setJlptFilter,
  setReviewTimingFilter,
  setRecentOnly,
  setShowLocked,
}: {
  storageKeys: {
    typeVisibility: string;
    selectedSubject: string;
    stickyMerge: string;
    filtersCollapsed: string;
    recentOnly: string;
    showLocked: string;
    srsFilter: string;
    typeFilter: string;
    jlptFilter: string;
    reviewTimingFilter: string;
  };
  setVisibleTypes: Dispatch<SetStateAction<{ radical: boolean; kanji: boolean; vocabulary: boolean }>>;
  setSelectedSubjectId: Dispatch<SetStateAction<number | null>>;
  setStickyMerge: Dispatch<SetStateAction<boolean>>;
  setFiltersCollapsed: Dispatch<SetStateAction<boolean>>;
  setSrsFilter: Dispatch<SetStateAction<SrsFilter>>;
  setTypeFilter: Dispatch<SetStateAction<TypeFilter>>;
  setJlptFilter: Dispatch<SetStateAction<JlptFilter>>;
  setReviewTimingFilter: Dispatch<SetStateAction<ReviewTimingFilter>>;
  setRecentOnly: Dispatch<SetStateAction<boolean>>;
  setShowLocked: Dispatch<SetStateAction<boolean>>;
}) {
  useEffect(() => {
    try {
      setVisibleTypes((prev) => readStoredTypeVisibility(window.localStorage, storageKeys.typeVisibility, prev));

      if (!new URLSearchParams(window.location.search).has("subject")) {
        const selected = readStoredPositiveInteger(window.localStorage, storageKeys.selectedSubject);
        if (selected !== null) {
          setSelectedSubjectId(selected);
        }
      }

      if (!new URLSearchParams(window.location.search).has("sticky") && readStoredFlag(window.localStorage, storageKeys.stickyMerge)) {
        setStickyMerge(true);
      }

      if (readStoredFlag(window.localStorage, storageKeys.filtersCollapsed)) {
        setFiltersCollapsed(true);
      }

      if (!new URLSearchParams(window.location.search).has("recent") && readStoredFlag(window.localStorage, storageKeys.recentOnly)) {
        setRecentOnly(true);
      }

      if (readStoredFlag(window.localStorage, storageKeys.showLocked)) {
        setShowLocked(true);
      }

      if (!new URLSearchParams(window.location.search).has("srs")) {
        const srs = readStoredEnum(window.localStorage, storageKeys.srsFilter, SRS_FILTER_ALLOWED);
        if (srs) {
          setSrsFilter(srs);
        }
      }

      if (!new URLSearchParams(window.location.search).has("type")) {
        const type = readStoredEnum(window.localStorage, storageKeys.typeFilter, TYPE_FILTER_ALLOWED);
        if (type) {
          setTypeFilter(type);
        }
      }

      if (!new URLSearchParams(window.location.search).has("jlpt")) {
        const jlpt = readStoredEnum(window.localStorage, storageKeys.jlptFilter, JLPT_FILTER_ALLOWED);
        if (jlpt) {
          setJlptFilter(jlpt);
        }
      }

      if (!new URLSearchParams(window.location.search).has("review")) {
        const review = readStoredEnum(window.localStorage, storageKeys.reviewTimingFilter, REVIEW_TIMING_ALLOWED);
        if (review) {
          setReviewTimingFilter(review);
        }
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [
    setFiltersCollapsed,
    setJlptFilter,
    setRecentOnly,
    setReviewTimingFilter,
    setSelectedSubjectId,
    setShowLocked,
    setSrsFilter,
    setStickyMerge,
    setTypeFilter,
    setVisibleTypes,
    storageKeys,
  ]);
}

export function useLevelExplorerGridColumns(setGridColumns: Dispatch<SetStateAction<number>>) {
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
  }, [setGridColumns]);
}

export function useLevelExplorerStoragePersistence({
  storageKeys,
  srsFilter,
  typeFilter,
  jlptFilter,
  reviewTimingFilter,
  recentOnly,
  showLocked,
  selectedSubjectId,
}: {
  storageKeys: {
    selectedSubject: string;
    recentOnly: string;
    showLocked: string;
    srsFilter: string;
    typeFilter: string;
    jlptFilter: string;
    reviewTimingFilter: string;
  };
  srsFilter: SrsFilter;
  typeFilter: TypeFilter;
  jlptFilter: JlptFilter;
  reviewTimingFilter: ReviewTimingFilter;
  recentOnly: boolean;
  showLocked: boolean;
  selectedSubjectId: number | null;
}) {
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    try {
      persistEnum(window.localStorage, storageKeys.srsFilter, srsFilter);
      persistEnum(window.localStorage, storageKeys.typeFilter, typeFilter);
      persistEnum(window.localStorage, storageKeys.jlptFilter, jlptFilter);
      persistEnum(window.localStorage, storageKeys.reviewTimingFilter, reviewTimingFilter);
      persistFlag(window.localStorage, storageKeys.recentOnly, recentOnly);
      persistFlag(window.localStorage, storageKeys.showLocked, showLocked);
      persistOptionalPositiveInteger(window.localStorage, storageKeys.selectedSubject, selectedSubjectId);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [srsFilter, typeFilter, jlptFilter, reviewTimingFilter, recentOnly, showLocked, selectedSubjectId, storageKeys]);
}

export function useLevelExplorerSelectionReconcile({
  selectedItem,
  selectedItemFromAll,
  typeFilter,
  visibleTypes,
  srsFilter,
  jlptFilter,
  reviewTimingFilter,
  hasHydratedUrlStateRef,
  setTypeFilter,
  setVisibleTypesAndPersist,
  setSrsFilter,
  setJlptFilter,
  setReviewTimingFilter,
}: {
  selectedItem: LevelItem | null;
  selectedItemFromAll: LevelItem | null;
  typeFilter: TypeFilter;
  visibleTypes: { radical: boolean; kanji: boolean; vocabulary: boolean };
  srsFilter: SrsFilter;
  jlptFilter: JlptFilter;
  reviewTimingFilter: ReviewTimingFilter;
  hasHydratedUrlStateRef: MutableRefObject<boolean>;
  setTypeFilter: Dispatch<SetStateAction<TypeFilter>>;
  setVisibleTypesAndPersist: (next: { radical: boolean; kanji: boolean; vocabulary: boolean }) => void;
  setSrsFilter: Dispatch<SetStateAction<SrsFilter>>;
  setJlptFilter: Dispatch<SetStateAction<JlptFilter>>;
  setReviewTimingFilter: Dispatch<SetStateAction<ReviewTimingFilter>>;
}) {
  useEffect(() => {
    if (!hasHydratedUrlStateRef.current) {
      return;
    }

    if (!selectedItemFromAll || selectedItem) {
      return;
    }

    if (selectedItemFromAll.subjectType && typeFilter !== selectedItemFromAll.subjectType) {
      setTypeFilter(selectedItemFromAll.subjectType);
    }

    if (selectedItemFromAll.subjectType && !visibleTypes[selectedItemFromAll.subjectType]) {
      setVisibleTypesAndPersist({ ...visibleTypes, [selectedItemFromAll.subjectType]: true });
    }

    if (srsFilter !== "all" && selectedItemFromAll.status !== srsFilter) {
      setSrsFilter("all");
    }

    if (jlptFilter !== "all") {
      const matchesJlpt =
        jlptFilter === "none"
          ? !selectedItemFromAll.jlptLevel
          : selectedItemFromAll.subjectType === "kanji" &&
            selectedItemFromAll.jlptLevel === Number(jlptFilter.slice(1));
      if (!matchesJlpt) {
        setJlptFilter("all");
      }
    }

    if (!passesReviewTimingFilter(selectedItemFromAll, reviewTimingFilter)) {
      setReviewTimingFilter("all");
    }
  }, [
    hasHydratedUrlStateRef,
    jlptFilter,
    reviewTimingFilter,
    selectedItem,
    selectedItemFromAll,
    setJlptFilter,
    setReviewTimingFilter,
    setSrsFilter,
    setTypeFilter,
    setVisibleTypesAndPersist,
    srsFilter,
    typeFilter,
    visibleTypes,
  ]);
}

export function useLevelExplorerSearchEvents({
  searchAndReveal,
  setSearchMatchedSubjectIds,
  setSearchAvailableLevels,
  lastHandledFindQueryRef,
}: {
  searchAndReveal: (query: string, requestId?: string) => Promise<void>;
  setSearchMatchedSubjectIds: Dispatch<SetStateAction<Set<number> | null>>;
  setSearchAvailableLevels: Dispatch<SetStateAction<Set<number> | null>>;
  lastHandledFindQueryRef: MutableRefObject<string>;
}) {
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

    const onClear = (event: Event) => {
      const custom = event as CustomEvent<{ scope?: "level" | "jlpt" | "all" }>;
      const scope = custom.detail?.scope ?? "all";
      if (scope === "all" || scope === "level") {
        setSearchMatchedSubjectIds(null);
        setSearchAvailableLevels(null);
      }
    };

    window.addEventListener("wr:explorer-search", onSearch as EventListener);
    window.addEventListener("popstate", runFromUrl);
    window.addEventListener("wr:explorer-search-clear", onClear as EventListener);
    return () => {
      window.removeEventListener("wr:explorer-search", onSearch as EventListener);
      window.removeEventListener("popstate", runFromUrl);
      window.removeEventListener("wr:explorer-search-clear", onClear as EventListener);
    };
  }, [searchAndReveal, setSearchMatchedSubjectIds, setSearchAvailableLevels, lastHandledFindQueryRef]);
}
