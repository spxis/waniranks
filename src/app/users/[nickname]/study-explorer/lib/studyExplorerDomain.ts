import type {
  ReviewOutcome,
  StudyQueueItem,
  StudyQueueMode,
  StudySrsFilter,
  StudyTypeFilter,
  StudyViewerMode,
} from "./studyExplorerTypes";
import { SUBJECT_STATUSES, SUBJECT_TYPES } from "@/lib/domainConstants";

export const STUDY_QUEUE_TYPES = {
  review: "review",
  lesson: "lesson",
} as const;

export const STUDY_VIEWER_MODES = {
  detail: "detail",
  flash: "flash",
} as const;

export const STUDY_SUBJECT_TYPES = {
  radical: SUBJECT_TYPES.radical,
  kanji: SUBJECT_TYPES.kanji,
  vocabulary: SUBJECT_TYPES.vocabulary,
} as const;

export const STUDY_TYPE_FILTERS = {
  all: "all",
  radical: STUDY_SUBJECT_TYPES.radical,
  kanji: STUDY_SUBJECT_TYPES.kanji,
  vocabulary: STUDY_SUBJECT_TYPES.vocabulary,
} as const;

export const STUDY_SUBJECT_STATUSES = {
  locked: SUBJECT_STATUSES.locked,
  apprentice: SUBJECT_STATUSES.apprentice,
  guru: SUBJECT_STATUSES.guru,
  master: SUBJECT_STATUSES.master,
  enlightened: SUBJECT_STATUSES.enlightened,
  burned: SUBJECT_STATUSES.burned,
} as const;

export const STUDY_SRS_FILTERS = {
  all: "all",
  locked: STUDY_SUBJECT_STATUSES.locked,
  apprentice: STUDY_SUBJECT_STATUSES.apprentice,
  guru: STUDY_SUBJECT_STATUSES.guru,
  master: STUDY_SUBJECT_STATUSES.master,
  enlightened: STUDY_SUBJECT_STATUSES.enlightened,
  burned: STUDY_SUBJECT_STATUSES.burned,
} as const;

export const STUDY_REVIEW_OUTCOMES = {
  correct: "correct",
  wrong: "wrong",
  skipped: "skipped",
} as const;

export type StudyTerminalReviewOutcome =
  (typeof STUDY_REVIEW_OUTCOMES)[keyof typeof STUDY_REVIEW_OUTCOMES];

export const STUDY_REVIEW_TERMINAL_OUTCOMES: ReadonlySet<ReviewOutcome> = new Set([
  STUDY_REVIEW_OUTCOMES.correct,
  STUDY_REVIEW_OUTCOMES.wrong,
  STUDY_REVIEW_OUTCOMES.skipped,
]);

export function isTerminalReviewOutcome(
  outcome: ReviewOutcome | undefined,
): outcome is StudyTerminalReviewOutcome {
  return (
    outcome === STUDY_REVIEW_OUTCOMES.correct ||
    outcome === STUDY_REVIEW_OUTCOMES.wrong ||
    outcome === STUDY_REVIEW_OUTCOMES.skipped
  );
}

export function isLessonQueueItem(item: Pick<StudyQueueItem, "queueType">): boolean {
  return item.queueType === STUDY_QUEUE_TYPES.lesson;
}

export function isReviewQueueItem(item: Pick<StudyQueueItem, "queueType">): boolean {
  return item.queueType === STUDY_QUEUE_TYPES.review;
}

export function isLessonLockedQueueItem(
  item: Pick<StudyQueueItem, "queueType" | "status">,
): boolean {
  return isLessonQueueItem(item) && item.status === STUDY_SUBJECT_STATUSES.locked;
}

export function isRadicalSubjectType(
  subjectType: StudyQueueItem["subjectType"],
): boolean {
  return subjectType === STUDY_SUBJECT_TYPES.radical;
}

export function isKanjiSubjectType(
  subjectType: StudyQueueItem["subjectType"],
): boolean {
  return subjectType === STUDY_SUBJECT_TYPES.kanji;
}

export function isVocabularySubjectType(
  subjectType: StudyQueueItem["subjectType"],
): boolean {
  return subjectType === STUDY_SUBJECT_TYPES.vocabulary;
}

export function isAllStudyTypeFilter(typeFilter: StudyTypeFilter): boolean {
  return typeFilter === STUDY_TYPE_FILTERS.all;
}

export function isAllStudySrsFilter(srsFilter: StudySrsFilter): boolean {
  return srsFilter === STUDY_SRS_FILTERS.all;
}

export function isStudyViewerMode(value: string | null): value is StudyViewerMode {
  return value === STUDY_VIEWER_MODES.detail || value === STUDY_VIEWER_MODES.flash;
}

export function isStudyTypeFilterValue(value: string | null): value is StudyTypeFilter {
  return (
    value === STUDY_TYPE_FILTERS.all ||
    value === STUDY_TYPE_FILTERS.radical ||
    value === STUDY_TYPE_FILTERS.kanji ||
    value === STUDY_TYPE_FILTERS.vocabulary
  );
}

export function isStudySrsFilterValue(value: string | null): value is StudySrsFilter {
  return (
    value === STUDY_SRS_FILTERS.all ||
    value === STUDY_SRS_FILTERS.apprentice ||
    value === STUDY_SRS_FILTERS.guru ||
    value === STUDY_SRS_FILTERS.master ||
    value === STUDY_SRS_FILTERS.enlightened ||
    value === STUDY_SRS_FILTERS.locked ||
    value === STUDY_SRS_FILTERS.burned
  );
}

export function isLessonQueueMode(queueMode: StudyQueueMode): boolean {
  return queueMode === STUDY_QUEUE_TYPES.lesson;
}

export function isReviewQueueMode(queueMode: StudyQueueMode): boolean {
  return queueMode === STUDY_QUEUE_TYPES.review;
}

export function usedInVocabularyTargetSubjectType(
  subjectType: StudyQueueItem["subjectType"],
): "kanji" | "vocabulary" {
  return isRadicalSubjectType(subjectType)
    ? STUDY_SUBJECT_TYPES.kanji
    : STUDY_SUBJECT_TYPES.vocabulary;
}
