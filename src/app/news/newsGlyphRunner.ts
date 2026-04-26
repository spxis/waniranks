"use client";

import type { StudyQueueItem } from "@/app/users/[nickname]/study-explorer/lib/studyExplorerTypes";
import type { LookupGlyphItem, LookupRunResult } from "@/lib/news/newsKanjiLookup";
import {
  openViewGlyphViewer,
  type ViewGlyphSelectorEntry,
} from "@/lib/viewGlyphViewer";

import {
  readRunLookupCache,
  runAvailabilityFromCache,
  writeRunLookupCache,
} from "./newsKanjiCache";
import { recordNewsKanjiClick } from "./newsKanjiHistory";
import { recordNewsGlyphViews } from "./newsGlyphStats";

type LookupResponse = {
  accountId: string;
  result: LookupRunResult;
};

type ResolvedLookup = {
  accountId: string;
  result: LookupRunResult;
};

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const OPEN_COOLDOWN_MS = 1000;
const MIN_LOOKUP_GAP_MS = 600;

const inFlightLookupByRun = new Map<string, Promise<ResolvedLookup | null>>();
let activeOpenRequest: {
  run: string;
  requestId: number;
  abortController: AbortController | null;
  promise: Promise<boolean>;
} | null = null;
let requestSequence = 0;
let lastLookupAtMs = 0;
const recentOpenAtByRun = new Map<string, number>();

export function availabilityForRun(run: string): "unknown" | "known" | "missing" {
  return runAvailabilityFromCache(run);
}

export async function prefetchNewsGlyphRun(run: string): Promise<"unknown" | "known" | "missing"> {
  const value = run.trim();
  if (!value || !KANJI_REGEX.test(value)) {
    return "unknown";
  }

  const resolved = await resolveLookup(value, {
    requestId: null,
    abortSignal: undefined,
  });
  if (!resolved) {
    return availabilityForRun(value);
  }

  if (resolved.result.vocabulary?.subjectId) {
    return "known";
  }

  if (resolved.result.kanjiItems.some((item) => item.subjectId !== null)) {
    return "known";
  }

  return "missing";
}

export async function openNewsGlyphRun(run: string): Promise<boolean> {
  const value = run.trim();
  if (!value || !KANJI_REGEX.test(value)) {
    return false;
  }

  if (activeOpenRequest?.run === value) {
    return activeOpenRequest.promise;
  }

  if (activeOpenRequest && activeOpenRequest.run !== value) {
    activeOpenRequest.abortController?.abort();
  }

  const requestId = ++requestSequence;
  const abortController = new AbortController();

  const openTask = (async () => {
    const lastOpenAt = recentOpenAtByRun.get(value) ?? 0;
    if (Date.now() - lastOpenAt < OPEN_COOLDOWN_MS) {
      return false;
    }

    const resolved = await resolveLookup(value, {
      requestId,
      abortSignal: abortController.signal,
    });
    if (!resolved) {
      return false;
    }

    if (activeOpenRequest?.requestId !== requestId) {
      return false;
    }

    const { accountId, result } = resolved;

    const { items, selector } = buildViewerState(value, result);

    recordNewsKanjiClick({
      run: value,
      hasVocabulary: Boolean(result.vocabulary?.subjectId),
      knownCount: selector.filter((entry) => entry.exists).length,
      totalCount: selector.length,
    });

    recordNewsGlyphViews({
      run: value,
      glyphs: selector
        .filter((entry) => entry.exists)
        .map((entry) => ({ label: entry.label, type: entry.kind })),
    });

    if (items.length === 0) {
      return false;
    }

    openViewGlyphViewer({
      accountId,
      items,
      selector,
      startIndex: 0,
      title: `Compound · ${value}`,
    });

    recentOpenAtByRun.set(value, Date.now());
    if (recentOpenAtByRun.size > 300) {
      const cutoff = Date.now() - 60_000;
      for (const [key, openedAt] of recentOpenAtByRun) {
        if (openedAt < cutoff) {
          recentOpenAtByRun.delete(key);
        }
      }
    }

    return true;
  })().finally(() => {
    if (activeOpenRequest?.requestId === requestId) {
      activeOpenRequest = null;
    }
  });

  activeOpenRequest = {
    run: value,
    requestId,
    abortController,
    promise: openTask,
  };
  return openTask;
}

