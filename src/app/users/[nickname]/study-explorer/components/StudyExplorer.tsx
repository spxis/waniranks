"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { toRomaji } from "wanakana";

import ExplorerSearchBar from "../../ExplorerSearchBar";
import SubjectTypeFilterButton from "../../shared/SubjectTypeFilterButton";
import UnifiedExplorerCard from "../../shared/UnifiedExplorerCard";
import type { LevelItem, SrsFilter } from "../../explorerTypes";
import LevelExplorerDetailSection from "../../level-explorer/components/LevelExplorerDetailSection";
import {
  formatNextReviewBadge,
  formatNumber,
  glyphSubtitleForDisplay,
  glyphTextSizeClass,
  statusClass,
  statusShortLabel,
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

type SubmitFeedback = {
  kind: "success" | "error";
  message: string;
};

type SubmitInFlight = {
  assignmentId: number;
  result: "correct" | "wrong";
  itemLabel: string;
};

type ReviewTally = {
  correct: number;
  wrong: number;
};

type Props = {
  accountId: string;
  maxLevel: number;
  showEnglish: boolean;
  studyMode: boolean;
  queueMode: "review" | "lesson";
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

function normalizeStudySearch(value: string): string {
  return value.trim().toLowerCase();
}

function itemMatchesStudyQuery(item: StudyQueueItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  if (normalizeStudySearch(item.characters).includes(normalizedQuery)) {
    return true;
  }

  if (item.meanings.some((meaning) => normalizeStudySearch(meaning).includes(normalizedQuery))) {
    return true;
  }

  const allReadings = [...(item.primaryReadings ?? []), ...(item.readings ?? [])];
  if (allReadings.some((reading) => normalizeStudySearch(reading).includes(normalizedQuery))) {
    return true;
  }

  const romaji = normalizeStudySearch(toRomaji(`${item.characters} ${allReadings.join(" ")}`, { upcaseKatakana: false }));
  return romaji.includes(normalizedQuery);
}

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

function disabledBadgeClass(): string {
  return "cursor-not-allowed border-line bg-surface-muted text-foreground/45";
}

function queueBadgeClass(queueType: "review" | "lesson"): string {
  return queueType === "review"
    ? "border-amber-300 bg-amber-50 text-amber-800"
    : "border-sky-300 bg-sky-50 text-sky-800";
}

function shortSubjectTypeLabel(type: StudyQueueItem["subjectType"]): string {
  if (type === "vocabulary") {
    return "VOCAB";
  }

  if (type === "radical") {
    return "RADICAL";
  }

  if (type === "kanji") {
    return "KANJI";
  }

  return "ITEM";
}

function studyItemEnglishTitle(item: StudyQueueItem): string {
  const meaning = item.meanings.find((entry) => entry.trim().length > 0) ?? "";
  if (meaning) {
    return meaning;
  }

  if (item.subjectType === "kanji") {
    return "Kanji";
  }

  if (item.subjectType === "radical") {
    return "Radical";
  }

  return "Vocabulary";
}

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
          <div className="mt-3 flex items-center justify-between">
            <div className="h-8 w-20 rounded-full bg-surface-muted" />
            <div className="h-8 w-20 rounded-full bg-surface-muted" />
            <div className="h-8 w-20 rounded-full bg-surface-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StudyExplorer({
  accountId,
  maxLevel,
  showEnglish,
  studyMode,
  queueMode,
}: Props) {
  const PAGE_SIZE = 40;
  const countsStorageKey = `wr:study-queue-counts:${accountId}`;
  const levelStorageKey = `wr:study-level:${accountId}`;
  const typeStorageKey = `wr:study-type:${accountId}`;
  const srsStorageKey = `wr:study-srs:${accountId}`;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastHandledStudyQueryRef = useRef("");
  const [cachedQueueData, setCachedQueueData] = useState<QueueResponse | undefined>(() =>
    readStoredQueue(
      accountId,
      queueMode,
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
  const [viewedLevel, setViewedLevel] = useState<number | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const raw = window.localStorage.getItem(`wr:study-level:${accountId}`);
    if (!raw || raw === "all") {
      return null;
    }

    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const [typeFilter, setTypeFilter] = useState<"all" | "radical" | "kanji" | "vocabulary">(() => {
    if (typeof window === "undefined") {
      return "all";
    }

    const raw = window.localStorage.getItem(`wr:study-type:${accountId}`);
    return raw === "radical" || raw === "kanji" || raw === "vocabulary" ? raw : "all";
  });
  const [srsFilter, setSrsFilter] = useState<SrsFilter>(() => {
    if (typeof window === "undefined") {
      return "all";
    }

    const raw = window.localStorage.getItem(`wr:study-srs:${accountId}`);
    if (
      raw === "apprentice" ||
      raw === "guru" ||
      raw === "master" ||
      raw === "enlightened" ||
      raw === "burned" ||
      raw === "locked"
    ) {
      return raw;
    }

    return "all";
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [submittingByAssignmentId, setSubmittingByAssignmentId] = useState<Set<number>>(new Set());
  const [revealedAssignmentIds, setRevealedAssignmentIds] = useState<Set<number>>(new Set());
  const [submitFeedback, setSubmitFeedback] = useState<SubmitFeedback | null>(null);
  const [submitInFlight, setSubmitInFlight] = useState<SubmitInFlight | null>(null);
  const [reviewTally, setReviewTally] = useState<ReviewTally>({ correct: 0, wrong: 0 });
  const [showLocked, setShowLocked] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const counts = data?.counts ?? persistedCounts;
  const availableLevels = useMemo(() => {
    const levels = new Set<number>();
    for (const item of data?.items ?? []) {
      if (item.queueType !== queueMode) {
        continue;
      }

      if (typeof item.wkLevel === "number") {
        levels.add(item.wkLevel);
      }
    }

    return levels;
  }, [data?.items, queueMode]);

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
    if (typeof window === "undefined") {
      return;
    }

    const runFromUrl = () => {
      const fromUrl = new URLSearchParams(window.location.search).get("findStudy");
      const trimmed = fromUrl?.trim() ?? "";

      if (!trimmed) {
        setSearchQuery("");
        return;
      }

      if (lastHandledStudyQueryRef.current === trimmed) {
        return;
      }

      lastHandledStudyQueryRef.current = trimmed;
      setSearchQuery(trimmed);
    };

    runFromUrl();

    const onPopState = () => {
      runFromUrl();
    };

    const onSearch = (event: Event) => {
      const custom = event as CustomEvent<{ query?: string; requestId?: string; scope?: "level" | "jlpt" | "study" }>;
      if (custom.detail?.scope !== "study") {
        return;
      }

      const nextQuery = custom.detail?.query?.trim() ?? "";
      const requestId = custom.detail?.requestId;
      lastHandledStudyQueryRef.current = nextQuery;
      setSearchQuery(nextQuery);

      if (requestId) {
        window.dispatchEvent(
          new CustomEvent("wr:explorer-search-complete", {
            detail: {
              requestId,
              ok: true,
              message: nextQuery ? "Search updated." : "Search cleared.",
            },
          }),
        );
      }
    };

    const onClear = (event: Event) => {
      const custom = event as CustomEvent<{ scope?: "level" | "jlpt" | "study" | "all" }>;
      const targetScope = custom.detail?.scope ?? "all";
      if (targetScope !== "all" && targetScope !== "study") {
        return;
      }

      setSearchQuery("");
      lastHandledStudyQueryRef.current = "";
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("wr:explorer-search", onSearch as EventListener);
    window.addEventListener("wr:explorer-search-clear", onClear as EventListener);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("wr:explorer-search", onSearch as EventListener);
      window.removeEventListener("wr:explorer-search-clear", onClear as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!data?.counts) {
      return;
    }

    setPersistedCounts(data.counts);
    window.localStorage.setItem(countsStorageKey, JSON.stringify(data.counts));
    window.dispatchEvent(
      new CustomEvent("wr:study-counts-updated", {
        detail: {
          accountId,
          reviews: data.counts.reviews,
          lessons: data.counts.lessons,
        },
      }),
    );
  }, [accountId, countsStorageKey, data?.counts]);

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

  const allLevelsSelected = viewedLevel === null;

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    const normalizedQuery = normalizeStudySearch(searchQuery);
    return items.filter((item) => {
      if (viewedLevel !== null) {
        const itemLevel = item.wkLevel;
        if (typeof itemLevel !== "number" || itemLevel !== viewedLevel) {
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

      if (!showLocked && item.status === "locked") {
        return false;
      }

      if (!itemMatchesStudyQuery(item, normalizedQuery)) {
        return false;
      }

      return true;
    });
  }, [data?.items, queueMode, searchQuery, showLocked, srsFilter, typeFilter, viewedLevel]);

  const typeCounts = useMemo(() => {
    const countsByType = {
      all: 0,
      radical: 0,
      kanji: 0,
      vocabulary: 0,
    };

    for (const item of data?.items ?? []) {
      if (item.queueType !== queueMode) {
        continue;
      }

      if (viewedLevel !== null) {
        const itemLevel = item.wkLevel;
        if (typeof itemLevel !== "number" || itemLevel !== viewedLevel) {
          continue;
        }
      }

      if (srsFilter !== "all" && item.status !== srsFilter) {
        continue;
      }

      if (!showLocked && item.status === "locked") {
        continue;
      }

      countsByType.all += 1;
      if (item.subjectType === "radical") {
        countsByType.radical += 1;
      } else if (item.subjectType === "kanji") {
        countsByType.kanji += 1;
      } else {
        countsByType.vocabulary += 1;
      }
    }

    return countsByType;
  }, [data?.items, queueMode, showLocked, srsFilter, viewedLevel]);

  const srsCounts = useMemo(() => {
    const countsBySrs: {
      all: number;
      apprentice: number;
      guru: number;
      master: number;
      enlightened: number;
    } = {
      all: 0,
      apprentice: 0,
      guru: 0,
      master: 0,
      enlightened: 0,
    };

    for (const item of data?.items ?? []) {
      if (item.queueType !== queueMode) {
        continue;
      }

      if (viewedLevel !== null) {
        const itemLevel = item.wkLevel;
        if (typeof itemLevel !== "number" || itemLevel !== viewedLevel) {
          continue;
        }
      }

      if (typeFilter !== "all" && item.subjectType !== typeFilter) {
        continue;
      }

      if (!showLocked && item.status === "locked") {
        continue;
      }

      countsBySrs.all += 1;
      if (item.status === "apprentice") {
        countsBySrs.apprentice += 1;
      } else if (item.status === "guru") {
        countsBySrs.guru += 1;
      } else if (item.status === "master") {
        countsBySrs.master += 1;
      } else if (item.status === "enlightened") {
        countsBySrs.enlightened += 1;
      }
    }

    return countsBySrs;
  }, [data?.items, queueMode, showLocked, typeFilter, viewedLevel]);

  useEffect(() => {
    if (typeFilter === "all") {
      return;
    }

    if (typeCounts[typeFilter] <= 0) {
      setTypeFilter("all");
    }
  }, [typeCounts, typeFilter]);

  useEffect(() => {
    if (srsFilter === "locked") {
      setSrsFilter("all");
    }
  }, [srsFilter]);

  useEffect(() => {
    window.localStorage.setItem(levelStorageKey, viewedLevel === null ? "all" : String(viewedLevel));
  }, [levelStorageKey, viewedLevel]);

  useEffect(() => {
    window.localStorage.setItem(typeStorageKey, typeFilter);
  }, [typeFilter, typeStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(srsStorageKey, srsFilter);
  }, [srsFilter, srsStorageKey]);

  useEffect(() => {
    setSelectedId(null);
  }, [queueMode]);

  useEffect(() => {
    if (selectedId === null) {
      setSubmitFeedback(null);
      setSubmitInFlight(null);
      setReviewTally({ correct: 0, wrong: 0 });
    }
  }, [selectedId]);

  useEffect(() => {
    if (viewedLevel === null) {
      return;
    }

    if (!availableLevels.has(viewedLevel)) {
      setViewedLevel(null);
    }
  }, [availableLevels, viewedLevel]);

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
  const isSubmittingSelected = selectedItem ? submittingByAssignmentId.has(selectedItem.assignmentId) : false;
  const isReviewAwaitingGrade = Boolean(
    selectedItem && selectedItem.queueType === "review" && isAnswerRevealed,
  );

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
    const itemForSubmit =
      filteredItems.find((item) => item.assignmentId === assignmentId) ?? selectedItem ?? null;
    const isSubmittingSelectedItem = selectedItem?.assignmentId === assignmentId;
    const currentSelectedIndex = isSubmittingSelectedItem ? selectedIndex : -1;
    const nextCandidate =
      currentSelectedIndex >= 0 && currentSelectedIndex < filteredItems.length - 1
        ? filteredItems[currentSelectedIndex + 1]
        : null;
    const previousCandidate = currentSelectedIndex > 0 ? filteredItems[currentSelectedIndex - 1] : null;
    const nextSelectedSubjectId = nextCandidate?.subjectId ?? previousCandidate?.subjectId ?? null;

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

      if (isSubmittingSelectedItem && nextSelectedSubjectId !== null) {
        setSelectedId(nextSelectedSubjectId);
      }

      setSubmitFeedback({
        kind: "success",
        message: `${result === "correct" ? "Correct" : "Wrong"} submitted for ${
          itemForSubmit ? `${itemForSubmit.characters} (${studyItemEnglishTitle(itemForSubmit)})` : "item"
        }.`,
      });
      setReviewTally((prev) => ({
        correct: prev.correct + (result === "correct" ? 1 : 0),
        wrong: prev.wrong + (result === "wrong" ? 1 : 0),
      }));

      void mutate();
      window.dispatchEvent(new CustomEvent("wr:user-refreshed", { detail: { accountId } }));
    } catch (submitError) {
      console.error(submitError);
      const message = submitError instanceof Error ? submitError.message : "Could not submit review.";
      setSubmitFeedback({ kind: "error", message });
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
  }

  function revealAnswer(assignmentId: number) {
    setRevealedAssignmentIds((prev) => new Set(prev).add(assignmentId));
  }

  function toggleLevel(level: number) {
    if (!availableLevels.has(level)) {
      return;
    }

    setViewedLevel(level);
  }

  function selectAllLevels() {
    setViewedLevel(null);
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
      const navigationLocked = selectedItem.queueType === "review" && isAnswerRevealed;

      if (!isAnswerRevealed && (event.key === "Enter" || key === "r" || event.code === "Space")) {
        event.preventDefault();
        revealAnswer(selectedItem.assignmentId);
        return;
      }

      if (!navigationLocked && (event.key === "ArrowLeft" || event.key === "ArrowUp" || key === "a" || key === "w")) {
        event.preventDefault();
        moveSelection(-1);
        return;
      }

      if (!navigationLocked && (event.key === "ArrowRight" || event.key === "ArrowDown" || key === "d" || key === "s")) {
        event.preventDefault();
        moveSelection(1);
        return;
      }

      if (!navigationLocked && event.key === "Home") {
        event.preventDefault();
        setSelectedId(filteredItems[0]?.subjectId ?? null);
        return;
      }

      if (!navigationLocked && event.key === "End") {
        event.preventDefault();
        setSelectedId(filteredItems[filteredItems.length - 1]?.subjectId ?? null);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedId(null);
        return;
      }

      if (!isAnswerRevealed) {
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-foreground">Study</h2>
            <p className="text-xs uppercase tracking-[0.08em] text-foreground/70">
              Reviews due now and available lessons across all levels
            </p>
          </div>
          <div className="w-full lg:max-w-[38rem]">
            <ExplorerSearchBar scope="study" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={selectAllLevels} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(allLevelsSelected)}`}>
            All Levels
          </button>
          {levelOptions.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              disabled={!availableLevels.has(level)}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
                !availableLevels.has(level)
                  ? disabledBadgeClass()
                  : badgeClass(viewedLevel === level)
              }`}
            >
              L{level}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {(["all", "radical", "kanji", "vocabulary"] as const).map((type) => {
            const count = typeCounts[type];
            const isDisabled = type !== "all" && count <= 0;
            const isTypeActive = typeFilter === type || (type !== "all" && typeFilter === "all");
            const label =
              type === "vocabulary"
                ? `vocab (${formatNumber(count)})`
                : type === "radical"
                  ? `radical (${formatNumber(count)})`
                  : type === "kanji"
                    ? `kanji (${formatNumber(count)})`
                    : viewedLevel !== null
                      ? `all L${viewedLevel} (${formatNumber(count)})`
                      : `all (${formatNumber(count)})`;

            return (
              type === "all" ? (
              <button
                key={type}
                type="button"
                disabled={isDisabled}
                onClick={() => setTypeFilter(type)}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
                  isDisabled ? disabledBadgeClass() : badgeClass(isTypeActive)
                }`}
              >
                {label}
              </button>
              ) : (
              <SubjectTypeFilterButton
                key={type}
                type={type}
                count={count}
                active={isTypeActive}
                disabled={isDisabled}
                onClick={() => setTypeFilter(type)}
              />
              )
            );
          })}
          {(["all", "apprentice", "guru", "master", "enlightened"] as const).map((status) => (
            <button key={status} type="button" onClick={() => setSrsFilter(status)} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(srsFilter === status)}`}>
              {status === "all"
                ? viewedLevel !== null
                  ? `all L${viewedLevel} (${formatNumber(srsCounts.all)})`
                  : `all (${formatNumber(srsCounts.all)})`
                : status === "apprentice"
                ? `appr (${formatNumber(srsCounts.apprentice)})`
                : status === "enlightened"
                  ? `enlight (${formatNumber(srsCounts.enlightened)})`
                  : `${status} (${formatNumber(srsCounts[status])})`}
            </button>
          ))}
        </div>
      </header>

      {error ? <p className="px-5 py-4 text-sm text-red-700">{error.message}</p> : null}

      <div className="p-5">
        {isLoading && !data ? (
          <>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65">Loading study queue...</p>
            <StudySkeletonCards />
          </>
        ) : null}

        {filteredItems.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-foreground/70">
            <p>No study items match the current filters.</p>
            <div className="mt-2 inline-flex items-center gap-1 text-foreground/50" aria-hidden="true">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/30 animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/30 animate-pulse [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/30 animate-pulse [animation-delay:300ms]" />
            </div>
          </div>
        ) : null}

        {filteredItems.length > 0 ? (
          <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65">
              Showing {formatNumber(visibleItems.length)} of {formatNumber(filteredItems.length)} items
            </p>
            <button
              type="button"
              onClick={() => setShowLocked((prev) => !prev)}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
            >
              {showLocked ? "Hide Locked" : "Show Locked"}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleItems.map((item, index) => {
              const reviewBadge = item.queueType === "review" ? formatNextReviewBadge(item.availableAt) : null;

              return (
                <UnifiedExplorerCard
                  key={`${item.queueType}-${item.subjectId}`}
                  onClick={() => setSelectedId(item.subjectId)}
                  className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${typeCardClass(
                    item.subjectType,
                    false,
                  )}`}
                  indexLabel={`#${index + 1}`}
                  topRight={
                    <>
                      <span className={subjectTypePillClass(item.subjectType)}>{shortSubjectTypeLabel(item.subjectType)}</span>
                      {typeof item.wkLevel === "number" ? (
                        <span className="subject-pill border-line bg-surface text-foreground">L{item.wkLevel}</span>
                      ) : null}
                    </>
                  }
                  title={
                    studyMode
                      ? item.subjectType === "kanji"
                        ? "Kanji"
                        : item.subjectType === "radical"
                          ? "Radical"
                          : "Vocabulary"
                      : titleForDisplay(item, showEnglish)
                  }
                  titleTooltip={titleForDisplay(item, showEnglish)}
                  glyphClassName={typeGlyphBoxClass(item.subjectType)}
                  glyphText={item.characters}
                  glyphTextClassName={glyphTextSizeClass(item.characters)}
                  glyphSubtitle={studyMode ? <span className="text-foreground/45">...</span> : (glyphSubtitleForDisplay(item) ?? "")}
                  statusChip={
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase whitespace-nowrap ${statusClass(item.status)}`}>
                      {statusShortLabel(item.status)}
                    </span>
                  }
                  middleChip={
                    reviewBadge ? (
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase whitespace-nowrap ${reviewBadge.className}`}>
                        {reviewBadge.label}
                      </span>
                    ) : undefined
                  }
                  rightChip={
                    <span className="rounded-full border border-line bg-surface px-2 py-1 text-xs font-bold text-foreground">
                      SRS {item.srsStage}
                    </span>
                  }
                />
              );
            })}
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
                    disabled={selectedIndex <= 0 || isReviewAwaitingGrade}
                    className="h-10 min-w-[6.75rem] rounded-full border border-line bg-surface px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-xs"
                  >
                    Prev
                  </button>
                  {prevItem ? (
                    <>
                      <span className="subject-pill inline-flex h-10 items-center border-line bg-surface px-3 text-foreground">{prevItem.characters}</span>
                      <span className={`${subjectTypePillClass(prevItem.subjectType)} inline-flex h-10 items-center px-3`}>{shortSubjectTypeLabel(prevItem.subjectType)}</span>
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
                    disabled={selectedIndex >= filteredItems.length - 1 || isReviewAwaitingGrade}
                    className="h-10 min-w-[6.75rem] rounded-full border border-line bg-surface px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-xs"
                  >
                    Next
                  </button>
                  {nextItem ? (
                    <>
                      <span className="subject-pill inline-flex h-10 items-center border-line bg-surface px-3 text-foreground">{nextItem.characters}</span>
                      <span className={`${subjectTypePillClass(nextItem.subjectType)} inline-flex h-10 items-center px-3`}>{shortSubjectTypeLabel(nextItem.subjectType)}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              {isSubmittingSelected ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface/80 backdrop-blur-[1px]">
                  <div className="inline-flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-foreground">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                    {submitInFlight
                      ? `Submitting ${submitInFlight.result.toUpperCase()} for ${submitInFlight.itemLabel}...`
                      : "Submitting..."}
                  </div>
                </div>
              ) : null}

              <LevelExplorerDetailSection
                selectedItem={selectedItem}
                showEnglish={showEnglish}
                studyMode
                revealStudyReading={isAnswerRevealed}
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
                  {!isAnswerRevealed ? (
                    <button
                      type="button"
                      onClick={() => revealAnswer(selectedItem.assignmentId)}
                      className="w-full rounded-full border border-line bg-surface px-4 py-3 text-sm font-black uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
                    >
                      Show Answer
                    </button>
                  ) : (
                    <div className="grid w-full grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => submitReview(selectedItem.assignmentId, "wrong")}
                        disabled={submittingByAssignmentId.has(selectedItem.assignmentId)}
                        className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-4 text-sm font-black uppercase tracking-[0.1em] text-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Wrong (1)
                      </button>
                      <button
                        type="button"
                        onClick={() => submitReview(selectedItem.assignmentId, "correct")}
                        disabled={submittingByAssignmentId.has(selectedItem.assignmentId)}
                        className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-sm font-black uppercase tracking-[0.1em] text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Correct (2)
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {selectedItem.queueType !== "review" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!isAnswerRevealed ? (
                    <button
                      type="button"
                      onClick={() => revealAnswer(selectedItem.assignmentId)}
                      className="w-full rounded-full border border-line bg-surface px-4 py-3 text-sm font-black uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
                    >
                      Show Answer
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 grid w-full grid-cols-2 gap-3">
                <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-700/80">Wrong</p>
                  <p className="mt-1 text-3xl font-black leading-none text-red-800">{reviewTally.wrong}</p>
                </div>
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700/80">Correct</p>
                  <p className="mt-1 text-3xl font-black leading-none text-emerald-800">{reviewTally.correct}</p>
                </div>
              </div>

              <div className="mt-auto pt-4">
                <div className="min-h-[3.25rem]">
                {submitFeedback ? (
                  <p
                    className={`rounded-xl border px-4 py-3 text-sm font-black uppercase tracking-[0.08em] ${
                      submitFeedback.kind === "success"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-red-300 bg-red-50 text-red-800"
                    }`}
                  >
                    {submitFeedback.message}
                  </p>
                ) : null}
                </div>

                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/60">
                  Shortcuts: Left/Right/Up/Down or W/A/S/D (prev/next), Home/End (first/last), Esc (back)
                  {!isAnswerRevealed
                    ? ", Enter/R/Space=show answer"
                    : selectedItem.queueType === "review"
                      ? ", 1=wrong, 2=correct"
                      : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
