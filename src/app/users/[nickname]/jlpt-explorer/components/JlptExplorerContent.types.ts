import type { JlptItem, UserKanjiItem } from "../../explorerTypes";

export type JlptReadingsRecord = Record<string, { nLevel: number; readings: string[]; meanings?: string[] }>;

export type JlptFilter = "all" | "kanji" | "none";

export type TrendRow = {
  capturedAt: string;
  percentageCorrect: number;
  totalAnswers: number;
  correctAnswers: number;
  wrongAnswers: number;
  source: string;
};

export type KanjiStats = {
  latest?: {
    percentageCorrect?: number;
    meaningCorrect?: number;
    meaningIncorrect?: number;
    readingCorrect?: number;
    readingIncorrect?: number;
    capturedAt?: string;
    source?: string;
  };
  trend?: TrendRow[];
};

export type JlptExplorerContentProps = {
  items: JlptItem[];
  showEnglish: boolean;
  canToggleEnglish?: boolean;
  onToggleShowEnglish?: () => void;
  studyMode: boolean;
  counts: {
    all: number;
    kanji: number;
    none: number;
    n1: number;
    n2: number;
    n3: number;
    n4: number;
    n5: number;
  };
  selectedLevels: Set<number>;
  stickyLevels: boolean;
  wkFilter: JlptFilter;
  wkLevelFilter: number | "none" | null;
  availableWkLevels: number[];
  gradeFilter: number | "none" | null;
  availableGrades: number[];
  filteredItems: JlptItem[];
  selectedKanji: string | null;
  selectedItem: JlptItem | null;
  gridColumns: number;
  userKanjiByChar: Map<string, UserKanjiItem>;
  isLoadingData: boolean;
  isLoadingMore: boolean;
  hasMoreRemote: boolean;
  onLoadMoreRemote: () => Promise<void>;
  onSetSelectedLevels: (next: Set<number>) => void;
  onToggleNLevel: (level: number) => void;
  onSetWkFilter: (next: JlptFilter) => void;
  onSetWkLevelFilter: (next: number | "none" | null) => void;
  onSetGradeFilter: (next: number | "none" | null) => void;
  onSetStickyLevels: (next: boolean) => void;
  onSetSelectedKanji: (next: string | null | ((prev: string | null) => string | null)) => void;
};
