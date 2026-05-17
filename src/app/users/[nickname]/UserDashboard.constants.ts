export const LEVEL_PROGRESS_CARDS = [
  { key: "radical", label: "Radicals", barClassName: "bg-radical" },
  { key: "kanji", label: "Kanji", barClassName: "bg-kanji" },
  { key: "vocabulary", label: "Vocabulary", barClassName: "bg-vocabulary" },
] as const;

export const DASHBOARD_SUBJECT_TYPES = ["radical", "kanji", "vocabulary"] as const;
