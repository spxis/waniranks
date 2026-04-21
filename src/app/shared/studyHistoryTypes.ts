export type HistorySrsBucket =
  | "locked"
  | "apprentice"
  | "guru"
  | "master"
  | "enlightened"
  | "burned"
  | "unknown";

export type HistorySubjectData = {
  subjectId?: number;
  subjectType?: "kanji" | "radical" | "vocabulary";
  status?: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
  characters?: string;
  meanings?: string[];
  readings?: string[];
  primaryReadings?: string[];
  radicals?: Array<{ subjectId: number; label: string; wkLevel?: number | null; reading?: string | null }>;
  visuallySimilar?: Array<{ subjectId: number; label: string; wkLevel?: number | null; reading?: string | null }>;
  usedInVocabulary?: Array<{ subjectId: number; label: string; wkLevel?: number | null; reading?: string | null }>;
  componentKanji?: Array<{ subjectId: number; label: string; wkLevel?: number | null; reading?: string | null }>;
  meaningExplanation?: string;
  readingExplanation?: string;
  jlptLevel?: number | null;
  jlptMeta?: {
    primaryMeaning: string | null;
    meanings: string[];
    onReadings: string[];
    kunReadings: string[];
    nanoriReadings: string[];
    wordExamples: unknown;
    strokeCount: number | null;
    frequencyRank: number | null;
    schoolGrade: number | null;
    heisigKeyword: string | null;
  } | null;
  startedAt?: string | null;
  passedAt?: string | null;
  availableAt?: string | null;
  wkLevel?: number;
  srsStage?: number;
};

export type StudyHistoryAttempt = {
  id: string;
  accountId: string;
  nickname: string;
  wkUsername: string;
  assignmentId: number;
  subjectId: number;
  subjectType: string;
  result: string;
  submittedAt: string;
  subjectLabel: string;
  subjectReading: string | null;
  subjectMeaning: string | null;
  wkLevel: number | null;
  srsStage: number | null;
  srsBucket: HistorySrsBucket;
  subjectData: HistorySubjectData | null;
};

export type StudyHistoryPayload = {
  attempts: StudyHistoryAttempt[];
  totals: Record<string, number>;
  accountCount: number;
  availableLevels: number[];
  availableSrs: number[];
  availableSrsBuckets: HistorySrsBucket[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  error?: string;
};
