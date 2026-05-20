import type { LevelItem, SrsFilter } from "../../explorerTypes";
import type { JlptFilter, ReviewTimingFilter, TypeVisibility } from "../lib/levelExplorerState";
import type { SubjectType } from "@/lib/domainConstants";
import type {
  LevelItemCounts,
  LevelJlptCounts,
  ReviewTimingCounts,
} from "../lib/levelExplorerSelectors";
import type { VocabularyKanjiLink } from "../lib/levelExplorerItemDetails";

export type LevelExplorerContentProps = {
  accountId: string;
  levelOptions: number[];
  levelItemCountsByLevel: Record<number, number>;
  selectedLevels: Set<number>;
  searchAvailableLevels: Set<number> | null;
  stickyMerge: boolean;
  visibleTypes: TypeVisibility;
  counts: LevelItemCounts;
  jlptCounts: LevelJlptCounts;
  reviewTimingCounts: ReviewTimingCounts;
  accountPendingReviews: number;
  overdueOutsideSelectedLevels: number;
  selectedLevelList: number[];
  filtersCollapsed: boolean;
  srsFilter: SrsFilter;
  jlptFilter: JlptFilter;
  reviewTimingFilter: ReviewTimingFilter;
  recentOnly: boolean;
  showLocked: boolean;
  showEnglish: boolean;
  canToggleEnglish: boolean;
  studyMode: boolean;
  loading: boolean;
  gridColumns: number;
  searchMatchedSubjectIds: Set<number> | null;
  error: string;
  filteredItems: LevelItem[];
  selectedItem: LevelItem | null;
  selectedMeaningExplanation: string;
  selectedReadingExplanationRaw: string;
  showReadingExplanation: boolean;
  hasPrimaryRelatedPanel: boolean;
  hasVisuallySimilarPanel: boolean;
  hasUsedInVocabularyPanel: boolean;
  vocabularyKanjiLinks: VocabularyKanjiLink[];
  subjectById: Map<number, LevelItem>;
  onSelectAllLevelsAndClearSearch: () => Promise<void>;
  onToggleLevel: (level: number) => Promise<void>;
  onSetStickyMerge: (next: boolean) => void;
  onEnableAllTypes: () => void;
  onToggleTypeVisibility: (type: SubjectType) => void;
  onSetFiltersCollapsed: (next: boolean) => void;
  onSetSrsFilter: (next: SrsFilter) => void;
  onSetJlptFilter: (next: JlptFilter) => void;
  onSetReviewTimingFilter: (next: ReviewTimingFilter) => void;
  onSetRecentOnly: (next: boolean) => void;
  onSetShowLocked: (next: boolean) => void;
  onToggleShowEnglish: () => void;
  onSetSelectedSubjectId: (next: number | null | ((prev: number | null) => number | null)) => void;
  onJumpToRelatedSubject: (subjectId: number, targetLevel?: number | null) => Promise<void>;
  onJumpToKanji: (subjectId: number, wkLevel: number | null) => Promise<void>;
  onMarkHistoryPush: () => void;
};
