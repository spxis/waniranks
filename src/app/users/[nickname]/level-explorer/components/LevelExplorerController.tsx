"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import LevelExplorerContent from "./LevelExplorerContent";
import type { LevelItem, Snapshot, SrsFilter } from "../../explorerTypes";
import { stripHtml } from "../lib/levelExplorerDisplay";
import { buildLevelExplorerActions } from "../lib/levelExplorerControllerActions";
import {
  useLevelExplorerGridColumns,
  useLevelExplorerSearchEvents,
  useLevelExplorerSelectionReconcile,
  useLevelExplorerStorageHydration,
  useLevelExplorerStoragePersistence,
  useLevelExplorerUrlHydration,
} from "../lib/levelExplorerControllerEffects";
import {
  buildLevelExplorerStorageKeys,
  buildLevelExplorerUrl,
  persistFlag,
  persistTypeVisibility,
  type JlptFilter,
  type ReviewTimingFilter,
  type TypeFilter,
} from "../lib/levelExplorerState";
import {
  buildCombinedSnapshot,
  computeJlptCounts,
  computeLevelItemCounts,
  computeReviewTimingCounts,
  filterAndSortLevelItems,
} from "../lib/levelExplorerSelectors";
import {
  buildKanjiByCharacter,
  buildSubjectById,
  buildVocabularyKanjiLinks,
} from "../lib/levelExplorerItemDetails";
import {
  normalizeSnapshot,
  snapshotHasComponentKanjiData,
} from "../lib/levelExplorerSnapshotUtils";

type Props = {
  accountId: string;
  maxLevel: number;
  accountPendingReviews: number;
  initialSnapshot: Snapshot;
  initialSrsFilter?: SrsFilter;
  showEnglish?: boolean;
  studyMode?: boolean;
};

