import type {
  StudySrsFilter,
  StudySrsStageFilter,
} from "../lib/studyExplorerTypes";
import { SUBJECT_TYPE_DISPLAY, SUBJECT_TYPES } from "@/lib/domainConstants";
import { STUDY_SRS_FILTERS } from "../lib/studyExplorerDomain";
export {
  isAllStudySrsFilter,
  isAllStudyTypeFilter,
  isKanjiSubjectType,
  isLessonLockedQueueItem,
  isLessonQueueMode,
  isLessonQueueItem,
  isRadicalSubjectType,
  isReviewQueueMode,
  isReviewQueueItem,
  isStudySrsFilterValue,
  isStudyTypeFilterValue,
  isStudyViewerMode,
  STUDY_TYPE_FILTERS,
  isTerminalReviewOutcome,
  isVocabularySubjectType,
  STUDY_QUEUE_TYPES,
  STUDY_REVIEW_OUTCOMES,
  STUDY_REVIEW_TERMINAL_OUTCOMES,
  STUDY_WK_STATUSES,
  STUDY_SUBJECT_TYPES,
  STUDY_VIEWER_MODES,
  usedInVocabularyTargetSubjectType,
} from "../lib/studyExplorerDomain";
export { STUDY_SRS_FILTERS };
export type { StudyTerminalReviewOutcome } from "../lib/studyExplorerDomain";

export const STUDY_EXPLORER_REVIEW_API_PAGE_SIZE = 120;
export const STUDY_EXPLORER_LESSON_API_PAGE_SIZE = 200;

export const STUDY_EXPLORER_EMPTY_TYPE_COUNTS_BY_LEVEL: Record<
  number,
  { all: number; radical: number; kanji: number; vocabulary: number }
> = {};

export const STUDY_PANEL_TEXT = {
  heading: "Study",
  subtitle: "Reviews due now and pending lessons across all levels",
  searchScope: "study",
  allLevelsLabel: "All Levels",
  allGroupsLabel: "All Groups",
  allStatusesLabel: "All Statuses",
  allSrsPluralLabel: "All SRSs",
  hintsHidden: "Hints Hidden",
  showEnglish: "Show English",
  hideEnglish: "Hide English",
  showLocked: "Show Locked",
  hideLocked: "Hide Locked",
  recentOnly: "Recent Only",
  bulkOperations: "Bulk Operations",
  bulkOpsActive: "Bulk Ops Active",
  loadingMore: "Loading more...",
  loadingRemainingLessons: "Loading remaining lessons...",
  scrollToLoadMore: "Scroll to load more...",
  loadingSelectedLevel: "Loading selected level...",
  loadingQueue: "Loading study queue...",
  genericLoadErrorPrefix: "Load error:",
  clearFilters: "Clear filters",
  noMatches: "No study items match the current filters.",
  queueRefreshError: "Couldn't refresh your study queue. Check your connection and try again.",
} as const;

export function studyPanelAllGroupsLabel(viewedLevel: number | null): string {
  return viewedLevel === null ? STUDY_PANEL_TEXT.allGroupsLabel : `All L${viewedLevel} Groups`;
}

export function studyPanelAllStatusesLabel(viewedLevel: number | null): string {
  return viewedLevel === null ? STUDY_PANEL_TEXT.allStatusesLabel : `All L${viewedLevel} Statuses`;
}

export function studyPanelAllSrsPluralLabel(viewedLevel: number | null): string {
  return viewedLevel === null ? STUDY_PANEL_TEXT.allSrsPluralLabel : `All L${viewedLevel} SRSs`;
}

export const STUDY_PANEL_SRS_STATUSES = [
  STUDY_SRS_FILTERS.all,
  STUDY_SRS_FILTERS.apprentice,
  STUDY_SRS_FILTERS.guru,
  STUDY_SRS_FILTERS.master,
  STUDY_SRS_FILTERS.enlightened,
  STUDY_SRS_FILTERS.burned,
  STUDY_SRS_FILTERS.locked,
] as const;

export function getSrsStageOptions(filter: StudySrsFilter): ReadonlyArray<StudySrsStageFilter> {
  if (filter === STUDY_SRS_FILTERS.apprentice) return [1, 2, 3, 4] as const;
  if (filter === STUDY_SRS_FILTERS.guru) return [5, 6] as const;
  if (filter === STUDY_SRS_FILTERS.master) return [7] as const;
  if (filter === STUDY_SRS_FILTERS.enlightened) return [8] as const;
  if (filter === STUDY_SRS_FILTERS.burned) return [9] as const;
  if (filter === STUDY_SRS_FILTERS.locked) return [] as const;
  return [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
}

export const STUDY_REVIEW_MODAL_STORAGE_KEYS = {
  usedInWordsCollapsed: "wr:study-modal:used-in-words-collapsed",
  usedKanjiCollapsed: "wr:study-modal:used-kanji-collapsed",
  viewerMode: "wr:study-modal:viewer-mode",
} as const;

export const STUDY_REVIEW_MODAL_VIEWER_MODES = ["detail", "flash"] as const;

export const STUDY_REVIEW_MODAL_TOUCH = {
  minSwipeDistancePx: 56,
  axisDominanceRatio: 1.25,
  maxSwipeDurationMs: 750,
} as const;

export const STUDY_REVIEW_MODAL_TRANSITION_CUE_DURATION_MS = 900;

export const STUDY_REVIEW_HELPERS_TEXT = {
  empty: "-",
} as const;

export const STUDY_REVIEW_HELPERS_REGEX = {
  relatedSplit: /[、,]/,
  readingSplit: /[.・]/,
} as const;

export const STUDY_REVIEW_HELPERS_TILE_LABEL_THRESHOLDS = {
  large: 2,
  medium: 4,
} as const;

export const STUDY_REVIEW_META_TEXT = {
  primaryReadings: "Primary readings",
  secondaryReadings: "Secondary readings",
  started: "Started",
  nextReview: "Next review",
  passed: "Passed",
  radicals: SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.radical].plural,
  visuallySimilar: "Visually similar",
  usedInKanji: "Used in kanji",
  usedInVocabulary: "Used in vocabulary",
  componentKanji: "Component kanji",
  usedKanji: "Used kanji",
  usedInWords: "Used in words",
  jlptMeanings: "JLPT meanings",
  strokeFreq: "Stroke/Freq",
  gradeHeisig: "Grade/Heisig",
  expand: "Expand",
  collapse: "Collapse",
  wrong: "Wrong",
  correct: "Correct",
  skipped: "Skipped",
  addToReviews: "Add To My Reviews",
  addedToReviews: "Added To Reviews",
  alreadySubmittedHint: "Already submitted in this session",
} as const;

export const STUDY_REVIEW_MODAL_SECTION_TEXT = {
  cardsDone: "Cards Are Done",
  restartPrompt: "Click Or Press Next Again To Restart",
  tapToReveal: "Tap / Click To Reveal",
  enterOrSpace: "Enter Or Space",
  reading: "Reading",
  meaning: "Meaning",
  showAnswer: "Show Answer",
  spaceToReveal: "Space To Reveal",
  answerLocked: "Answer locked",
  readOnlyHint: "Review submitted. This item is now read-only.",
  wrong: "Wrong",
  correct: "Correct",
  skipped: "Skipped",
  font: "Font",
  viewItemTitle: "View Item",
  altMeanings: "Alt meanings",
} as const;

export const STUDY_REVIEW_MODAL_SECTION_LAYOUT = {
  flashMinHeight: "68vh",
  flashCardMinHeight: "20rem",
} as const;