async function resolveLookup(
  run: string,
  options: { requestId: number | null; abortSignal: AbortSignal | undefined },
): Promise<ResolvedLookup | null> {
  const cached = readRunLookupCache(run);
  if (cached) {
    return {
      accountId: cached.accountId,
      result: cached.result,
    };
  }

  const existing = inFlightLookupByRun.get(run);
  if (existing) {
    return existing;
  }

  const lookupTask = (async () => {
    const now = Date.now();
    const remaining = MIN_LOOKUP_GAP_MS - (now - lastLookupAtMs);
    if (remaining > 0) {
      await delay(remaining);
    }

    if (options.requestId !== null && activeOpenRequest?.requestId !== options.requestId) {
      return null;
    }

    const response = await fetch("/api/news/lookup-kanji", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run }),
      signal: options.abortSignal,
    });
    lastLookupAtMs = Date.now();

    const payload = (await response.json().catch(() => null)) as
      | (LookupResponse & { error?: string })
      | { error?: string }
      | null;

    if (!response.ok || !payload || !("result" in payload) || !payload.result) {
      return null;
    }

    const resolved = {
      accountId: payload.accountId,
      result: payload.result,
    };
    writeRunLookupCache(run, resolved.accountId, resolved.result);
    return resolved;
  })()
    .catch((error) => {
    if (error instanceof Error && error.name === "AbortError") {
      return null;
    }
    throw error;
    })
    .finally(() => {
      inFlightLookupByRun.delete(run);
    });

  inFlightLookupByRun.set(run, lookupTask);
  return lookupTask;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildViewerState(
  run: string,
  result: LookupRunResult,
): { items: StudyQueueItem[]; selector: ViewGlyphSelectorEntry[] } {
  const items: StudyQueueItem[] = [];
  const selector: ViewGlyphSelectorEntry[] = [];

  const indexByKey = new Map<string, number>();

  const vocabulary = result.vocabulary;
  if (vocabulary && vocabulary.subjectId !== null) {
    const vocabItem = toStudyQueueItem(vocabulary);
    indexByKey.set(`v:${vocabulary.text}`, items.length);
    items.push(vocabItem);
    selector.push({
      label: run,
      kind: "vocabulary",
      exists: true,
      itemIndex: 0,
    });
  } else {
    selector.push({
      label: run,
      kind: "vocabulary",
      exists: false,
      itemIndex: null,
    });
  }

  const kanjiByChar = new Map<string, LookupGlyphItem>();
  for (const item of result.kanjiItems) {
    kanjiByChar.set(item.text, item);
  }

  for (const char of Array.from(run).filter((entry) => KANJI_REGEX.test(entry))) {
    const info = kanjiByChar.get(char);
    if (!info || info.subjectId === null) {
      selector.push({
        label: char,
        kind: "kanji",
        exists: false,
        itemIndex: null,
      });
      continue;
    }

    const key = `k:${char}`;
    let index = indexByKey.get(key);
    if (index === undefined) {
      index = items.length;
      indexByKey.set(key, index);
      items.push(toStudyQueueItem(info));
    }

    selector.push({
      label: char,
      kind: "kanji",
      exists: true,
      itemIndex: index,
    });
  }

  return { items, selector };
}

function toStudyQueueItem(item: LookupGlyphItem): StudyQueueItem {
  if (item.subjectId === null) {
    throw new Error(`Cannot build StudyQueueItem for missing subject: ${item.text}`);
  }

  return {
    assignmentId: -1,
    queueType: "review",
    subjectId: item.subjectId,
    subjectType: item.subjectType,
    wkLevel: item.wkLevel ?? undefined,
    characters: item.text,
    meanings: item.meanings.length > 0 ? item.meanings : ["-"],
    readings: item.readings,
    primaryReadings: item.primaryReadings,
    radicals: [],
    visuallySimilar: [],
    usedInVocabulary: [],
    componentKanji: [],
    meaningExplanation: item.meaningExplanation || undefined,
    readingExplanation: item.readingExplanation || undefined,
    jlptLevel: null,
    jlptMeta: null,
    srsStage: 0,
    status: "locked",
    startedAt: null,
    passedAt: null,
    availableAt: null,
  };
}
