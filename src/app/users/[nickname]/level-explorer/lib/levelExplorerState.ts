import type { SrsFilter } from "../../explorerTypes";

export const LEVEL_FILTER_ALL = "all" as const;
export const LEVEL_TYPE_RADICAL = "radical" as const;
export const LEVEL_TYPE_KANJI = "kanji" as const;
export const LEVEL_TYPE_VOCABULARY = "vocabulary" as const;
export const LEVEL_STATUS_APPRENTICE = "apprentice" as const;
export const LEVEL_STATUS_GURU = "guru" as const;
export const LEVEL_STATUS_MASTER = "master" as const;
export const LEVEL_STATUS_ENLIGHTENED = "enlightened" as const;
export const LEVEL_STATUS_BURNED = "burned" as const;
export const LEVEL_STATUS_LOCKED = "locked" as const;

export const LEVEL_TYPE_FILTER_ALLOWED = [
  LEVEL_FILTER_ALL,
  LEVEL_TYPE_RADICAL,
  LEVEL_TYPE_KANJI,
  LEVEL_TYPE_VOCABULARY,
] as const;
export type TypeFilter = (typeof LEVEL_TYPE_FILTER_ALLOWED)[number];

export const LEVEL_JLPT_NONE = "none" as const;
export const LEVEL_JLPT_N5 = "n5" as const;
export const LEVEL_JLPT_N4 = "n4" as const;
export const LEVEL_JLPT_N3 = "n3" as const;
export const LEVEL_JLPT_N2 = "n2" as const;
export const LEVEL_JLPT_N1 = "n1" as const;
export const LEVEL_JLPT_FILTER_ALLOWED = [
  LEVEL_FILTER_ALL,
  LEVEL_JLPT_NONE,
  LEVEL_JLPT_N5,
  LEVEL_JLPT_N4,
  LEVEL_JLPT_N3,
  LEVEL_JLPT_N2,
  LEVEL_JLPT_N1,
] as const;
export type JlptFilter = (typeof LEVEL_JLPT_FILTER_ALLOWED)[number];

export const LEVEL_REVIEW_OVERDUE = "overdue" as const;
export const LEVEL_REVIEW_NEXT_1H = "next1h" as const;
export const LEVEL_REVIEW_NEXT_8H = "next8h" as const;
export const LEVEL_REVIEW_NEXT_24H = "next24h" as const;
export const LEVEL_REVIEW_NEXT_72H = "next72h" as const;
export const LEVEL_REVIEW_TIMING_ALLOWED = [
  LEVEL_FILTER_ALL,
  LEVEL_REVIEW_OVERDUE,
  LEVEL_REVIEW_NEXT_1H,
  LEVEL_REVIEW_NEXT_8H,
  LEVEL_REVIEW_NEXT_24H,
  LEVEL_REVIEW_NEXT_72H,
] as const;
export type ReviewTimingFilter = (typeof LEVEL_REVIEW_TIMING_ALLOWED)[number];

export type ExplorerUrlState = {
  levels: Set<number>;
  subjectId: number | null;
  srs: SrsFilter;
  type: TypeFilter;
  jlpt: JlptFilter;
  review: ReviewTimingFilter;
  recentOnly: boolean;
  stickyMerge: boolean;
};

export type TypeVisibility = {
  radical: boolean;
  kanji: boolean;
  vocabulary: boolean;
};

export const LEVEL_SRS_FILTER_ALLOWED = [
  LEVEL_FILTER_ALL,
  LEVEL_STATUS_APPRENTICE,
  LEVEL_STATUS_GURU,
  LEVEL_STATUS_MASTER,
  LEVEL_STATUS_ENLIGHTENED,
  LEVEL_STATUS_BURNED,
  LEVEL_STATUS_LOCKED,
] as const;

export const SRS_FILTER_ALLOWED: SrsFilter[] = [...LEVEL_SRS_FILTER_ALLOWED];

export const TYPE_FILTER_ALLOWED: TypeFilter[] = [...LEVEL_TYPE_FILTER_ALLOWED];
export const JLPT_FILTER_ALLOWED: JlptFilter[] = [...LEVEL_JLPT_FILTER_ALLOWED];
export const REVIEW_TIMING_ALLOWED: ReviewTimingFilter[] = [...LEVEL_REVIEW_TIMING_ALLOWED];

export type LevelExplorerStorageKeys = {
  typeVisibility: string;
  selectedSubject: string;
  stickyMerge: string;
  filtersCollapsed: string;
  recentOnly: string;
  showLocked: string;
  srsFilter: string;
  typeFilter: string;
  jlptFilter: string;
  reviewTimingFilter: string;
};

