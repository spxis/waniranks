export type KanjiEntry = {
  char: string;
  jlptLevel: number | null;
  wkLevel: number | null;
  schoolGrade: number | null;
  schoolGradePending: boolean;
  occurrenceCount: number;
};

export type GroupMode = "all" | "jlpt" | "wk" | "grade";
export type EntrySortMode = "article" | "count" | "jp";
export type AllCountFilter = "all" | "2+" | "5+" | "10+" | "25+" | "50+";
export type AllCoverageFilter = "all" | "wk-known" | "wk-unknown" | "no-level-data";

export type JlptRecord = Record<string, { nLevel?: number }>;
