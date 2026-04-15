export type ItemSpreadRow = {
  radical: number;
  kanji: number;
  vocabulary: number;
  total: number;
};

export type ItemSpread = {
  apprentice: ItemSpreadRow;
  guru: ItemSpreadRow;
  master: ItemSpreadRow;
  enlightened: ItemSpreadRow;
  burned: ItemSpreadRow;
  totals: ItemSpreadRow;
};

export type TypeProgress = {
  guruOrHigher: number;
  total: number;
  percent: number;
  locked: number;
  apprentice: number;
  guru: number;
  master: number;
  enlightened: number;
  burned: number;
};

export type LevelProgressSnapshot = {
  radical: TypeProgress;
  kanji: TypeProgress;
  vocabulary: TypeProgress;
  remainingToLevelUp: number;
  passedLevelUpGate: boolean;
};

export type TabId = "main" | "item-spread" | "level-progress";

export type UserDashboardTabsProps = {
  accountId: string;
  nickname: string;
  wkUsername: string;
  previousUser: { nickname: string; wkUsername: string } | null;
  nextUser: { nickname: string; wkUsername: string } | null;
  linkedEmail: string | null;
  viewerMatchesAccount: boolean;
  lastSyncedAt: string;
  lastActivityAt: string | null;
  globalRank: number;
  totalPlayers: number;
  wkLevel: number;
  levelKanjiLearned: number;
  levelKanjiTotal: number;
  levelKanjiLocked: number;
  totalLearnedKanji: number;
  estimatedHoursRemaining: number | null;
  apprenticeCount: number;
  guruCount: number;
  masterCount: number;
  enlightenedCount: number;
  burnedCount: number;
  radicalCount: number;
  totalKanjiCount: number;
  vocabularyCount: number;
  itemSpread: ItemSpread;
  levelRadicalProgress: TypeProgress;
  levelKanjiProgress: TypeProgress;
  levelVocabularyProgress: TypeProgress;
  remainingToLevelUp: number;
  passedLevelUpGate: boolean;
  availableProgressLevels: number[];
  levelProgressByLevel: Record<number, LevelProgressSnapshot>;
};

export type LiveData = {
  lastSyncedAt: string;
  lastActivityAt: string | null;
};
