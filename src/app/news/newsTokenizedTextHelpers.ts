import jlptReadings from "@/data/jlptReadings.json";
import type {
  NewsKanjiCapBasis,
  NewsKanjiCapGrade,
  NewsKanjiCapJlpt,
  NewsKanjiCapWk,
} from "./newsReadingPrefs";
import { isKanjiLevelPending } from "./newsEnrichmentCache";
import { readNewsKanjiHistory } from "./newsKanjiHistory";

type JlptRecord = Record<string, { nLevel?: number }>;

export const NEWS_TOKENIZED_KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

const jlptByChar = jlptReadings as JlptRecord;

export function collectSeenGlyphs(): Set<string> {
  const seen = new Set<string>();
  for (const entry of readNewsKanjiHistory()) {
    const run = entry.run.trim();
    if (!run) {
      continue;
    }
    seen.add(run);
    for (const token of extractKanjiTokens(run)) {
      seen.add(token);
    }
  }
  return seen;
}

export function extractKanjiTokens(value: string): string[] {
  return Array.from(value).filter((char) => NEWS_TOKENIZED_KANJI_REGEX.test(char));
}

export function isCapEnabled(
  basis: NewsKanjiCapBasis,
  jlptCap: NewsKanjiCapJlpt,
  wkCap: NewsKanjiCapWk,
  gradeCap: NewsKanjiCapGrade,
): boolean {
  if (basis === "jlpt") {
    return jlptCap !== "all";
  }
  if (basis === "wk") {
    return wkCap !== "all";
  }
  return gradeCap !== "all";
}

export function shouldDeemphasizeSegment(
  value: string,
  settings: {
    basis: NewsKanjiCapBasis;
    jlptCap: NewsKanjiCapJlpt;
    wkCap: NewsKanjiCapWk;
    gradeCap: NewsKanjiCapGrade;
    wkByChar: Record<string, number | null>;
    gradeByChar: Record<string, number | null>;
  },
): boolean {
  const chars = Array.from(value).filter((char) => NEWS_TOKENIZED_KANJI_REGEX.test(char));
  if (chars.length === 0) {
    return false;
  }

  if (settings.basis === "jlpt") {
    const threshold = jlptThresholdFromMode(settings.jlptCap);
    if (threshold === null) {
      return false;
    }
    return chars.some((char) => isJlptHarderThanThreshold(char, threshold));
  }

  if (settings.basis === "wk") {
    const threshold = wkThresholdFromMode(settings.wkCap);
    if (threshold === null) {
      return false;
    }
    return chars.some((char) => {
      const wkLevel = settings.wkByChar[char];
      return typeof wkLevel === "number" && wkLevel > threshold;
    });
  }

  const threshold = gradeThresholdFromMode(settings.gradeCap);
  if (threshold === null) {
    return false;
  }
  return chars.some((char) => {
    const grade = settings.gradeByChar[char];
    return typeof grade === "number" && grade > threshold;
  });
}

export function isSegmentLevelPending(
  value: string,
  settings: {
    basis: NewsKanjiCapBasis;
    wkByChar: Record<string, number | null>;
    gradeByChar: Record<string, number | null>;
  },
): boolean {
  if (settings.basis === "jlpt") {
    return false;
  }

  const chars = Array.from(value).filter((char) => NEWS_TOKENIZED_KANJI_REGEX.test(char));
  if (settings.basis === "wk") {
    return chars.some((char) => isKanjiLevelPending(char) || !(char in settings.wkByChar));
  }
  return chars.some((char) => isKanjiLevelPending(char) || !(char in settings.gradeByChar));
}

function jlptThresholdFromMode(mode: NewsKanjiCapJlpt): number | null {
  if (mode === "all") {
    return null;
  }

  const parsed = Number(mode.slice(1));
  return Number.isFinite(parsed) ? parsed : null;
}

function wkThresholdFromMode(mode: NewsKanjiCapWk): number | null {
  if (mode === "all") {
    return null;
  }

  const parsed = Number(mode);
  return Number.isFinite(parsed) ? parsed : null;
}

function gradeThresholdFromMode(mode: NewsKanjiCapGrade): number | null {
  if (mode === "all") {
    return null;
  }

  const parsed = Number(mode);
  return Number.isFinite(parsed) ? parsed : null;
}

function isJlptHarderThanThreshold(char: string, threshold: number): boolean {
  if (!NEWS_TOKENIZED_KANJI_REGEX.test(char)) {
    return false;
  }

  const nLevel = jlptByChar[char]?.nLevel;
  if (typeof nLevel !== "number") {
    return false;
  }

  return nLevel < threshold;
}
