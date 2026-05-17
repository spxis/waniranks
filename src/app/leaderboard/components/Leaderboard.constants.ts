import { SUBJECT_TYPE_DISPLAY, SUBJECT_TYPES } from "@/lib/domainConstants";

export const LEADERBOARD_JLPT_LABEL_ROWS = [
  ["N5", "N4", "N3"],
  ["N2", "N1"],
] as const;

export const LEADERBOARD_24H_OVERALL_LABELS = [
  "Score",
  "Reviews",
  "Level",
  SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.radical].plural,
  SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.vocabulary].plural,
  "Burned",
  "Learned Kanji",
] as const;

export const LEADERBOARD_24H_FOCUS_LABEL_BY_TAB = {
  radicals: SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.radical].plural,
  kanji: "Learned Kanji",
  vocabulary: SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.vocabulary].plural,
} as const;
