import type { LevelItem } from "../../explorerTypes";
import { WK_STATUSES, SUBJECT_TYPES } from "@/lib/domainConstants";

export const LEVEL_SUBJECT_TYPES = {
  radical: SUBJECT_TYPES.radical,
  kanji: SUBJECT_TYPES.kanji,
  vocabulary: SUBJECT_TYPES.vocabulary,
} as const;

export const LEVEL_WK_STATUSES = {
  locked: WK_STATUSES.locked,
  apprentice: WK_STATUSES.apprentice,
  guru: WK_STATUSES.guru,
  master: WK_STATUSES.master,
  enlightened: WK_STATUSES.enlightened,
  burned: WK_STATUSES.burned,
} as const;

export function isRadicalSubjectType(
  type: LevelItem["subjectType"],
): type is typeof LEVEL_SUBJECT_TYPES.radical {
  return type === LEVEL_SUBJECT_TYPES.radical;
}

export function isKanjiSubjectType(
  type: LevelItem["subjectType"],
): type is typeof LEVEL_SUBJECT_TYPES.kanji {
  return type === LEVEL_SUBJECT_TYPES.kanji;
}

export function isVocabularySubjectType(
  type: LevelItem["subjectType"],
): type is typeof LEVEL_SUBJECT_TYPES.vocabulary {
  return type === LEVEL_SUBJECT_TYPES.vocabulary;
}

export function isLockedStatus(status: LevelItem["status"]): boolean {
  return status === LEVEL_WK_STATUSES.locked;
}

export function isBurnedStatus(status: LevelItem["status"]): boolean {
  return status === LEVEL_WK_STATUSES.burned;
}
