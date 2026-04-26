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
const MAX_SESSION_KANJI = 48;

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
const sessionKanjiOrder: string[] = [];
const sessionKnownItemByKanji = new Map<string, StudyQueueItem>();

export function availabilityForRun(run: string): "unknown" | "known" | "missing" {
  return runAvailabilityFromCache(run);
}

export async function prefetchNewsGlyphCandidates(
  candidates: string[],
): Promise<"unknown" | "known" | "missing"> {
  const normalized = normalizeCandidateRuns(candidates);
  if (normalized.length === 0) {
    return "unknown";
  }

  const selected = await selectBestCandidate(normalized, {
    requestId: null,
    abortSignal: undefined,
    requireKnown: false,
  });
  if (!selected) {
    return normalized.some((run) => availabilityForRun(run) === "known") ? "known" : "unknown";
  }

  const result = selected.resolved.result;
  if (result.vocabulary?.subjectId) {
    return "known";
  }

  if (result.kanjiItems.some((item) => item.subjectId !== null)) {
    return "known";
  }

  return "missing";
}

export async function prefetchNewsGlyphRun(run: string): Promise<"unknown" | "known" | "missing"> {
  return prefetchNewsGlyphCandidates([run]);
}

export async function openNewsGlyphCandidates(candidates: string[]): Promise<boolean> {
  const normalized = normalizeCandidateRuns(candidates);
  if (normalized.length === 0) {
    return false;
  }

  const dedupeKey = normalized[0];
  if (activeOpenRequest?.run === dedupeKey) {
    return activeOpenRequest.promise;
  }

  if (activeOpenRequest && activeOpenRequest.run !== dedupeKey) {
    activeOpenRequest.abortController?.abort();
  }

  const requestId = ++requestSequence;
  const abortController = new AbortController();

  // Register the active request before any async selection checks run.
  const requestState: {
    run: string;
    requestId: number;
    abortController: AbortController | null;
    promise: Promise<boolean>;
  } = {
    run: dedupeKey,
    requestId,
    abortController,
    promise: Promise.resolve(false),
  };
  activeOpenRequest = requestState;

  const openTask = (async () => {
    const selected = await selectBestCandidate(normalized, {
      requestId,
      abortSignal: abortController.signal,
      requireKnown: true,
    });
    if (!selected) {
      return false;
    }

    const value = selected.run;
    const lastOpenAt = recentOpenAtByRun.get(value) ?? 0;
    if (Date.now() - lastOpenAt < OPEN_COOLDOWN_MS) {
      return false;
    }

    if (activeOpenRequest?.requestId !== requestId) {
      return false;
    }

    const { accountId, result } = selected.resolved;

    const { items, selector } = buildViewerState(value, result);
    const currentSelector = selector.filter((entry) => entry.origin !== "session");

    recordNewsKanjiClick({
      run: value,
      hasVocabulary: Boolean(result.vocabulary?.subjectId),
      knownCount: currentSelector.filter((entry) => entry.exists).length,
      totalCount: currentSelector.length,
    });

    recordNewsGlyphViews({
      run: value,
      glyphs: currentSelector
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

  requestState.promise = openTask;
  return openTask;
}

export async function openNewsGlyphRun(run: string): Promise<boolean> {
  return openNewsGlyphCandidates([run]);
}

async function selectBestCandidate(
  candidates: string[],
  options: { requestId: number | null; abortSignal: AbortSignal | undefined; requireKnown: boolean },
): Promise<{ run: string; resolved: ResolvedLookup } | null> {
  let best: { run: string; resolved: ResolvedLookup; score: number } | null = null;

  for (const candidate of candidates) {
    if (options.requestId !== null && activeOpenRequest?.requestId !== options.requestId) {
      return null;
    }

    const resolved = await resolveLookup(candidate, options);
    if (!resolved) {
      continue;
    }

    const knownKanjiCount = resolved.result.kanjiItems.filter((item) => item.subjectId !== null).length;
    const hasVocab = Boolean(resolved.result.vocabulary?.subjectId);
    const openable = hasVocab || knownKanjiCount > 0;
    if (options.requireKnown && !openable) {
      continue;
    }

    // For explicit click/open, preserve user intent: first openable candidate wins.
    if (options.requireKnown && openable) {
      return { run: candidate, resolved };
    }

    const score = candidateScore(candidate, resolved.result);
    if (!best || score > best.score) {
      best = { run: candidate, resolved, score };
    }

    if (resolved.result.vocabulary?.subjectId && candidate.length > 1) {
      break;
    }
  }

  return best ? { run: best.run, resolved: best.resolved } : null;
}

function candidateScore(run: string, result: LookupRunResult): number {
  const knownKanji = result.kanjiItems.filter((item) => item.subjectId !== null).length;
  const hasVocab = Boolean(result.vocabulary?.subjectId);
  let score = knownKanji * 3 + Math.min(run.length, 8);
  if (hasVocab) {
    score += 120;
  }
  if (run.length === 1) {
    score -= 6;
  }
  return score;
}

function normalizeCandidateRuns(candidates: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const value = raw.trim();
    if (!value || value.length > 24 || !KANJI_REGEX.test(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
    if (out.length >= 6) {
      break;
    }
  }
  return out;
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
      origin: "current",
    });
  } else {
    selector.push({
      label: run,
      kind: "vocabulary",
      exists: false,
      itemIndex: null,
      origin: "current",
    });
  }

  const kanjiByChar = new Map<string, LookupGlyphItem>();
  for (const item of result.kanjiItems) {
    kanjiByChar.set(item.text, item);
  }

  for (const char of Array.from(run).filter((entry) => KANJI_REGEX.test(entry))) {
    const info = kanjiByChar.get(char);
    rememberSessionKanji(char);
    if (!info || info.subjectId === null) {
      selector.push({
        label: char,
        kind: "kanji",
        exists: false,
        itemIndex: null,
        origin: "current",
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

    sessionKnownItemByKanji.set(char, toStudyQueueItem(info));

    selector.push({
      label: char,
      kind: "kanji",
      exists: true,
      itemIndex: index,
      origin: "current",
    });
  }

  const currentRunKanji = new Set(selector.filter((entry) => entry.kind === "kanji").map((entry) => entry.label));
  for (const char of sessionKanjiOrder) {
    if (currentRunKanji.has(char)) {
      continue;
    }

    const knownItem = sessionKnownItemByKanji.get(char);
    if (!knownItem) {
      selector.push({
        label: char,
        kind: "kanji",
        exists: false,
        itemIndex: null,
        origin: "session",
      });
      continue;
    }

    const key = `k:${char}`;
    let index = indexByKey.get(key);
    if (index === undefined) {
      index = items.length;
      indexByKey.set(key, index);
      items.push(knownItem);
    }

    selector.push({
      label: char,
      kind: "kanji",
      exists: true,
      itemIndex: index,
      origin: "session",
    });
  }

  return { items, selector };
}

function rememberSessionKanji(char: string): void {
  const existingIndex = sessionKanjiOrder.indexOf(char);
  if (existingIndex >= 0) {
    sessionKanjiOrder.splice(existingIndex, 1);
  }
  sessionKanjiOrder.push(char);

  if (sessionKanjiOrder.length > MAX_SESSION_KANJI) {
    const removed = sessionKanjiOrder.shift();
    if (removed) {
      sessionKnownItemByKanji.delete(removed);
    }
  }
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
