import type { SrsFilter } from "../../explorerTypes";

export type TypeFilter = "all" | "kanji" | "radical" | "vocabulary";
export type JlptFilter = "all" | "n1" | "n2" | "n3" | "n4" | "n5";
export type ReviewTimingFilter = "all" | "overdue" | "next1h" | "next8h" | "next24h" | "next72h";

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

export const SRS_FILTER_ALLOWED: SrsFilter[] = [
  "all",
  "apprentice",
  "guru",
  "master",
  "enlightened",
  "burned",
  "locked",
];

export const TYPE_FILTER_ALLOWED: TypeFilter[] = ["all", "radical", "kanji", "vocabulary"];
export const JLPT_FILTER_ALLOWED: JlptFilter[] = ["all", "n5", "n4", "n3", "n2", "n1"];
export const REVIEW_TIMING_ALLOWED: ReviewTimingFilter[] = [
  "all",
  "overdue",
  "next1h",
  "next8h",
  "next24h",
  "next72h",
];

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
  const srs = SRS_FILTER_ALLOWED.includes(srsRaw as SrsFilter) ? (srsRaw as SrsFilter) : "all";

  const typeRaw = params.get("type");
  const type = TYPE_FILTER_ALLOWED.includes(typeRaw as TypeFilter) ? (typeRaw as TypeFilter) : "all";

  const jlptRaw = params.get("jlpt");
  const jlpt = JLPT_FILTER_ALLOWED.includes(jlptRaw as JlptFilter) ? (jlptRaw as JlptFilter) : "all";

  const reviewRaw = params.get("review");
  const review = REVIEW_TIMING_ALLOWED.includes(reviewRaw as ReviewTimingFilter)
    ? (reviewRaw as ReviewTimingFilter)
    : "all";

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
