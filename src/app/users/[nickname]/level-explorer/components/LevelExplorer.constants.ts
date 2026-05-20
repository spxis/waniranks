import {
  LEVEL_JLPT_FILTERS,
  LEVEL_REVIEW_TIMING_FILTERS,
  type JlptFilter,
  type ReviewTimingFilter,
} from "../lib/levelExplorerState";

export const LEVEL_EXPLORER_JLPT_MIX_LEVELS = [
  LEVEL_JLPT_FILTERS.n5,
  LEVEL_JLPT_FILTERS.n4,
  LEVEL_JLPT_FILTERS.n3,
  LEVEL_JLPT_FILTERS.n2,
  LEVEL_JLPT_FILTERS.n1,
] as const;

export const LEVEL_EXPLORER_JLPT_FILTER_LABELS: Record<JlptFilter, string> = {
  [LEVEL_JLPT_FILTERS.all]: "JLPT All",
  [LEVEL_JLPT_FILTERS.none]: "No JLPT",
  [LEVEL_JLPT_FILTERS.n5]: "N5",
  [LEVEL_JLPT_FILTERS.n4]: "N4",
  [LEVEL_JLPT_FILTERS.n3]: "N3",
  [LEVEL_JLPT_FILTERS.n2]: "N2",
  [LEVEL_JLPT_FILTERS.n1]: "N1",
};

export const LEVEL_EXPLORER_REVIEW_TIMING_LABELS: Record<ReviewTimingFilter, string> = {
  [LEVEL_REVIEW_TIMING_FILTERS.all]: "Review All",
  [LEVEL_REVIEW_TIMING_FILTERS.overdue]: "Overdue",
  [LEVEL_REVIEW_TIMING_FILTERS.next1h]: "Starts <= 1h",
  [LEVEL_REVIEW_TIMING_FILTERS.next8h]: "Starts <= 8h",
  [LEVEL_REVIEW_TIMING_FILTERS.next24h]: "Starts <= 24h",
  [LEVEL_REVIEW_TIMING_FILTERS.next72h]: "Starts <= 72h",
};

export const LEVEL_EXPLORER_TEXT = {
  showEnglish: "Show English",
  hideEnglish: "Hide English",
  hintsHidden: "Hints Hidden",
  recentOnly: "Recent Only",
  showLocked: "Show Locked",
  hideLocked: "Hide Locked",
  bulkOperations: "Bulk Operations",
  bulkOpsActive: "Bulk Ops Active",
  peek: "Peek",
  hidePeek: "Hide Peek",
} as const;
