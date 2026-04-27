import type { LevelItem, SrsFilter } from "../../explorerTypes";

export type StudyQueueItem = LevelItem & {
  assignmentId: number;
  queueType: "review" | "lesson";
};

export type QueueResponse = {
  items: StudyQueueItem[];
  counts: {
    all: number;
    reviews: number;
    lessons: number;
  };
  levelCounts?: Record<number, number>;
  typeCounts?: {
    all: number;
    radical: number;
    kanji: number;
    vocabulary: number;
  };
  typeCountsByLevel?: Record<
    number,
    {
      all: number;
      radical: number;
      kanji: number;
      vocabulary: number;
    }
  >;
  pagination?: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
};

export type StudyCounts = QueueResponse["counts"];

export type StoredQueuePayload = {
  cachedAtMs: number;
  data: QueueResponse;
};

export type SubmitFeedback = {
  kind: "success" | "error";
  message: string;
};

export type ReviewSrsGrouping = "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";

export type ReviewSrsTransition = {
  assignmentId: number;
  subjectId: number | null;
  previousSrsStage: number | null;
  newSrsStage: number | null;
  previousGrouping: ReviewSrsGrouping | null;
  newGrouping: ReviewSrsGrouping | null;
  transition: "promoted" | "demoted" | "unchanged" | "unknown";
};

export type SubmitInFlight = {
  assignmentId: number;
  result: "correct" | "wrong" | "start-lesson" | "reset-to-lessons";
  itemLabel: string;
};

export type ReviewOutcome = "correct" | "wrong" | "skipped" | "lesson-started" | "reset-to-lessons";

export type StudyExplorerProps = {
  accountId: string;
  maxLevel: number;
  showEnglish: boolean;
  onToggleShowEnglish: () => void;
  canToggleEnglish: boolean;
  studyMode: boolean;
  queueMode: "review" | "lesson";
  initialViewerMode?: "detail" | "flash" | null;
};

export type StudyTypeFilter = "all" | "radical" | "kanji" | "vocabulary";
export type StudySrsFilter = Extract<
  SrsFilter,
  "all" | "locked" | "apprentice" | "guru" | "master" | "enlightened"
>;
