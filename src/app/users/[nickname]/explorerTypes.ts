import type { WkStatus, SubjectType } from "@/lib/domainConstants";
import type { JlptKanjiRow, JlptMeta } from "@/lib/jlptTypes";

export type RelatedReference = {
  subjectId: number;
  label: string;
  wkLevel?: number | null;
  reading?: string | null;
  meaning?: string | null;
};

export type LevelItem = {
  subjectId: number;
  subjectType?: SubjectType;
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
  status: WkStatus;
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

export type JlptItem = JlptKanjiRow;

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
  status?: WkStatus;
  srsStage?: number;
  wkLevel?: number | null;
};

export type SrsFilter =
  | "all"
  | WkStatus;
