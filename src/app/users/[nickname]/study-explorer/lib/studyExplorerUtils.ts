import { toRomaji } from "wanakana";
import { SUBJECT_TYPE_DISPLAY, SUBJECT_TYPES } from "@/lib/domainConstants";

import type {
  QueueResponse,
  StoredQueuePayload,
  StudyCounts,
  StudyQueueMode,
  StudyQueueItem,
  StudySrsFilter,
  StudySrsStageFilter,
  StudyTypeFilter,
  StudyWaitSortOrder,
} from "./studyExplorerTypes";
import {
  isAllStudySrsFilter,
  isAllStudyTypeFilter,
  isKanjiSubjectType,
  isRadicalSubjectType,
  STUDY_QUEUE_TYPES,
  STUDY_WK_STATUSES,
} from "./studyExplorerDomain";

export const STUDY_QUEUE_STORAGE_TTL_MS = 90_000;
export const STUDY_RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

function parseTimestampMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestampMs = Date.parse(value);
  return Number.isNaN(timestampMs) ? null : timestampMs;
}

export function isRecentStudyItem(item: StudyQueueItem, nowMs: number = Date.now()): boolean {
  const anchorMs = parseTimestampMs(item.startedAt) ?? parseTimestampMs(item.availableAt);
  if (anchorMs === null) {
    return false;
  }

  return anchorMs >= nowMs - STUDY_RECENT_WINDOW_MS && anchorMs <= nowMs;
}

export async function fetchStudyQueue(url: string): Promise<QueueResponse> {
  const response = await fetch(url);
  const data = (await response.json()) as QueueResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Could not fetch study queue.");
  }
  return data;
}

export function normalizeStudySearch(value: string): string {
  return value.trim().toLowerCase();
}

export function itemMatchesStudyQuery(item: StudyQueueItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }

  if (normalizeStudySearch(item.characters).includes(normalizedQuery)) {
    return true;
  }

  if (item.meanings.some((meaning) => normalizeStudySearch(meaning).includes(normalizedQuery))) {
    return true;
  }

  const readings = [...(item.primaryReadings ?? []), ...(item.readings ?? [])];
  if (readings.some((reading) => normalizeStudySearch(reading).includes(normalizedQuery))) {
    return true;
  }

  const romaji = normalizeStudySearch(
    toRomaji(`${item.characters} ${readings.join(" ")}`, { upcaseKatakana: false }),
  );
  return romaji.includes(normalizedQuery);
}

export function readStoredQueue(accountId: string, mode: StudyQueueMode): QueueResponse | undefined {
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

export function readStoredQueueMeta(
  accountId: string,
  mode: StudyQueueMode,
): { cachedAtMs: number; restoredCount: number; totalCount: number } | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(`wr:study-queue:${accountId}:${mode}`);
  if (!raw) {
    return null;
  }

  try {
    const payload = JSON.parse(raw) as StoredQueuePayload;
    if (!payload || typeof payload.cachedAtMs !== "number" || !payload.data) {
      return null;
    }

    return {
      cachedAtMs: payload.cachedAtMs,
      restoredCount: payload.data.items.length,
      totalCount: payload.data.pagination?.total ?? payload.data.items.length,
    };
  } catch {
    return null;
  }
}

export function persistQueue(
  accountId: string,
  queueMode: StudyQueueMode,
  items: StudyQueueItem[],
  totalItems: number,
  counts: StudyCounts | null,
  levelCounts?: Record<number, number>,
  typeCounts?: { all: number; radical: number; kanji: number; vocabulary: number },
  typeCountsByLevel?: Record<
    number,
    { all: number; radical: number; kanji: number; vocabulary: number }
  >,
  srsCounts?: {
    all: number;
    locked: number;
    apprentice: number;
    guru: number;
    master: number;
    enlightened: number;
    burned: number;
  },
  srsStageCounts?: Record<number, number>,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload: StoredQueuePayload = {
    cachedAtMs: Date.now(),
    data: {
      items,
      counts: counts ?? {
        all: items.length,
        reviews: items.filter((item) => item.queueType === STUDY_QUEUE_TYPES.review).length,
        lessons: items.filter((item) => item.queueType === STUDY_QUEUE_TYPES.lesson).length,
      },
      levelCounts,
      typeCounts,
      typeCountsByLevel,
      srsCounts,
      srsStageCounts,
      pagination: {
        offset: 0,
        limit: items.length,
        total: totalItems,
        hasMore: items.length < totalItems,
      },
    },
  };

  window.localStorage.setItem(`wr:study-queue:${accountId}:${queueMode}`, JSON.stringify(payload));
}

