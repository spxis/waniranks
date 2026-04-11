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
    const visibleCount = Number(visibleTypes.radical) + Number(visibleTypes.kanji) + Number(visibleTypes.vocabulary);
    if (visibleTypes[type] && visibleCount === 1) {
      return;
    }

    setVisibleTypesAndPersist({ ...visibleTypes, [type]: !visibleTypes[type] });
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
        srsFilter,
        typeFilter,
        jlptFilter,
        reviewTimingFilter,
        visibleTypes,
        searchMatchedSubjectIds,
      }),
    [
      combinedSnapshot.items,
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

  const kanjiByCharacter = useMemo(
    () => new Map(combinedSnapshot.items.filter((item) => item.subjectType === "kanji").map((item) => [item.characters, item])),
    [combinedSnapshot.items],
  );
  const subjectById = useMemo(() => new Map(combinedSnapshot.items.map((item) => [item.subjectId, item])), [combinedSnapshot.items]);

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
      .filter((value): value is { char: string; subjectId: number; reading: string; wkLevel: number | null } => value !== null);
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
  });

  useLevelExplorerGridColumns(setGridColumns);

  useLevelExplorerStoragePersistence({
    storageKeys,
    srsFilter,
    typeFilter,
    jlptFilter,
    reviewTimingFilter,
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
      combinedItemLength={combinedSnapshot.items.length}
      combinedKanjiLearned={combinedSnapshot.kanjiLearned}
      combinedKanjiLocked={combinedSnapshot.kanjiLocked}
      selectedLevelList={selectedLevelList}
      filtersCollapsed={filtersCollapsed}
      srsFilter={srsFilter}
      jlptFilter={jlptFilter}
      reviewTimingFilter={reviewTimingFilter}
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
      onSetSelectedSubjectId={setSelectedSubjectId}
      onJumpToRelatedSubject={actions.jumpToRelatedSubject}
      onJumpToKanji={actions.jumpToKanji}
      onMarkHistoryPush={markHistoryPush}
    />
  );
}