export function buildLevelExplorerStorageKeys(accountId: string): LevelExplorerStorageKeys {
  return {
    typeVisibility: `wr:explorer:${accountId}:type-visibility`,
    selectedSubject: `wr:explorer:${accountId}:selected-subject`,
    stickyMerge: `wr:explorer:${accountId}:sticky-merge`,
    filtersCollapsed: `wr:explorer:${accountId}:filters-collapsed`,
    recentOnly: `wr:explorer:${accountId}:recent-only`,
    showLocked: `wr:explorer:${accountId}:show-locked`,
    srsFilter: `wr:explorer:${accountId}:srs-filter`,
    typeFilter: `wr:explorer:${accountId}:type-filter`,
    jlptFilter: `wr:explorer:${accountId}:jlpt-filter`,
    reviewTimingFilter: `wr:explorer:${accountId}:review-timing-filter`,
  };
}

function parseBooleanParam(input: string | null, fallback: boolean): boolean {
  if (input === "1") {
    return true;
  }

  if (input === "0") {
    return false;
  }

  return fallback;
}

export function parseLevelExplorerUrlState(
  search: string,
  maxLevel: number,
  defaultLevel: number,
): ExplorerUrlState {
  const params = new URLSearchParams(search);

  const levelValues = (params.get("levels") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= maxLevel);

  const levels = new Set(levelValues.length > 0 ? levelValues : [defaultLevel]);

  const subjectRaw = Number(params.get("subject"));
  const subjectId = Number.isInteger(subjectRaw) && subjectRaw > 0 ? subjectRaw : null;

  const srsRaw = params.get("srs");
  const srs = SRS_FILTER_ALLOWED.includes(srsRaw as SrsFilter) ? (srsRaw as SrsFilter) : LEVEL_FILTER_ALL;

  const typeRaw = params.get("type");
  const type = TYPE_FILTER_ALLOWED.includes(typeRaw as TypeFilter) ? (typeRaw as TypeFilter) : LEVEL_FILTER_ALL;

  const jlptRaw = params.get("jlpt");
  const jlpt = JLPT_FILTER_ALLOWED.includes(jlptRaw as JlptFilter) ? (jlptRaw as JlptFilter) : LEVEL_FILTER_ALL;

  const reviewRaw = params.get("review");
  const review = REVIEW_TIMING_ALLOWED.includes(reviewRaw as ReviewTimingFilter)
    ? (reviewRaw as ReviewTimingFilter)
    : LEVEL_FILTER_ALL;

  return {
    levels,
    subjectId,
    srs,
    type,
    jlpt,
    review,
    recentOnly: parseBooleanParam(params.get("recent"), false),
    stickyMerge: parseBooleanParam(params.get("sticky"), false),
  };
}

export function buildLevelExplorerUrl(
  currentSearch: string,
  state: ExplorerUrlState,
): string {
  const params = new URLSearchParams(currentSearch);
  const levelsList = Array.from(state.levels.values()).sort((a, b) => a - b);

  params.set("levels", levelsList.join(","));

  if (state.subjectId === null) {
    params.delete("subject");
  } else {
    params.set("subject", String(state.subjectId));
  }

  params.set("srs", state.srs);
  params.set("type", state.type);
  params.set("jlpt", state.jlpt);
  params.set("review", state.review);
  params.set("recent", state.recentOnly ? "1" : "0");
  params.delete("locked");
  params.delete("burned");
  params.set("sticky", state.stickyMerge ? "1" : "0");

  return params.toString();
}

export function readStoredTypeVisibility(
  storage: Storage,
  key: string,
  fallback: TypeVisibility,
): TypeVisibility {
  const raw = storage.getItem(key);
  if (!raw) {
    return fallback;
  }

  const parsed = JSON.parse(raw) as Partial<TypeVisibility>;
  return {
    radical: parsed.radical ?? fallback.radical,
    kanji: parsed.kanji ?? fallback.kanji,
    vocabulary: parsed.vocabulary ?? fallback.vocabulary,
  };
}

export function persistTypeVisibility(storage: Storage, key: string, value: TypeVisibility) {
  storage.setItem(key, JSON.stringify(value));
}

export function readStoredPositiveInteger(storage: Storage, key: string): number | null {
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function persistOptionalPositiveInteger(storage: Storage, key: string, value: number | null) {
  if (value === null) {
    storage.removeItem(key);
    return;
  }

  storage.setItem(key, String(value));
}

export function readStoredFlag(storage: Storage, key: string): boolean {
  return storage.getItem(key) === "1";
}

export function persistFlag(storage: Storage, key: string, value: boolean) {
  storage.setItem(key, value ? "1" : "0");
}

export function readStoredEnum<T extends string>(storage: Storage, key: string, allowed: readonly T[]): T | null {
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }

  return allowed.includes(raw as T) ? (raw as T) : null;
}

export function persistEnum<T extends string>(storage: Storage, key: string, value: T) {
  storage.setItem(key, value);
}