export function badgeClass(active: boolean): string {
  return active
    ? "border-accent bg-accent text-white"
    : "border-line bg-surface text-foreground hover:bg-surface-muted";
}

export function allBadgeClass(active: boolean): string {
  return active
    ? "border-slate-500 bg-slate-300 text-slate-900"
    : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200";
}

export function disabledBadgeClass(): string {
  return "cursor-not-allowed border-line bg-surface-muted text-foreground/45";
}

export type StudyReviewLevelChip =
  | { kind: "single"; level: number }
  | { kind: "range"; startLevel: number; endLevel: number };

export function groupStudyReviewLevelChips(
  levelOptions: number[],
  availableLevels: Set<number>,
  viewedLevel: number | null,
  hasData: boolean,
): StudyReviewLevelChip[] {
  const grouped: StudyReviewLevelChip[] = [];
  let rangeStart: number | null = null;
  let rangeEnd: number | null = null;

  const flushRange = () => {
    if (rangeStart === null || rangeEnd === null) {
      return;
    }

    grouped.push({ kind: "range", startLevel: rangeStart, endLevel: rangeEnd });

    rangeStart = null;
    rangeEnd = null;
  };

  for (const level of levelOptions) {
    const isSelected = viewedLevel === level;
    const unavailable = hasData && !isSelected && !availableLevels.has(level);

    if (unavailable) {
      if (rangeStart === null) {
        rangeStart = level;
      }
      rangeEnd = level;
      continue;
    }

    flushRange();
    grouped.push({ kind: "single", level });
  }

  flushRange();
  return grouped;
}

export function studyItemEnglishTitle(item: StudyQueueItem): string {
  const meaning = item.meanings.find((entry) => entry.trim().length > 0) ?? "";
  if (meaning) {
    return meaning;
  }

  if (isKanjiSubjectType(item.subjectType)) {
    return SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.kanji].singular;
  }

  if (isRadicalSubjectType(item.subjectType)) {
    return SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.radical].singular;
  }

  return SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.vocabulary].singular;
}

export function filterStudyItems(
  items: StudyQueueItem[],
  queueMode: StudyQueueMode,
  viewedLevel: number | null,
  typeFilter: StudyTypeFilter,
  srsFilter: StudySrsFilter,
  srsStageFilter: StudySrsStageFilter | null,
  showLocked: boolean,
  recentOnly: boolean,
  searchQuery: string,
): StudyQueueItem[] {
  const normalizedQuery = normalizeStudySearch(searchQuery);
  const nowMs = Date.now();

  return items.filter((item) => {
    if (recentOnly && !isRecentStudyItem(item, nowMs)) {
      return false;
    }

    if (viewedLevel !== null) {
      if (typeof item.wkLevel !== "number" || item.wkLevel !== viewedLevel) {
        return false;
      }
    }

    if (item.queueType !== queueMode) {
      return false;
    }

    if (!isAllStudyTypeFilter(typeFilter) && item.subjectType !== typeFilter) {
      return false;
    }

    if (!isAllStudySrsFilter(srsFilter) && item.status !== srsFilter) {
      return false;
    }

    if (srsStageFilter !== null && item.srsStage !== srsStageFilter) {
      return false;
    }

    if (!showLocked && item.status === STUDY_WK_STATUSES.locked) {
      return false;
    }

    return itemMatchesStudyQuery(item, normalizedQuery);
  });
}

export function sortStudyItemsByWait(items: StudyQueueItem[], sortOrder: StudyWaitSortOrder): StudyQueueItem[] {
  const direction = sortOrder === "oldest_wait" ? 1 : -1;

  return [...items].sort((a, b) => {
    const aMs = parseTimestampMs(a.availableAt) ?? parseTimestampMs(a.startedAt) ?? 0;
    const bMs = parseTimestampMs(b.availableAt) ?? parseTimestampMs(b.startedAt) ?? 0;
    const diff = aMs - bMs;
    if (diff !== 0) {
      return direction * diff;
    }

    return a.subjectId - b.subjectId;
  });
}
