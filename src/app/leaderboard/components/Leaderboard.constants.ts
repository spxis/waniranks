export const LEADERBOARD_SRS_STAGE_LABELS = [
  { key: "apprentice", label: "Apprentice" },
  { key: "guru", label: "Guru" },
  { key: "master", label: "Master" },
  { key: "enlightened", label: "Enlightened" },
  { key: "burned", label: "Burned" },
] as const;

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
