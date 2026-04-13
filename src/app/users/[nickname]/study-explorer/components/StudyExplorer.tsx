"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import SubjectTypeFilterGroup from "../../shared/SubjectTypeFilterGroup";
import UnifiedExplorerCard from "../../shared/UnifiedExplorerCard";
import StudyReviewModal from "./StudyReviewModal";
import {
  formatNextReviewBadge,
  formatNumber,
  glyphSubtitleForDisplay,
  glyphTextSizeClass,
  shortSubjectTypeLabel,
  srsFilterButtonLabel,
  statusClass,
  statusShortLabel,
  subjectTypePillClass,
  titleForDisplay,
  typeCardClass,
  typeGlyphBoxClass,
} from "../../level-explorer/lib/levelExplorerDisplay";
import ExplorerSearchBar from "../../ExplorerSearchBar";
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
  badgeClass,
  disabledBadgeClass,
  fetchStudyQueue,
  filterStudyItems,
  persistQueue,
  readStoredQueue,
  studyItemEnglishTitle,
} from "../lib/studyExplorerUtils";

const API_PAGE_SIZE = 120;

function StudySkeletonCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={`study-skeleton-${index}`} className="rounded-2xl border border-line bg-surface p-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 w-8 rounded bg-surface-muted" />
            <div className="h-6 w-24 rounded-full bg-surface-muted" />
          </div>
          <div className="mt-3 h-8 w-40 rounded bg-surface-muted" />
          <div className="mt-3 h-[9.75rem] rounded-xl border border-line/50 bg-surface-muted" />
        </div>
      ))}
    </div>
  );
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
  const [hiddenSubmittedAssignmentIds, setHiddenSubmittedAssignmentIds] = useState<Set<number>>(new Set());
  const [hasPendingStudySubmissions, setHasPendingStudySubmissions] = useState(false);
  const [showLocked, setShowLocked] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasHydratedTypeFilter, setHasHydratedTypeFilter] = useState(false);

  const { data, error, isLoading, mutate: mutateQueue } = useSWR(
    `/api/study/${accountId}/queue?mode=${queueMode}&limit=${API_PAGE_SIZE}&offset=0`,
    fetchStudyQueue,
    {
      fallbackData: cachedQueueData,
      keepPreviousData: true,
      refreshInterval: 30_000,
      revalidateOnFocus: true,
    },
  );
  const isUnauthorized = Boolean(error && /unauthorized/i.test(error.message));

  const counts = data?.counts ?? persistedCounts;
  const hasMorePages = loadedItems.length < totalItems;

  const levelOptions = useMemo(
    () => Array.from({ length: Math.max(1, maxLevel) }, (_, index) => index + 1),
    [maxLevel],
  );

  const availableLevels = useMemo(() => {
    const output = new Set<number>();
    for (const item of loadedItems) {
      if (item.queueType === queueMode && typeof item.wkLevel === "number") {
        output.add(item.wkLevel);
      }
    }
    return output;
  }, [loadedItems, queueMode]);

  const filteredItems = useMemo(
    () =>
      filterStudyItems(loadedItems, queueMode, viewedLevel, typeFilter, srsFilter, showLocked, searchQuery),
    [loadedItems, queueMode, viewedLevel, typeFilter, srsFilter, showLocked, searchQuery],
  );

  const typeCounts = useMemo(() => {
    const out = { all: 0, radical: 0, kanji: 0, vocabulary: 0 };
    for (const item of loadedItems) {
      if (item.queueType !== queueMode) continue;
      if (viewedLevel !== null && item.wkLevel !== viewedLevel) continue;
      if (srsFilter !== "all" && item.status !== srsFilter) continue;
      if (!showLocked && item.status === "locked") continue;

      out.all += 1;
      if (item.subjectType === "radical") out.radical += 1;
      else if (item.subjectType === "kanji") out.kanji += 1;
      else out.vocabulary += 1;
    }
    return out;
  }, [loadedItems, queueMode, viewedLevel, srsFilter, showLocked]);

  const srsCounts = useMemo(() => {
    const out = { all: 0, apprentice: 0, guru: 0, master: 0, enlightened: 0 };
    for (const item of loadedItems) {
      if (item.queueType !== queueMode) continue;
      if (viewedLevel !== null && item.wkLevel !== viewedLevel) continue;
      if (typeFilter !== "all" && item.subjectType !== typeFilter) continue;
      if (!showLocked && item.status === "locked") continue;

      out.all += 1;
      if (item.status === "apprentice") out.apprentice += 1;
      if (item.status === "guru") out.guru += 1;
      if (item.status === "master") out.master += 1;
      if (item.status === "enlightened") out.enlightened += 1;
    }
    return out;
  }, [loadedItems, queueMode, viewedLevel, typeFilter, showLocked]);

  const selectedItem = filteredItems.find((item) => item.subjectId === selectedId) ?? null;
  const selectedIndex = selectedItem
    ? filteredItems.findIndex((item) => item.subjectId === selectedItem.subjectId)
    : -1;
  const prevItem = selectedIndex > 0 ? filteredItems[selectedIndex - 1] : null;
  const nextItem = selectedIndex >= 0 && selectedIndex < filteredItems.length - 1 ? filteredItems[selectedIndex + 1] : null;
  const isAnswerRevealed = selectedItem ? revealedAssignmentIds.has(selectedItem.assignmentId) : false;
  const isSubmittingSelected = selectedItem ? submittingByAssignmentId.has(selectedItem.assignmentId) : false;

  useEffect(() => {
    const raw = window.localStorage.getItem(countsStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<StudyCounts>;
      if (typeof parsed.all === "number" && typeof parsed.reviews === "number" && typeof parsed.lessons === "number") {
        setPersistedCounts({ all: parsed.all, reviews: parsed.reviews, lessons: parsed.lessons });
      }
    } catch {
      window.localStorage.removeItem(countsStorageKey);
    }
  }, [countsStorageKey]);

  useEffect(() => {
    const raw = window.localStorage.getItem(typeFilterStorageKey);
    if (!raw) {
      setHasHydratedTypeFilter(true);
      return;
    }

    if (raw === "all" || raw === "radical" || raw === "kanji" || raw === "vocabulary") {
      setTypeFilter(raw);
      setHasHydratedTypeFilter(true);
      return;
    }

    window.localStorage.removeItem(typeFilterStorageKey);
    setHasHydratedTypeFilter(true);
  }, [typeFilterStorageKey]);

  useEffect(() => {
    if (!hasHydratedTypeFilter) return;
    window.localStorage.setItem(typeFilterStorageKey, typeFilter);
  }, [hasHydratedTypeFilter, typeFilterStorageKey, typeFilter]);

  useEffect(() => {
    if (!data?.counts) return;
    setPersistedCounts(data.counts);
    window.localStorage.setItem(countsStorageKey, JSON.stringify(data.counts));
  }, [countsStorageKey, data?.counts]);

  useEffect(() => {
    if (!data?.items) return;

    const fresh = data.items.filter((item) => !hiddenSubmittedAssignmentIds.has(item.assignmentId));
    const freshIds = new Set(fresh.map((item) => item.assignmentId));
    setLoadedItems((prev) => {
      const visiblePrev = prev.filter((item) => !hiddenSubmittedAssignmentIds.has(item.assignmentId));
      if (visiblePrev.length === 0) return fresh;
      return [...fresh, ...visiblePrev.filter((item) => !freshIds.has(item.assignmentId))];
    });
    const nextTotalRaw = data.pagination?.total ?? fresh.length;
    setTotalItems(Math.max(0, nextTotalRaw - hiddenSubmittedAssignmentIds.size));
  }, [data?.items, data?.pagination?.total, hiddenSubmittedAssignmentIds]);

  useEffect(() => {
    persistQueue(accountId, queueMode, loadedItems, totalItems, counts ?? null);
    setCachedQueueData({
      items: loadedItems,
      counts: counts ?? { all: loadedItems.length, reviews: 0, lessons: 0 },
      pagination: { offset: 0, limit: loadedItems.length, total: totalItems, hasMore: loadedItems.length < totalItems },
    });
  }, [accountId, queueMode, loadedItems, totalItems, counts]);

  useEffect(() => {
    setCachedQueueData(readStoredQueue(accountId, queueMode));
    setLoadMoreError(null);
    try {
      const raw = window.localStorage.getItem(selectedSubjectStorageKey);
      const parsed = Number(raw);
      setSelectedId(Number.isInteger(parsed) && parsed > 0 ? parsed : null);
    } catch {
      setSelectedId(null);
    }
  }, [accountId, queueMode, selectedSubjectStorageKey]);

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

  useEffect(() => {
    const runFromUrl = () => {
      const fromUrl = new URLSearchParams(window.location.search).get("findStudy")?.trim() ?? "";
      if (fromUrl === lastHandledStudyQueryRef.current) return;
      lastHandledStudyQueryRef.current = fromUrl;
      setSearchQuery(fromUrl);
    };

    runFromUrl();
    const onPopState = () => runFromUrl();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
        return [...prev, ...payloadVisibleItems.filter((item) => !existing.has(item.assignmentId))];
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

  const submitReview = useCallback(async (assignmentId: number, result: "correct" | "wrong") => {
    const itemForSubmit = filteredItems.find((item) => item.assignmentId === assignmentId) ?? selectedItem ?? null;
    const submittedIndex = filteredItems.findIndex((item) => item.assignmentId === assignmentId);
    const remainingAfterSubmit = filteredItems.filter((item) => item.assignmentId !== assignmentId);
    const nextFocusedItem =
      remainingAfterSubmit[submittedIndex] ??
      remainingAfterSubmit[Math.max(0, submittedIndex - 1)] ??
      null;

    setSubmitInFlight({
      assignmentId,
      result,
      itemLabel: itemForSubmit ? `${itemForSubmit.characters} (${studyItemEnglishTitle(itemForSubmit)})` : "item",
    });
    setSubmittingByAssignmentId((prev) => new Set(prev).add(assignmentId));

    try {
      const response = await fetch(`/api/study/${accountId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, result }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not submit review.");

      setLoadedItems((prev) => prev.filter((item) => item.assignmentId !== assignmentId));
      setTotalItems((prev) => Math.max(0, prev - 1));
      setPersistedCounts((prev) => (prev
        ? { ...prev, reviews: Math.max(0, prev.reviews - 1), all: Math.max(0, prev.all - 1) }
        : prev));
      setSubmitFeedback({
        kind: "success",
        message: `${result === "correct" ? "Correct" : "Wrong"} submitted for ${itemForSubmit ? `${itemForSubmit.characters} (${studyItemEnglishTitle(itemForSubmit)})` : "item"}.`,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("wr:study-review-submitted", {
            detail: {
              accountId,
              subjectId: itemForSubmit?.subjectId,
            },
          }),
        );
      }
      setReviewOutcomeByAssignmentId((prev) => ({ ...prev, [assignmentId]: result }));
      setHiddenSubmittedAssignmentIds((prev) => {
        const next = new Set(prev);
        next.add(assignmentId);
        return next;
      });
      setHasPendingStudySubmissions(true);
      setSelectedId(nextFocusedItem?.subjectId ?? null);
    } catch (submitError) {
      setSubmitFeedback({
        kind: "error",
        message: submitError instanceof Error ? submitError.message : "Could not submit review.",
      });
    } finally {
      setSubmittingByAssignmentId((prev) => {
        const next = new Set(prev);
        next.delete(assignmentId);
        return next;
      });
      setRevealedAssignmentIds((prev) => {
        const next = new Set(prev);
        next.delete(assignmentId);
        return next;
      });
      setSubmitInFlight(null);
    }
  }, [accountId, filteredItems, selectedItem]);

  const closeReviewSession = useCallback(() => {
    if (hasPendingStudySubmissions) {
      void fetch(`/api/accounts/${accountId}/refresh`, { method: "POST" }).catch(() => {
        // Non-blocking best-effort refresh after review session closes.
      });
      void mutateQueue();
      setHasPendingStudySubmissions(false);
    }

    setSelectedId(null);
    setReviewOutcomeByAssignmentId({});
    setSubmitFeedback(null);
    setSubmitInFlight(null);
    setRevealedAssignmentIds(new Set());
  }, [accountId, hasPendingStudySubmissions, mutateQueue]);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
      <header className="border-b border-line bg-surface-muted px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-foreground">Study</h2>
            <p className="text-xs uppercase tracking-[0.08em] text-foreground/70">Reviews due now and available lessons across all levels</p>
          </div>
          <div className="w-full lg:max-w-[38rem]"><ExplorerSearchBar scope="study" /></div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setViewedLevel(null)} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(viewedLevel === null)}`}>
            All Levels
          </button>
          {levelOptions.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setViewedLevel(level)}
              disabled={!availableLevels.has(level)}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${!availableLevels.has(level) ? disabledBadgeClass() : badgeClass(viewedLevel === level)}`}
            >
              L{level}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <SubjectTypeFilterGroup
            counts={typeCounts}
            allLabel={viewedLevel === null ? "All Levels" : `All L${viewedLevel}`}
            allActive={typeFilter === "all"}
            activeTypes={{
              radical: typeFilter === "all" || typeFilter === "radical",
              kanji: typeFilter === "all" || typeFilter === "kanji",
              vocabulary: typeFilter === "all" || typeFilter === "vocabulary",
            }}
            onClickAll={() => setTypeFilter("all")}
            onClickType={(type) => setTypeFilter(type)}
          />

          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {(["all", "apprentice", "guru", "master", "enlightened"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setSrsFilter(status)}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(srsFilter === status)}`}
              >
                {srsFilterButtonLabel(status)} ({formatNumber(srsCounts[status])})
              </button>
            ))}
          </div>
        </div>
      </header>

      {error ? <p className="px-5 py-4 text-sm text-red-700">{error.message}</p> : null}

      <div className="p-5">
        {isLoading && !data ? <StudySkeletonCards /> : null}

        {filteredItems.length > 0 ? (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65">
                Showing {formatNumber(filteredItems.length)} loaded items · {formatNumber(totalItems)} total in queue
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleShowEnglish}
                  disabled={!canToggleEnglish}
                  className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {canToggleEnglish ? (showEnglish ? "Hide English" : "Show English") : "Hints Hidden"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocked((prev) => !prev)}
                  className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
                >
                  {showLocked ? "Hide Locked" : "Show Locked"}
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {filteredItems.map((item, index) => {
                const reviewBadge = item.queueType === "review" ? formatNextReviewBadge(item.availableAt) : null;

                return (
                  <UnifiedExplorerCard
                    key={`${item.queueType}-${item.subjectId}`}
                    onClick={() => {
                      if (!isUnauthorized) {
                        setSelectedId(item.subjectId);
                      }
                    }}
                    className={`rounded-2xl border p-3 text-left transition ${
                      isUnauthorized ? "cursor-not-allowed opacity-65" : "hover:brightness-95"
                    } ${typeCardClass(item.subjectType, false)}`}
                    indexLabel={`#${index + 1}`}
                    topRight={
                      <>
                        <span className={subjectTypePillClass(item.subjectType)}>{shortSubjectTypeLabel(item.subjectType)}</span>
                        {typeof item.wkLevel === "number" ? (
                          <span className="subject-pill border-line bg-surface text-foreground">L{item.wkLevel}</span>
                        ) : null}
                      </>
                    }
                    glyphClassName={typeGlyphBoxClass(item.subjectType)}
                    glyphText={item.characters}
                    glyphTextClassName={glyphTextSizeClass(item.characters)}
                    glyphSubtitle={
                      studyMode
                        ? <span className="text-foreground/45">...</span>
                        : item.subjectType === "kanji"
                          ? (showEnglish ? titleForDisplay(item, true) : (glyphSubtitleForDisplay(item) ?? ""))
                          : (glyphSubtitleForDisplay(item) ?? "")
                    }
                    statusChip={<span className={`rounded-full px-3 py-1 text-xs font-bold uppercase whitespace-nowrap ${statusClass(item.status)}`}>{statusShortLabel(item.status)}</span>}
                    middleChip={reviewBadge ? <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase whitespace-nowrap ${reviewBadge.className}`}>{reviewBadge.label}</span> : undefined}
                    rightChip={<span className="rounded-full border border-line bg-surface px-2 py-1 text-xs font-bold text-foreground">SRS {item.srsStage}</span>}
                  />
                );
              })}
            </div>

            {hasMorePages ? (
              <div ref={sentinelRef} className="mt-3 rounded-xl border border-line bg-surface-muted px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-foreground/60">
                {isLoadingMore ? "Loading more..." : loadMoreError ? `Load error: ${loadMoreError}` : "Scroll to load more..."}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-foreground/70">
            No study items match the current filters.
          </div>
        )}
      </div>

      {!isUnauthorized ? (
        <StudyReviewModal
          accountId={accountId}
          studyMode={studyMode}
          selectedItem={selectedItem}
          selectedIndex={selectedIndex}
          filteredTotal={filteredItems.length}
          prevLabel={prevItem?.characters ?? null}
          nextLabel={nextItem?.characters ?? null}
          isAnswerRevealed={isAnswerRevealed}
          isSubmittingSelected={isSubmittingSelected}
          submitInFlight={submitInFlight}
          submitFeedback={submitFeedback}
          reviewOutcomeByAssignmentId={reviewOutcomeByAssignmentId}
          onClose={closeReviewSession}
          onPrev={
            prevItem
              ? () => {
                  setSelectedId(prevItem.subjectId);
                }
              : null
          }
          onNext={
            nextItem
              ? () => {
                  setSelectedId(nextItem.subjectId);
                }
              : null
          }
          onRestartFromBeginning={
            filteredItems.length > 0
              ? () => {
                  setSelectedId(filteredItems[0]?.subjectId ?? null);
                }
              : null
          }
          onReveal={(assignmentId) => {
            setRevealedAssignmentIds((prev) => new Set(prev).add(assignmentId));
          }}
          onSubmit={submitReview}
        />
      ) : null}
    </section>
  );
}
