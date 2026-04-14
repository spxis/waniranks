"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import StudyExplorerModal from "./StudyExplorerModal";
import StudyExplorerPanel from "./StudyExplorerPanel";
import type {
  QueueResponse,
  ReviewOutcome,
  StudyCounts,
  StudyExplorerProps,
  StudyQueueItem,
  StudySrsFilter,
  StudyTypeFilter,
  SubmitFeedback,
  SubmitInFlight,
} from "../lib/studyExplorerTypes";
import {
  fetchStudyQueue,
  filterStudyItems,
  isRecentStudyItem,
  readStoredQueue,
} from "../lib/studyExplorerUtils";
import { useStudyReviewSubmission } from "../lib/useStudyReviewSubmission";
import { useStudyExplorerEffects } from "../lib/useStudyExplorerEffects";

const API_PAGE_SIZE = 120;

function sameAssignmentList(a: StudyQueueItem[], b: StudyQueueItem[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index]?.assignmentId !== b[index]?.assignmentId) {
      return false;
    }
  }

  return true;
}

export default function StudyExplorer({
  accountId,
  maxLevel,
  showEnglish,
  onToggleShowEnglish,
  canToggleEnglish,
  studyMode,
  queueMode,
}: StudyExplorerProps) {
  const countsStorageKey = `wr:study-queue-counts:${accountId}`;
  const selectedSubjectStorageKey = `wr:study-selected-subject:${accountId}:${queueMode}`;
  const typeFilterStorageKey = `wr:study-type-filter:${accountId}:${queueMode}`;
  const recentOnlyStorageKey = `wr:study-recent-only:${accountId}:${queueMode}`;
  const showLockedStorageKey = `wr:study-show-locked:${accountId}:${queueMode}`;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastHandledStudyQueryRef = useRef("");

  const [cachedQueueData, setCachedQueueData] = useState<QueueResponse | undefined>(() =>
    readStoredQueue(accountId, queueMode),
  );
  const [persistedCounts, setPersistedCounts] = useState<StudyCounts | null>(null);
  const [loadedItems, setLoadedItems] = useState<StudyQueueItem[]>(() => cachedQueueData?.items ?? []);
  const [totalItems, setTotalItems] = useState<number>(
    () => cachedQueueData?.pagination?.total ?? cachedQueueData?.items.length ?? 0,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [viewedLevel, setViewedLevel] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<StudyTypeFilter>("all");
  const [srsFilter, setSrsFilter] = useState<StudySrsFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submittingByAssignmentId, setSubmittingByAssignmentId] = useState<Set<number>>(new Set());
  const [revealedAssignmentIds, setRevealedAssignmentIds] = useState<Set<number>>(new Set());
  const [submitFeedback, setSubmitFeedback] = useState<SubmitFeedback | null>(null);
  const [submitInFlight, setSubmitInFlight] = useState<SubmitInFlight | null>(null);
  const [reviewOutcomeByAssignmentId, setReviewOutcomeByAssignmentId] = useState<Record<number, ReviewOutcome>>({});
  const [modalSessionOrderByAssignmentId, setModalSessionOrderByAssignmentId] = useState<number[] | null>(null);
  const [modalSessionItemByAssignmentId, setModalSessionItemByAssignmentId] = useState<Record<number, StudyQueueItem>>({});
  const [hiddenSubmittedAssignmentIds, setHiddenSubmittedAssignmentIds] = useState<Set<number>>(new Set());
  const [hasPendingStudySubmissions, setHasPendingStudySubmissions] = useState(false);
  const [showLocked, setShowLocked] = useState(true);
  const [recentOnly, setRecentOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasHydratedTypeFilter, setHasHydratedTypeFilter] = useState(false);
  const isModalOpen = selectedId !== null;
  const effectiveSrsFilter: StudySrsFilter = queueMode === "lesson" ? "all" : srsFilter;

  const { data, error, isLoading, isValidating, mutate: mutateQueue } = useSWR(
    `/api/study/${accountId}/queue?mode=${queueMode}&limit=${API_PAGE_SIZE}&offset=0`,
    fetchStudyQueue,
    {
      fallbackData: cachedQueueData,
      keepPreviousData: true,
      refreshInterval: isModalOpen ? 0 : 30_000,
      revalidateOnFocus: !isModalOpen,
    },
  );
  const isUnauthorized = Boolean(error && /unauthorized/i.test(error.message));

  const counts = data?.counts ?? persistedCounts;
  const hasMorePages = loadedItems.length < totalItems;

  useEffect(() => {
    if (!counts || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(countsStorageKey, JSON.stringify(counts));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }

    window.dispatchEvent(
      new CustomEvent("wr:study-counts-updated", {
        detail: {
          accountId,
          reviews: counts.reviews,
          lessons: counts.lessons,
        },
      }),
    );
  }, [accountId, counts, countsStorageKey]);

  const levelOptions = useMemo(
    () => Array.from({ length: Math.max(1, maxLevel) }, (_, index) => index + 1),
    [maxLevel],
  );

  const availableLevels = useMemo(() => {
    const output = new Set<number>();
    for (const item of loadedItems) {
      if (recentOnly && !isRecentStudyItem(item)) {
        continue;
      }
      if (item.queueType === queueMode && typeof item.wkLevel === "number") {
        output.add(item.wkLevel);
      }
    }
    return output;
  }, [loadedItems, queueMode, recentOnly]);

  const filteredItems = useMemo(
    () =>
      filterStudyItems(
        loadedItems,
        queueMode,
        viewedLevel,
        typeFilter,
        effectiveSrsFilter,
        showLocked,
        recentOnly,
        searchQuery,
      ),
    [loadedItems, queueMode, viewedLevel, typeFilter, effectiveSrsFilter, showLocked, recentOnly, searchQuery],
  );

  const lessonLevelCountsFromLoaded = useMemo(() => {
    const countsByLevel: Record<number, number> = {};

    for (const item of loadedItems) {
      if (item.queueType !== "lesson") {
        continue;
      }
      if (recentOnly && !isRecentStudyItem(item)) {
        continue;
      }
      if (typeFilter !== "all" && item.subjectType !== typeFilter) {
        continue;
      }
      if (!showLocked && item.status === "locked") {
        continue;
      }
      if (typeof item.wkLevel !== "number") {
        continue;
      }

      countsByLevel[item.wkLevel] = (countsByLevel[item.wkLevel] ?? 0) + 1;
    }

    return countsByLevel;
  }, [loadedItems, recentOnly, showLocked, typeFilter]);

  const lessonLevelCountsFromServer = useMemo(() => {
    const raw = data?.levelCounts ?? cachedQueueData?.levelCounts;
    if (!raw) {
      return {} as Record<number, number>;
    }

    const normalized: Record<number, number> = {};
    for (const [levelRaw, count] of Object.entries(raw)) {
      const level = Number(levelRaw);
      if (!Number.isInteger(level) || level <= 0 || typeof count !== "number" || count <= 0) {
        continue;
      }
      normalized[level] = count;
    }

    return normalized;
  }, [cachedQueueData?.levelCounts, data?.levelCounts]);

  const lessonLevelCounts = useMemo(() => {
    if (queueMode !== "lesson") {
      return lessonLevelCountsFromLoaded;
    }

    return Object.keys(lessonLevelCountsFromServer).length > 0
      ? lessonLevelCountsFromServer
      : lessonLevelCountsFromLoaded;
  }, [lessonLevelCountsFromLoaded, lessonLevelCountsFromServer, queueMode]);

  const filteredItemByAssignmentId = useMemo(() => {
    const map = new Map<number, StudyQueueItem>();
    for (const item of filteredItems) {
      map.set(item.assignmentId, item);
    }
    return map;
  }, [filteredItems]);

  const typeCounts = useMemo(() => {
    const out = { all: 0, radical: 0, kanji: 0, vocabulary: 0 };
    for (const item of loadedItems) {
      if (recentOnly && !isRecentStudyItem(item)) continue;
      if (item.queueType !== queueMode) continue;
      if (viewedLevel !== null && item.wkLevel !== viewedLevel) continue;
      if (effectiveSrsFilter !== "all" && item.status !== effectiveSrsFilter) continue;
      if (!showLocked && item.status === "locked") continue;

      out.all += 1;
      if (item.subjectType === "radical") out.radical += 1;
      else if (item.subjectType === "kanji") out.kanji += 1;
      else out.vocabulary += 1;
    }
    return out;
  }, [loadedItems, queueMode, recentOnly, viewedLevel, effectiveSrsFilter, showLocked]);

  const srsCounts = useMemo(() => {
    const out = { all: 0, locked: 0, apprentice: 0, guru: 0, master: 0, enlightened: 0 };
    for (const item of loadedItems) {
      if (recentOnly && !isRecentStudyItem(item)) continue;
      if (item.queueType !== queueMode) continue;
      if (viewedLevel !== null && item.wkLevel !== viewedLevel) continue;
      if (typeFilter !== "all" && item.subjectType !== typeFilter) continue;
      if (!showLocked && item.status === "locked") continue;

      out.all += 1;
      if (item.status === "locked") out.locked += 1;
      if (item.status === "apprentice") out.apprentice += 1;
      if (item.status === "guru") out.guru += 1;
      if (item.status === "master") out.master += 1;
      if (item.status === "enlightened") out.enlightened += 1;
    }
    return out;
  }, [loadedItems, queueMode, recentOnly, viewedLevel, typeFilter, showLocked]);

  const modalItems = useMemo(() => {
    if (!modalSessionOrderByAssignmentId || selectedId === null) {
      return filteredItems;
    }

    return modalSessionOrderByAssignmentId
      .map((assignmentId) => filteredItemByAssignmentId.get(assignmentId) ?? modalSessionItemByAssignmentId[assignmentId] ?? null)
      .filter((item): item is StudyQueueItem => item !== null);
  }, [filteredItems, filteredItemByAssignmentId, modalSessionItemByAssignmentId, modalSessionOrderByAssignmentId, selectedId]);

  const selectedItem = modalItems.find((item) => item.subjectId === selectedId) ?? null;
  const isSelectedSubmitted = selectedItem ? hiddenSubmittedAssignmentIds.has(selectedItem.assignmentId) : false;
  const selectedIndex = selectedItem
    ? modalItems.findIndex((item) => item.assignmentId === selectedItem.assignmentId)
    : -1;
  const prevItem = selectedIndex > 0 ? modalItems[selectedIndex - 1] : null;
  const nextItem = selectedIndex >= 0 && selectedIndex < modalItems.length - 1 ? modalItems[selectedIndex + 1] : null;
  const isAnswerRevealed = selectedItem ? revealedAssignmentIds.has(selectedItem.assignmentId) : false;
  const isSubmittingSelected = selectedItem ? submittingByAssignmentId.has(selectedItem.assignmentId) : false;

  useEffect(() => {
    if (selectedId === null) {
      setModalSessionOrderByAssignmentId(null);
      setModalSessionItemByAssignmentId({});
      return;
    }

    setModalSessionOrderByAssignmentId((prev) => {
      if (prev && prev.length > 0) {
        return prev;
      }
      if (filteredItems.length === 0) {
        return prev;
      }
      return filteredItems.map((item) => item.assignmentId);
    });

    setModalSessionItemByAssignmentId((prev) => {
      if (filteredItems.length === 0) {
        return prev;
      }

      const next = { ...prev };
      for (const item of filteredItems) {
        next[item.assignmentId] = item;
      }
      return next;
    });
  }, [filteredItems, selectedId]);

  const { clearAllFilters } = useStudyExplorerEffects({
    accountId,
    queueMode,
    countsStorageKey,
    selectedSubjectStorageKey,
    typeFilterStorageKey,
    recentOnlyStorageKey,
    showLockedStorageKey,
    typeFilter,
    recentOnly,
    showLocked,
    hasHydratedTypeFilter,
    setHasHydratedTypeFilter,
    hiddenSubmittedAssignmentIds,
    loadedItems,
    totalItems,
    counts,
    levelCounts: lessonLevelCountsFromServer,
    dataItems: data?.items,
    dataPaginationTotal: data?.pagination?.total,
    dataCounts: data?.counts,
    setCachedQueueData,
    setPersistedCounts,
    setLoadedItems,
    setTotalItems,
    setSelectedId,
    setTypeFilter,
    setRecentOnly,
    setLoadMoreError,
    setSearchQuery,
    setViewedLevel,
    setSrsFilter,
    setShowLocked,
    lastHandledStudyQueryRef,
  });

  useEffect(() => {
    try {
      if (selectedId === null) {
        window.localStorage.removeItem(selectedSubjectStorageKey);
      } else {
        window.localStorage.setItem(selectedSubjectStorageKey, String(selectedId));
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [selectedId, selectedSubjectStorageKey]);


  const loadMorePage = useCallback(async () => {
    if (isLoadingMore || !hasMorePages) return;

    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const payload = await fetchStudyQueue(
        `/api/study/${accountId}/queue?mode=${queueMode}&limit=${API_PAGE_SIZE}&offset=${loadedItems.length}`,
      );
      const payloadVisibleItems = payload.items.filter(
        (item) => !hiddenSubmittedAssignmentIds.has(item.assignmentId),
      );

      setLoadedItems((prev) => {
        const existing = new Set(prev.map((item) => item.assignmentId));
        const merged = [...prev, ...payloadVisibleItems.filter((item) => !existing.has(item.assignmentId))];
        return sameAssignmentList(prev, merged) ? prev : merged;
      });
      const nextTotalRaw = payload.pagination?.total ?? totalItems;
      setTotalItems(Math.max(0, nextTotalRaw - hiddenSubmittedAssignmentIds.size));
      if (payload.counts) setPersistedCounts(payload.counts);
    } catch (loadError) {
      setLoadMoreError(loadError instanceof Error ? loadError.message : "Could not load more study items.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [accountId, queueMode, loadedItems.length, hasMorePages, hiddenSubmittedAssignmentIds, isLoadingMore, totalItems]);

  useEffect(() => {
    if (!sentinelRef.current || selectedItem || !hasMorePages) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void loadMorePage();
      }
    }, { rootMargin: "600px 0px" });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [selectedItem, hasMorePages, loadMorePage]);

  const { submitReview, submitLessonStart, closeReviewSession } = useStudyReviewSubmission({
    accountId,
    modalItems,
    selectedItem,
    hasPendingStudySubmissions,
    mutateQueue,
    onSetLoadedItems: setLoadedItems,
    onSetTotalItems: setTotalItems,
    onSetPersistedCounts: setPersistedCounts,
    onSetSubmitFeedback: setSubmitFeedback,
    onSetSubmitInFlight: setSubmitInFlight,
    onSetSubmittingByAssignmentId: setSubmittingByAssignmentId,
    onSetRevealedAssignmentIds: setRevealedAssignmentIds,
    onSetReviewOutcomeByAssignmentId: setReviewOutcomeByAssignmentId,
    onSetHiddenSubmittedAssignmentIds: setHiddenSubmittedAssignmentIds,
    onSetHasPendingStudySubmissions: setHasPendingStudySubmissions,
    onSetSelectedId: setSelectedId,
    onSetModalSessionOrderByAssignmentId: setModalSessionOrderByAssignmentId,
    onSetModalSessionItemByAssignmentId: setModalSessionItemByAssignmentId,
  });

  return (
    <section className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
      <StudyExplorerPanel
        canToggleEnglish={canToggleEnglish}
        showEnglish={showEnglish}
        studyMode={studyMode}
        levelOptions={levelOptions}
        availableLevels={availableLevels}
        viewedLevel={viewedLevel}
        typeFilter={typeFilter}
        srsFilter={effectiveSrsFilter}
        queueMode={queueMode}
        lessonLevelCounts={lessonLevelCounts}
        typeCounts={typeCounts}
        srsCounts={srsCounts}
        filteredItems={filteredItems}
        totalItems={totalItems}
        hasMorePages={hasMorePages}
        isLoadingMore={isLoadingMore}
        loadMoreError={loadMoreError}
        isLoading={isLoading}
        isValidating={isValidating}
        hasData={Boolean(data)}
        isUnauthorized={isUnauthorized}
        errorMessage={error?.message ?? null}
        recentOnly={recentOnly}
        showLocked={showLocked}
        sentinelRef={sentinelRef}
        onSetViewedLevel={setViewedLevel}
        onSetTypeFilter={setTypeFilter}
        onSetSrsFilter={setSrsFilter}
        onToggleShowEnglish={onToggleShowEnglish}
        onToggleShowLocked={() => setShowLocked((prev) => !prev)}
        onToggleRecentOnly={() => setRecentOnly((prev) => !prev)}
        onSelectSubject={setSelectedId}
        onClearAllFilters={clearAllFilters}
      />

      <StudyExplorerModal
        accountId={accountId}
        isUnauthorized={isUnauthorized}
        studyMode={studyMode}
        selectedItem={selectedItem}
        selectedIndex={selectedIndex}
        modalItems={modalItems}
        prevItem={prevItem}
        nextItem={nextItem}
        filteredItems={filteredItems}
        isSelectedSubmitted={isSelectedSubmitted}
        isAnswerRevealed={isAnswerRevealed}
        isSubmittingSelected={isSubmittingSelected}
        submitInFlight={submitInFlight}
        submitFeedback={submitFeedback}
        reviewOutcomeByAssignmentId={reviewOutcomeByAssignmentId}
        onSetReviewOutcomeByAssignmentId={setReviewOutcomeByAssignmentId}
        onSetSelectedId={setSelectedId}
        onSetRevealedAssignmentIds={setRevealedAssignmentIds}
        onClose={closeReviewSession}
        onSubmit={submitReview}
        onStartLesson={submitLessonStart}
      />
    </section>
  );
}
