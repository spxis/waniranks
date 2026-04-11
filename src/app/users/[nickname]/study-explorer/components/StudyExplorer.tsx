"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";

import type { LevelItem, SrsFilter } from "../../explorerTypes";
import LevelExplorerDetailSection from "../../level-explorer/components/LevelExplorerDetailSection";
import {
  formatNextReviewBadge,
  formatNumber,
  glyphSubtitleForDisplay,
  glyphTextSizeClass,
  statusClass,
  subjectTypePillClass,
  titleForDisplay,
  typeCardClass,
  typeGlyphBoxClass,
} from "../../level-explorer/lib/levelExplorerDisplay";

type StudyQueueItem = LevelItem & {
  assignmentId: number;
  queueType: "review" | "lesson";
};

type QueueResponse = {
  items: StudyQueueItem[];
  counts: {
    all: number;
    reviews: number;
    lessons: number;
  };
};

type StudyCounts = QueueResponse["counts"];
type StoredQueuePayload = {
  cachedAtMs: number;
  data: QueueResponse;
};

type Props = {
  accountId: string;
  maxLevel: number;
  showEnglish: boolean;
  studyMode: boolean;
};

const fetcher = async (url: string): Promise<QueueResponse> => {
  const response = await fetch(url);
  const data = (await response.json()) as QueueResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Could not fetch study queue.");
  }
  return data;
};

const STUDY_QUEUE_STORAGE_TTL_MS = 90_000;

function readStoredQueue(accountId: string, mode: "review" | "lesson"): QueueResponse | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const raw = window.localStorage.getItem(`wr:study-queue:${accountId}:${mode}`);
  if (!raw) {
    return undefined;
  }

  try {
    const payload = JSON.parse(raw) as StoredQueuePayload;
    if (!payload || typeof payload.cachedAtMs !== "number" || !payload.data) {
      return undefined;
    }

    if (Date.now() - payload.cachedAtMs > STUDY_QUEUE_STORAGE_TTL_MS) {
      window.localStorage.removeItem(`wr:study-queue:${accountId}:${mode}`);
      return undefined;
    }

    return payload.data;
  } catch {
    window.localStorage.removeItem(`wr:study-queue:${accountId}:${mode}`);
    return undefined;
  }
}

function badgeClass(active: boolean): string {
  return active
    ? "border-accent bg-accent text-white"
    : "border-line bg-surface text-foreground hover:bg-surface-muted";
}

function queueBadgeClass(queueType: "review" | "lesson"): string {
  return queueType === "review"
    ? "border-amber-300 bg-amber-50 text-amber-800"
    : "border-sky-300 bg-sky-50 text-sky-800";
}

function queueModeButtonClass(mode: "review" | "lesson", activeMode: "review" | "lesson"): string {
  const active = mode === activeMode;
  if (!active) {
    return "border-line bg-surface text-foreground hover:bg-surface-muted";
  }

  return mode === "review"
    ? "border-amber-500 bg-amber-500 text-white"
    : "border-sky-500 bg-sky-500 text-white";
}

