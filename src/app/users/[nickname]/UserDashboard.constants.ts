import { SUBJECT_TYPES } from "@/lib/domainConstants";

export const LEVEL_PROGRESS_CARDS = [
  { key: SUBJECT_TYPES.radical, label: "Radicals", barClassName: "bg-radical" },
  { key: SUBJECT_TYPES.kanji, label: "Kanji", barClassName: "bg-kanji" },
  { key: SUBJECT_TYPES.vocabulary, label: "Vocabulary", barClassName: "bg-vocabulary" },
] as const;

export const DASHBOARD_SUBJECT_TYPES = [
  SUBJECT_TYPES.radical,
  SUBJECT_TYPES.kanji,
  SUBJECT_TYPES.vocabulary,
] as const;
