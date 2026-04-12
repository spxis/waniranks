export type SubjectStatus =
  | "locked"
  | "apprentice"
  | "guru"
  | "master"
  | "enlightened"
  | "burned";

export type RelatedReference = {
  subjectId: number;
  label: string;
  wkLevel?: number | null;
  reading?: string | null;
  meaning?: string | null;
};

export type JlptMeta = {
  primaryMeaning?: string | null;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  strokeCount?: number | null;
  frequencyRank?: number | null;
  schoolGrade?: number | null;
  heisigKeyword?: string | null;
  wordExamples?: unknown;
};

export type LevelItem = {
  subjectId: number;
  subjectType?: "kanji" | "radical" | "vocabulary";
  wkLevel?: number;
  characters: string;
  meanings: string[];
  readings?: string[];
  primaryReadings?: string[];
  radicals?: RelatedReference[];
  visuallySimilar?: RelatedReference[];
  usedInVocabulary?: RelatedReference[];
  componentKanji?: RelatedReference[];
  meaningExplanation?: string;
  readingExplanation?: string;
  jlptLevel?: number | null;
  jlptMeta?: JlptMeta | null;
  srsStage: number;
  status: SubjectStatus;
  startedAt?: string | null;
  passedAt?: string | null;
  availableAt: string | null;
};

export type Snapshot = {
  level: number;
  kanjiTotal: number;
  kanjiLearned: number;
  kanjiGuruPlus: number;
  kanjiLocked: number;
  estimatedHoursRemaining: number | null;
  items: LevelItem[];
  syncedAt?: string;
};

export type JlptItem = {
  kanji: string;
  nLevel: number;
  strokeCount: number | null;
  frequencyRank: number | null;
  schoolGrade: number | null;
  heisigKeyword: string | null;
  unicodeHex: string | null;
  sourceJlpt: number | null;
  primaryMeaning: string | null;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  nanoriReadings: string[];
  notes: string[];
  wordExamples: unknown;
};

export type UserKanjiItem = {
  subjectId?: number;
  characters: string;
  meanings?: string[];
  primaryReadings?: string[];
  readings?: string[];
  meaningExplanation?: string;
  readingExplanation?: string;
  startedAt?: string | null;
  passedAt?: string | null;
  availableAt?: string | null;
  status?: SubjectStatus;
  srsStage?: number;
  wkLevel?: number | null;
};

export type SrsFilter =
  | "all"
  | "apprentice"
  | "guru"
  | "master"
  | "enlightened"
  | "burned"
  | "locked";
