export const LEADERBOARD_JLPT_LABEL_ROWS = [
  ["N5", "N4", "N3"],
  ["N2", "N1"],
] as const;

export const LEADERBOARD_24H_OVERALL_LABELS = [
  "Score",
  "Reviews",
  "Level",
  "Radicals",
  "Vocab",
  "Burned",
  "Learned Kanji",
] as const;

export const LEADERBOARD_24H_FOCUS_LABEL_BY_TAB = {
  radicals: "Radicals",
  kanji: "Learned Kanji",
  vocabulary: "Vocab",
} as const;
