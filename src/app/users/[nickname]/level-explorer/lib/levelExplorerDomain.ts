import type { LevelItem } from "../../explorerTypes";
import { SUBJECT_STATUSES, SUBJECT_TYPES } from "@/lib/domainConstants";

export const LEVEL_SUBJECT_TYPES = {
  radical: SUBJECT_TYPES.radical,
  kanji: SUBJECT_TYPES.kanji,
  vocabulary: SUBJECT_TYPES.vocabulary,
} as const;

export const LEVEL_SUBJECT_STATUSES = {
  locked: SUBJECT_STATUSES.locked,
  apprentice: SUBJECT_STATUSES.apprentice,
  guru: SUBJECT_STATUSES.guru,
  master: SUBJECT_STATUSES.master,
  enlightened: SUBJECT_STATUSES.enlightened,
  burned: SUBJECT_STATUSES.burned,
} as const;

export function isRadicalSubjectType(type: LevelItem["subjectType"]): boolean {
  return type === LEVEL_SUBJECT_TYPES.radical;
}

export function isKanjiSubjectType(type: LevelItem["subjectType"]): boolean {
  return type === LEVEL_SUBJECT_TYPES.kanji;
}

export function isVocabularySubjectType(type: LevelItem["subjectType"]): boolean {
  return type === LEVEL_SUBJECT_TYPES.vocabulary;
}

export function isLockedStatus(status: LevelItem["status"]): boolean {
  return status === LEVEL_SUBJECT_STATUSES.locked;
}

export function isBurnedStatus(status: LevelItem["status"]): boolean {
  return status === LEVEL_SUBJECT_STATUSES.burned;
}
