export const ITEM_SPREAD_STAGE_LABELS = [
  { key: "apprentice", label: "Apprentice" },
  { key: "guru", label: "Guru" },
  { key: "master", label: "Master" },
  { key: "enlightened", label: "Enlightened" },
  { key: "burned", label: "Burned" },
] as const;

export const LEVEL_PROGRESS_CARDS = [
  { key: "radical", label: "Radicals", barClassName: "bg-radical" },
  { key: "kanji", label: "Kanji", barClassName: "bg-kanji" },
  { key: "vocabulary", label: "Vocabulary", barClassName: "bg-vocabulary" },
] as const;