export default function LevelExplorerController({
  accountId,
  maxLevel,
  accountPendingReviews,
  initialSnapshot,
  initialSrsFilter = "all",
  showEnglish = false,
  studyMode = false,
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
  const [recentOnly, setRecentOnly] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    initialSnapshot.items[0]?.subjectId ?? null,
  );
  const [visibleTypes, setVisibleTypes] = useState({ radical: true, kanji: true, vocabulary: true });
  const [stickyMerge, setStickyMerge] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchMatchedSubjectIds, setSearchMatchedSubjectIds] = useState<Set<number> | null>(null);
  const [searchAvailableLevels, setSearchAvailableLevels] = useState<Set<number> | null>(null);
  const [gridColumns, setGridColumns] = useState(1);

  const applyingUrlStateRef = useRef(false);
  const hasHydratedUrlStateRef = useRef(false);
  const pendingHistoryModeRef = useRef<"replace" | "push">("replace");
  const lastHandledFindQueryRef = useRef("");

  const levelOptions = useMemo(() => Array.from({ length: maxLevel }, (_, index) => index + 1), [maxLevel]);

  const markHistoryPush = () => {
    pendingHistoryModeRef.current = "push";
  };

  const writeUrlState = () => {
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
      recentOnly,
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
  };

  const ensureLevelLoaded = async (level: number, forceReload = false): Promise<Snapshot | undefined> => {
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
  };

  const setVisibleTypesAndPersist = (next: typeof visibleTypes) => {
    const hasAtLeastOneVisible = next.radical || next.kanji || next.vocabulary;
    const normalized = hasAtLeastOneVisible ? next : { radical: true, kanji: true, vocabulary: true };

    setVisibleTypes(normalized);
    try {
      persistTypeVisibility(window.localStorage, storageKeys.typeVisibility, normalized);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  };

  const setTypeFilterAndEnsureVisible = (nextType: TypeFilter) => {
    markHistoryPush();
    setTypeFilter(nextType);

    if (nextType !== "all" && !visibleTypes[nextType]) {
      setVisibleTypesAndPersist({ ...visibleTypes, [nextType]: true });
    }
  };

  const setStickyMergeAndPersist = (next: boolean) => {
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
  };

  const setFiltersCollapsedAndPersist = (next: boolean) => {
    setFiltersCollapsed(next);
    try {
      persistFlag(window.localStorage, storageKeys.filtersCollapsed, next);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  };

  const setSrsFilterWithHistory = (nextStatus: SrsFilter) => {
    markHistoryPush();
    setSelectedSubjectId(null);
    setSrsFilter(nextStatus);
  };

  const toggleTypeVisibility = (type: "radical" | "kanji" | "vocabulary") => {
    markHistoryPush();
    setVisibleTypesAndPersist({
      radical: type === "radical",
      kanji: type === "kanji",
      vocabulary: type === "vocabulary",
    });
    setSelectedSubjectId(null);
    setTypeFilter("all");
  };

  const enableAllTypes = () => {
    markHistoryPush();
    setVisibleTypesAndPersist({ radical: true, kanji: true, vocabulary: true });
    setSelectedSubjectId(null);
    setTypeFilter("all");
  };

  const combinedSnapshot = useMemo(
    () => buildCombinedSnapshot(selectedLevels, snapshotsByLevel, normalizeSnapshot(initialSnapshot)),
    [initialSnapshot, selectedLevels, snapshotsByLevel],
  );

  const filteredItems = useMemo(
    () =>
      filterAndSortLevelItems(combinedSnapshot.items, {
        recentOnly,
        showLocked,
        srsFilter,
        typeFilter,
        jlptFilter,
        reviewTimingFilter,
        visibleTypes,
        searchMatchedSubjectIds,
      }),
    [
      combinedSnapshot.items,
      recentOnly,
      showLocked,
      srsFilter,
      typeFilter,
      jlptFilter,
      reviewTimingFilter,
      visibleTypes,
      searchMatchedSubjectIds,
    ],
  );

  const selectedItem = filteredItems.find((item) => item.subjectId === selectedSubjectId) ?? null;
  const selectedItemFromAll =
    selectedSubjectId === null ? null : combinedSnapshot.items.find((item) => item.subjectId === selectedSubjectId) ?? null;

  const counts = useMemo(() => computeLevelItemCounts(combinedSnapshot.items), [combinedSnapshot.items]);
  const jlptCounts = useMemo(() => computeJlptCounts(combinedSnapshot.items), [combinedSnapshot.items]);
  const reviewTimingCounts = useMemo(
    () => computeReviewTimingCounts(combinedSnapshot.items),
    [combinedSnapshot.items],
  );
  const overdueOutsideSelectedLevels = Math.max(0, accountPendingReviews - reviewTimingCounts.overdue);
  const selectedLevelList = Array.from(selectedLevels.values()).sort((a, b) => a - b);
  const subjectById = useMemo(() => buildSubjectById(combinedSnapshot.items), [combinedSnapshot.items]);
  const kanjiByCharacter = useMemo(() => buildKanjiByCharacter(combinedSnapshot.items), [combinedSnapshot.items]);

  const vocabularyKanjiLinks = useMemo(
    () => buildVocabularyKanjiLinks(selectedItem, subjectById, kanjiByCharacter),
    [selectedItem, subjectById, kanjiByCharacter],
  );

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

  const actions = buildLevelExplorerActions({
    maxLevel,
    initialLevel: initialSnapshot.level,
    levelOptions,
    stickyMerge,
    selectedLevels,
    searchAvailableLevels,
    snapshotsByLevel,
    subjectById,
    combinedItems: combinedSnapshot.items,
    markHistoryPush,
    ensureLevelLoaded: (level) => ensureLevelLoaded(level),
    setError,
    setSelectedSubjectId,
    setSelectedLevels,
    setSearchMatchedSubjectIds,
    setSearchAvailableLevels,
    setVisibleTypesAndPersist,
    setTypeFilterAndEnsureVisible,
    setRecentOnly,
    setTypeFilter,
    setSrsFilter,
    setJlptFilter,
    setReviewTimingFilter,
  });

  useLevelExplorerUrlHydration({
    maxLevel,
    initialLevel: initialSnapshot.level,
    ensureLevelLoaded: (level) => ensureLevelLoaded(level),
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
  });

  useEffect(() => {
    if (!hasHydratedUrlStateRef.current || applyingUrlStateRef.current) {
      return;
    }

    writeUrlState();
  }, [selectedLevels, selectedSubjectId, srsFilter, typeFilter, jlptFilter, reviewTimingFilter, stickyMerge]);

  useLevelExplorerStorageHydration({
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
  });

  useLevelExplorerGridColumns(setGridColumns);

  useLevelExplorerStoragePersistence({
    storageKeys,
    srsFilter,
    typeFilter,
    jlptFilter,
    reviewTimingFilter,
    recentOnly,
    selectedSubjectId,
  });

  useEffect(() => {
    const current = snapshotsByLevel.get(initialSnapshot.level);
    if (current && !snapshotHasComponentKanjiData(current)) {
      void ensureLevelLoaded(initialSnapshot.level, true);
    }
  }, [initialSnapshot.level, snapshotsByLevel]);

  useLevelExplorerSelectionReconcile({
    selectedItem,
    selectedItemFromAll,
    typeFilter,
    visibleTypes,
    srsFilter,
    jlptFilter,
    reviewTimingFilter,
    setTypeFilter,
    setVisibleTypesAndPersist,
    setSrsFilter,
    setJlptFilter,
    setReviewTimingFilter,
  });

  useLevelExplorerSearchEvents({
    searchAndReveal: actions.searchAndReveal,
    setSearchMatchedSubjectIds,
    setSearchAvailableLevels,
    lastHandledFindQueryRef,
  });

  return (
    <LevelExplorerContent
      accountId={accountId}
      levelOptions={levelOptions}
      selectedLevels={selectedLevels}
      searchAvailableLevels={searchAvailableLevels}
      stickyMerge={stickyMerge}
      visibleTypes={visibleTypes}
      counts={counts}
      jlptCounts={jlptCounts}
      reviewTimingCounts={reviewTimingCounts}
      accountPendingReviews={accountPendingReviews}
      overdueOutsideSelectedLevels={overdueOutsideSelectedLevels}
      selectedLevelList={selectedLevelList}
      filtersCollapsed={filtersCollapsed}
      srsFilter={srsFilter}
      jlptFilter={jlptFilter}
      reviewTimingFilter={reviewTimingFilter}
      recentOnly={recentOnly}
      showLocked={showLocked}
      showEnglish={showEnglish}
      studyMode={studyMode}
      loading={loading}
      gridColumns={gridColumns}
      searchMatchedSubjectIds={searchMatchedSubjectIds}
      error={error}
      filteredItems={filteredItems}
      selectedItem={selectedItem}
      selectedMeaningExplanation={selectedMeaningExplanation}
      selectedReadingExplanationRaw={selectedReadingExplanationRaw}
      showReadingExplanation={showReadingExplanation}
      hasPrimaryRelatedPanel={hasPrimaryRelatedPanel}
      hasVisuallySimilarPanel={hasVisuallySimilarPanel}
      hasUsedInVocabularyPanel={hasUsedInVocabularyPanel}
      vocabularyKanjiLinks={vocabularyKanjiLinks}
      subjectById={subjectById}
      onSelectAllLevelsAndClearSearch={actions.selectAllLevelsAndClearSearch}
      onToggleLevel={actions.toggleLevel}
      onSetStickyMerge={setStickyMergeAndPersist}
      onEnableAllTypes={enableAllTypes}
      onToggleTypeVisibility={toggleTypeVisibility}
      onSetFiltersCollapsed={setFiltersCollapsedAndPersist}
      onSetSrsFilter={setSrsFilterWithHistory}
      onSetJlptFilter={(level) => {
        markHistoryPush();
        setSelectedSubjectId(null);
        setJlptFilter(level);
        if (level !== "all") {
          setTypeFilterAndEnsureVisible("kanji");
        }
      }}
      onSetReviewTimingFilter={(timing) => {
        markHistoryPush();
        setSelectedSubjectId(null);
        setReviewTimingFilter(timing);
      }}
      onSetRecentOnly={(next) => {
        markHistoryPush();
        setSelectedSubjectId(null);
        setRecentOnly(next);
      }}
      onSetShowLocked={(next) => {
        markHistoryPush();
        setSelectedSubjectId(null);
        setShowLocked(next);
      }}
      onSetSelectedSubjectId={setSelectedSubjectId}
      onJumpToRelatedSubject={actions.jumpToRelatedSubject}
      onJumpToKanji={actions.jumpToKanji}
      onMarkHistoryPush={markHistoryPush}
    />
  );
}