export default function StudyExplorer({ accountId, maxLevel, showEnglish, studyMode }: Props) {
  const PAGE_SIZE = 40;
  const modeStorageKey = `wr:study-queue-mode:${accountId}`;
  const countsStorageKey = `wr:study-queue-counts:${accountId}`;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [queueMode, setQueueMode] = useState<"review" | "lesson">(() => {
    if (typeof window === "undefined") {
      return "review";
    }

    const stored = window.localStorage.getItem(`wr:study-queue-mode:${accountId}`);
    return stored === "lesson" ? "lesson" : "review";
  });
  const [cachedQueueData, setCachedQueueData] = useState<QueueResponse | undefined>(() =>
    readStoredQueue(
      accountId,
      typeof window !== "undefined" && window.localStorage.getItem(`wr:study-queue-mode:${accountId}`) === "lesson"
        ? "lesson"
        : "review",
    ),
  );
  const [persistedCounts, setPersistedCounts] = useState<StudyCounts | null>(null);
  const { data, error, mutate, isLoading } = useSWR(`/api/study/${accountId}/queue?mode=${queueMode}`, fetcher, {
    fallbackData: cachedQueueData,
    keepPreviousData: true,
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const levelOptions = useMemo(
    () => Array.from({ length: Math.max(1, maxLevel) }, (_, index) => index + 1),
    [maxLevel],
  );
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(() => new Set(levelOptions));
  const [typeFilter, setTypeFilter] = useState<"all" | "radical" | "kanji" | "vocabulary">("all");
  const [srsFilter, setSrsFilter] = useState<SrsFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [submittingByAssignmentId, setSubmittingByAssignmentId] = useState<Set<number>>(new Set());
  const [revealedAssignmentIds, setRevealedAssignmentIds] = useState<Set<number>>(new Set());

  const counts = data?.counts ?? persistedCounts;

  useEffect(() => {
    const raw = window.localStorage.getItem(countsStorageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StudyCounts>;
      if (
        typeof parsed.all === "number" &&
        typeof parsed.reviews === "number" &&
        typeof parsed.lessons === "number"
      ) {
        setPersistedCounts({ all: parsed.all, reviews: parsed.reviews, lessons: parsed.lessons });
      }
    } catch {
      window.localStorage.removeItem(countsStorageKey);
    }
  }, [countsStorageKey]);

  useEffect(() => {
    if (!data?.counts) {
      return;
    }

    setPersistedCounts(data.counts);
    window.localStorage.setItem(countsStorageKey, JSON.stringify(data.counts));
  }, [countsStorageKey, data?.counts]);

  useEffect(() => {
    window.localStorage.setItem(modeStorageKey, queueMode);
  }, [modeStorageKey, queueMode]);

  useEffect(() => {
    setCachedQueueData(readStoredQueue(accountId, queueMode));
  }, [accountId, queueMode]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const key = `wr:study-queue:${accountId}:${queueMode}`;
    const payload: StoredQueuePayload = {
      cachedAtMs: Date.now(),
      data,
    };
    setCachedQueueData(data);
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, [accountId, data, queueMode]);

  const allLevelsSelected = selectedLevels.size === levelOptions.length;

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((item) => {
      if (!allLevelsSelected) {
        const itemLevel = item.wkLevel;
        if (typeof itemLevel !== "number" || !selectedLevels.has(itemLevel)) {
          return false;
        }
      }

      if (item.queueType !== queueMode) {
        return false;
      }

      if (typeFilter !== "all" && item.subjectType !== typeFilter) {
        return false;
      }

      if (srsFilter !== "all" && item.status !== srsFilter) {
        return false;
      }

      return true;
    });
  }, [allLevelsSelected, data?.items, queueMode, selectedLevels, srsFilter, typeFilter]);

  useEffect(() => {
    setSelectedId(null);
  }, [queueMode]);

  const selectedItem = filteredItems.find((item) => item.subjectId === selectedId) ?? null;
  const selectedIndex = selectedItem
    ? filteredItems.findIndex((item) => item.subjectId === selectedItem.subjectId)
    : -1;
  const prevItem = selectedIndex > 0 ? filteredItems[selectedIndex - 1] : null;
  const nextItem = selectedIndex >= 0 && selectedIndex < filteredItems.length - 1 ? filteredItems[selectedIndex + 1] : null;
  const selectedMeaningExplanation = selectedItem?.meaningExplanation ?? "-";
  const selectedReadingExplanationRaw = selectedItem?.readingExplanation ?? "";
  const showReadingExplanation = selectedReadingExplanationRaw.trim().length > 0;
  const visibleItems = filteredItems.slice(0, visibleCount);
  const isAnswerRevealed = selectedItem ? revealedAssignmentIds.has(selectedItem.assignmentId) : false;

  useEffect(() => {
    if (selectedId === null) {
      return;
    }

    const stillVisible = filteredItems.some((item) => item.subjectId === selectedId);
    if (!stillVisible) {
      setSelectedId(null);
    }
  }, [filteredItems, selectedId]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filteredItems]);

  useEffect(() => {
    if (!sentinelRef.current || selectedItem) {
      return;
    }

    if (visibleCount >= filteredItems.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleCount((prev) => Math.min(filteredItems.length, prev + PAGE_SIZE));
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [filteredItems.length, selectedItem, visibleCount]);

  async function submitReview(assignmentId: number, result: "correct" | "wrong") {
    setSubmittingByAssignmentId((prev) => new Set(prev).add(assignmentId));

    try {
      const response = await fetch(`/api/study/${accountId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, result }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not submit review.");
      }

      await mutate(
        (current) => {
          if (!current) {
            return current;
          }

          const nextItems = current.items.filter((item) => item.assignmentId !== assignmentId);
          return {
            ...current,
            items: nextItems,
            counts: {
              ...current.counts,
              reviews: Math.max(0, current.counts.reviews - 1),
              all: Math.max(0, current.counts.all - 1),
            },
          };
        },
        { revalidate: false },
      );

      void mutate();
      window.dispatchEvent(new CustomEvent("wr:user-refreshed", { detail: { accountId } }));
    } catch (submitError) {
      console.error(submitError);
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
    }
  }

  function revealAnswer(assignmentId: number) {
    setRevealedAssignmentIds((prev) => new Set(prev).add(assignmentId));
  }

  function toggleLevel(level: number) {
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

  function selectAllLevels() {
    setSelectedLevels(new Set(levelOptions));
  }

  function countLabel(value: number | undefined): string {
    return typeof value === "number" ? formatNumber(value) : "...";
  }

  function navTypeLabel(item: StudyQueueItem | null): string {
    return item?.subjectType ?? "item";
  }

  function moveSelection(delta: -1 | 1) {
    if (filteredItems.length === 0) {
      return;
    }

    if (selectedIndex < 0) {
      setSelectedId(filteredItems[0]?.subjectId ?? null);
      return;
    }

    const nextIndex = Math.max(0, Math.min(filteredItems.length - 1, selectedIndex + delta));
    setSelectedId(filteredItems[nextIndex]?.subjectId ?? null);
  }

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        const isTypingContext =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          active.isContentEditable;
        if (isTypingContext) {
          return;
        }
      }

      const key = event.key.toLowerCase();

      if (event.key === "ArrowLeft" || event.key === "ArrowUp" || key === "a" || key === "w") {
        event.preventDefault();
        moveSelection(-1);
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === " " || key === "d" || key === "s") {
        event.preventDefault();
        moveSelection(1);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setSelectedId(filteredItems[0]?.subjectId ?? null);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        setSelectedId(filteredItems[filteredItems.length - 1]?.subjectId ?? null);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedId(null);
        return;
      }

      if (studyMode && selectedItem.queueType === "review" && !isAnswerRevealed) {
        if (event.key === "Enter" || key === "r") {
          event.preventDefault();
          revealAnswer(selectedItem.assignmentId);
        }
        return;
      }

      if (selectedItem.queueType === "review" && !submittingByAssignmentId.has(selectedItem.assignmentId)) {
        if (event.key === "1") {
          event.preventDefault();
          void submitReview(selectedItem.assignmentId, "wrong");
          return;
        }

        if (event.key === "2") {
          event.preventDefault();
          void submitReview(selectedItem.assignmentId, "correct");
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [filteredItems, isAnswerRevealed, selectedItem, selectedIndex, studyMode, submittingByAssignmentId]);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
      <header className="border-b border-line bg-surface-muted px-5 py-4">
        <h2 className="text-xl font-black text-foreground">Study</h2>
        <p className="text-xs uppercase tracking-[0.08em] text-foreground/70">
          Reviews due now and available lessons across all levels
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={selectAllLevels} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(allLevelsSelected)}`}>
            All Levels
          </button>
          {levelOptions.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(selectedLevels.has(level))}`}
            >
              L{level}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/70">Mode</p>
          <button type="button" onClick={() => setQueueMode("review")} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${queueModeButtonClass("review", queueMode)}`}>
            Reviews ({countLabel(counts?.reviews)})
          </button>
          <button type="button" onClick={() => setQueueMode("lesson")} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${queueModeButtonClass("lesson", queueMode)}`}>
            Lessons ({countLabel(counts?.lessons)})
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {(["all", "radical", "kanji", "vocabulary"] as const).map((type) => (
            <button key={type} type="button" onClick={() => setTypeFilter(type)} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(typeFilter === type)}`}>
              {type}
            </button>
          ))}
          {(["all", "apprentice", "guru", "master", "enlightened", "burned", "locked"] as const).map((status) => (
            <button key={status} type="button" onClick={() => setSrsFilter(status)} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(srsFilter === status)}`}>
              {status}
            </button>
          ))}
        </div>
      </header>

      {isLoading && !data ? <p className="px-5 py-4 text-sm text-foreground/70">Loading study queue...</p> : null}
      {error ? <p className="px-5 py-4 text-sm text-red-700">{error.message}</p> : null}

      <div className="p-5">
        {filteredItems.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-foreground/70">
            No study items match the current filters.
          </div>
        ) : null}

        {filteredItems.length > 0 ? (
          <>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65">
            Showing {formatNumber(visibleItems.length)} of {formatNumber(filteredItems.length)} items
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleItems.map((item, index) => (
              <button
                key={`${item.queueType}-${item.subjectId}`}
                type="button"
                onClick={() => setSelectedId(item.subjectId)}
                className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${typeCardClass(
                  item.subjectType,
                  false,
                )}`}
              >
                <div className="flex min-h-[2.35rem] items-start justify-between gap-2">
                  <span className="text-[10px] font-semibold text-foreground/45">#{index + 1}</span>
                  <div className="flex min-h-[2.2rem] flex-wrap content-start items-start justify-end gap-1">
                    <span className={subjectTypePillClass(item.subjectType)}>{item.subjectType}</span>
                    {typeof item.wkLevel === "number" ? (
                      <span className="subject-pill border-line bg-surface text-foreground">WK{item.wkLevel}</span>
                    ) : null}
                    <span className={`subject-pill border ${queueBadgeClass(item.queueType)}`}>{item.queueType}</span>
                  </div>
                </div>
                <p className="mt-2 text-xl font-black leading-tight text-foreground">
                  {studyMode
                    ? item.subjectType === "kanji"
                      ? "Kanji"
                      : item.subjectType === "radical"
                        ? "Radical"
                        : "Vocabulary"
                    : titleForDisplay(item, showEnglish)}
                </p>
                <div className={`mt-3 rounded-xl border ${typeGlyphBoxClass(item.subjectType)} px-3 py-2`}>
                  <p className={`${glyphTextSizeClass(item.characters)} text-center font-black leading-none`}>{item.characters}</p>
                  {!studyMode && glyphSubtitleForDisplay(item) ? (
                    <p className="mt-1 text-center text-sm font-semibold text-foreground/70">{glyphSubtitleForDisplay(item)}</p>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-3 items-center gap-2">
                  <span className={`justify-self-start rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                  {item.queueType === "review" ? (
                    (() => {
                      const badge = formatNextReviewBadge(item.availableAt);
                      if (!badge) return <span />;
                      return <span className={`justify-self-center rounded-full border px-3 py-1 text-xs font-bold uppercase ${badge.className}`}>{badge.label}</span>;
                    })()
                  ) : (
                    <span />
                  )}
                  <span className="justify-self-end rounded-full border border-line bg-surface px-2 py-1 text-xs font-bold text-foreground">
                    SRS {item.srsStage}
                  </span>
                </div>
              </button>
            ))}
          </div>
          {visibleItems.length < filteredItems.length ? (
            <div ref={sentinelRef} className="mt-3 rounded-xl border border-line bg-surface-muted px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-foreground/60">
              Loading more...
            </div>
          ) : null}
          </>
        ) : null}
      </div>

      {selectedItem ? (
        <div className="fixed inset-0 z-50 bg-[rgba(8,16,36,0.72)] p-3 backdrop-blur-[2px] sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[1.8rem] border border-line bg-surface shadow-[0_26px_75px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col gap-2 border-b border-line bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="self-start rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
              >
                Back To List
              </button>
              <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSelection(-1)}
                    disabled={selectedIndex <= 0}
                    className="rounded-full border border-line bg-surface px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-xs"
                  >
                    Prev
                  </button>
                  {prevItem ? (
                    <>
                      <span className="subject-pill border-line bg-surface text-foreground">{prevItem.characters}</span>
                      <span className={subjectTypePillClass(prevItem.subjectType)}>{navTypeLabel(prevItem)}</span>
                    </>
                  ) : null}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/70 sm:text-xs">
                  #{selectedIndex + 1} of {filteredItems.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSelection(1)}
                    disabled={selectedIndex >= filteredItems.length - 1}
                    className="rounded-full border border-line bg-surface px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-xs"
                  >
                    Next
                  </button>
                  {nextItem ? (
                    <>
                      <span className="subject-pill border-line bg-surface text-foreground">{nextItem.characters}</span>
                      <span className={subjectTypePillClass(nextItem.subjectType)}>{navTypeLabel(nextItem)}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/60">
                Shortcuts: Left/Right/Up/Down or W/A/S/D (prev/next), Home/End (first/last), Esc (back)
                {studyMode && selectedItem.queueType === "review" && !isAnswerRevealed
                  ? ", Enter/R=show answer"
                  : selectedItem.queueType === "review"
                    ? ", 1=wrong, 2=correct"
                    : ""}
              </p>

              <LevelExplorerDetailSection
                selectedItem={selectedItem}
                showEnglish={showEnglish}
                studyMode={studyMode}
                revealStudyReading={!(studyMode && selectedItem.queueType === "review" && !isAnswerRevealed)}
                selectedMeaningExplanation={selectedMeaningExplanation}
                selectedReadingExplanationRaw={selectedReadingExplanationRaw}
                showReadingExplanation={showReadingExplanation}
                hasPrimaryRelatedPanel={false}
                hasVisuallySimilarPanel={false}
                hasUsedInVocabularyPanel={false}
                vocabularyKanjiLinks={[]}
                subjectById={new Map()}
                onJumpToRelatedSubject={async () => {}}
                onJumpToKanji={async () => {}}
              />

              {selectedItem.queueType === "review" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {studyMode && !isAnswerRevealed ? (
                    <button
                      type="button"
                      onClick={() => revealAnswer(selectedItem.assignmentId)}
                      className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
                    >
                      Show Answer
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => submitReview(selectedItem.assignmentId, "correct")}
                        disabled={submittingByAssignmentId.has(selectedItem.assignmentId)}
                        className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Correct
                      </button>
                      <button
                        type="button"
                        onClick={() => submitReview(selectedItem.assignmentId, "wrong")}
                        disabled={submittingByAssignmentId.has(selectedItem.assignmentId)}
                        className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Wrong
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
