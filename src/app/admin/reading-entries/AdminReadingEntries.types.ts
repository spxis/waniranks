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
  signoffDatePst: string;
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
  reviewWorkDone: number;
  reviewCorrect: number;
  reviewIncorrect: number;
  reviewSuccessPercent: number | null;
  createdAt: string;
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
  signoffDatePst: string;
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
};
