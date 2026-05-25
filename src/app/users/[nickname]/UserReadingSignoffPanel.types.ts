import type {
  ReadingChallengeBookRecord,
  ReadingReviewQueueSnapshot,
  ReadingSignoffEntryRecord,
  ReadingSignoffRecord,
} from "@/lib/readingSignoff";

export type Member = {
  id: string;
  nickname: string;
  wkUsername: string;
  wkLevel: number;
  learnedKanji: number;
  learnedRadicals: number;
  learnedVocabulary: number;
};

export type LatestSignoff = {
  accountId: string;
  bookTitle: string;
  pagesRead: number;
  signoffDatePst: string;
};

export type ReadingSignoffResponse = {
  members: Member[];
  viewerCanChooseMember: boolean;
  trackedMemberAccountIds: string[];
  challengeBooks: ReadingChallengeBookRecord[];
  signoffs: ReadingSignoffRecord[];
  signoffEntries: ReadingSignoffEntryRecord[];
  reviewQueues: ReadingReviewQueueSnapshot[];
  latestSignoffs: LatestSignoff[];
};

export type UserReadingSignoffPanelProps = {
  accountId: string;
};

export type FormState = {
  signoffDatePst: string;
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
};

export function createFormState(dateKey: string, entry: ReadingSignoffRecord | null): FormState {
  void entry;
  return {
    signoffDatePst: dateKey,
    bookTitle: "",
    pagesRead: 10,
    minutesRead: 20,
    didWanikaniReviews: false,
  };
}
