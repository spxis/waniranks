export const LEVEL_PROGRESS_CARDS = [
  { key: "radical", label: "Radicals", barClassName: "bg-radical" },
  { key: "kanji", label: "Kanji", barClassName: "bg-kanji" },
  { key: "vocabulary", label: "Vocabulary", barClassName: "bg-vocabulary" },
] as const;

export const DASHBOARD_SRS_LINKS = [
  { key: "apprentice", label: "Apprentice", shortLabel: "Appr" },
  { key: "guru", label: "Guru", shortLabel: "Guru" },
  { key: "master", label: "Master", shortLabel: "Mstr" },
  { key: "enlightened", label: "Enlightened", shortLabel: "Enl" },
  { key: "burned", label: "Burned", shortLabel: "Burn" },
] as const;

export const DASHBOARD_SUBJECT_TYPES = ["radical", "kanji", "vocabulary"] as const;
