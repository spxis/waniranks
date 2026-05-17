import { SUBJECT_TYPES } from "@/lib/domainConstants";

export type { SubjectType } from "@/lib/domainConstants";

export type GuruedItemSummary = {
  subjectId: number;
  label: string;
  reading: string | null;
  passedAt: string;
};

export type LeaderboardRow = {
  id: string;
  nickname: string;
  wkUsername: string;
  wkLevel: number;
  reviewCount: number;
  burnedCount: number;
  pendingReviews: number;
  radicalCount: number;
  vocabularyCount: number;
  apprenticeCount: number;
  guruCount: number;
  masterCount: number;
  enlightenedCount: number;
  levelKanjiTotal: number;
  levelKanjiLearned: number;
  levelKanjiGuruPlus: number;
  levelKanjiLocked: number;
  itemSpread: unknown;
  jlptCounts: unknown;
  lastActivityAt: string | null;
  lastRadicalGuruedAt: string | null;
  lastKanjiGuruedAt: string | null;
  lastVocabularyGuruedAt: string | null;
  lastRadicalGuruedItem: unknown;
  lastKanjiGuruedItem: unknown;
  lastVocabularyGuruedItem: unknown;
  score: number;
  lastSyncedAt: string;
  dailyDelta?: {
    score: number;
    reviewCount: number;
    wkLevel: number;
    radicalCount: number;
    vocabularyCount: number;
    burnedCount: number;
    levelKanjiLearned: number;
  } | null;
};

export const LEADERBOARD_TABS = {
  overall: "overall",
  radicals: "radicals",
  kanji: SUBJECT_TYPES.kanji,
  vocabulary: SUBJECT_TYPES.vocabulary,
} as const;

export type LeaderboardTab = (typeof LEADERBOARD_TABS)[keyof typeof LEADERBOARD_TABS];
export type SortDirection = "asc" | "desc";
export type SortKey =
  | "rank"
  | "nickname"
  | "wkLevel"
  | "reviewCount"
  | "score"
  | "lastActivityAt"
  | "radicalLearned"
  | "radicalTotal"
  | "radicalPercent"
  | "kanjiLearned"
  | "kanjiTotal"
  | "kanjiPercent"
  | "vocabularyLearned"
  | "vocabularyTotal"
  | "vocabularyPercent"
  | "subjectApprentice"
  | "subjectGuru"
  | "subjectMaster"
  | "subjectEnlightened"
  | "subjectBurned"
  | "subjectLastGuruedAt";

export type SortState = {
  key: SortKey;
  direction: SortDirection;
};

export const ALL_TABS: LeaderboardTab[] = [
  LEADERBOARD_TABS.overall,
  LEADERBOARD_TABS.radicals,
  LEADERBOARD_TABS.kanji,
  LEADERBOARD_TABS.vocabulary,
];
export const ALL_SORT_KEYS: SortKey[] = [
  "rank",
  "nickname",
  "wkLevel",
  "reviewCount",
  "score",
  "lastActivityAt",
  "radicalLearned",
  "radicalTotal",
  "radicalPercent",
  "kanjiLearned",
  "kanjiTotal",
  "kanjiPercent",
  "vocabularyLearned",
  "vocabularyTotal",
  "vocabularyPercent",
  "subjectApprentice",
  "subjectGuru",
  "subjectMaster",
  "subjectEnlightened",
  "subjectBurned",
  "subjectLastGuruedAt",
];

export const TAB_CONFIG: Record<LeaderboardTab, { label: string; defaultSort: SortState }> = {
  [LEADERBOARD_TABS.overall]: { label: "Overall", defaultSort: { key: "score", direction: "desc" } },
  [LEADERBOARD_TABS.radicals]: { label: "Radicals", defaultSort: { key: "radicalPercent", direction: "desc" } },
  [LEADERBOARD_TABS.kanji]: { label: "Kanji", defaultSort: { key: "kanjiPercent", direction: "desc" } },
  [LEADERBOARD_TABS.vocabulary]: { label: "Vocabulary", defaultSort: { key: "vocabularyPercent", direction: "desc" } },
};
