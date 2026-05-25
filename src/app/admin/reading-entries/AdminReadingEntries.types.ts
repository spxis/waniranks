export type AdminReadingEntryMember = {
  id: string;
  nickname: string;
  wkUsername: string;
};

export type AdminReadingEntry = {
  id: string;
  accountId: string;
  nickname: string;
  wkUsername: string;
  source: "daily" | "entry";
  signoffDatePst: string;
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
  reviewsLeft: number;
  reviewWorkDone: number;
  reviewCorrect: number;
  reviewIncorrect: number;
  reviewSuccessPercent: number | null;
  createdAt: string;
  updatedAt: string | null;
};

export type ReadingEntriesResponse = {
  members: AdminReadingEntryMember[];
  entries: AdminReadingEntry[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
  error?: string;
};

export type EntryEditDraft = {
  source: "daily" | "entry";
  signoffDatePst: string;
  submittedAtLocal: string;
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
  reviewsLeft: number;
};
