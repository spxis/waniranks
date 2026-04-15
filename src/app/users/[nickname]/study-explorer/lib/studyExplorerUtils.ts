import { toRomaji } from "wanakana";

import type {
  QueueResponse,
  StoredQueuePayload,
  StudyCounts,
  StudyQueueItem,
  StudySrsFilter,
  StudyTypeFilter,
} from "./studyExplorerTypes";

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

export function readStoredQueue(accountId: string, mode: "review" | "lesson"): QueueResponse | undefined {
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

export function persistQueue(
  accountId: string,
  queueMode: "review" | "lesson",
  items: StudyQueueItem[],
  totalItems: number,
  counts: StudyCounts | null,
  levelCounts?: Record<number, number>,
  typeCounts?: { all: number; radical: number; kanji: number; vocabulary: number },
  typeCountsByLevel?: Record<
    number,
    { all: number; radical: number; kanji: number; vocabulary: number }
  >,
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
        reviews: items.filter((item) => item.queueType === "review").length,
        lessons: items.filter((item) => item.queueType === "lesson").length,
      },
      levelCounts,
      typeCounts,
      typeCountsByLevel,
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

export function disabledBadgeClass(): string {
  return "cursor-not-allowed border-line bg-surface-muted text-foreground/45";
}

export function studyItemEnglishTitle(item: StudyQueueItem): string {
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

export function filterStudyItems(
  items: StudyQueueItem[],
  queueMode: "review" | "lesson",
  viewedLevel: number | null,
  typeFilter: StudyTypeFilter,
  srsFilter: StudySrsFilter,
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

    if (typeFilter !== "all" && item.subjectType !== typeFilter) {
      return false;
    }

    if (srsFilter !== "all" && item.status !== srsFilter) {
      return false;
    }

    if (!showLocked && item.status === "locked") {
      return false;
    }

    return itemMatchesStudyQuery(item, normalizedQuery);
  });
}
