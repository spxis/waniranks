import { computeChallengeLeaderboard } from "@/lib/readingChallengeEngine";
import { ACTIVE_READING_CHALLENGE } from "@/lib/readingChallengeRules";

export const READING_BOOK_OPTIONS = [
  "Kumon Reading",
  "NHK Easy News",
  "Yotsuba",
  "Satori Reader",
  "Genki",
  "Tadoku Book",
  "Other",
] as const;

export const READING_CAMPAIGN = {
  startDatePst: ACTIVE_READING_CHALLENGE.startDatePst,
  goalDatePst: ACTIVE_READING_CHALLENGE.goalDatePst,
  tripDatePst: ACTIVE_READING_CHALLENGE.tripDatePst,
  maxYen: ACTIVE_READING_CHALLENGE.targetBaseYen,
  weeklyCaps: ACTIVE_READING_CHALLENGE.scoringRules.weeklyCaps,
  weeklyPerfectScore: ACTIVE_READING_CHALLENGE.scoringRules.weeklyPerfectScore,
  pagesBonusThreshold: ACTIVE_READING_CHALLENGE.scoringRules.bonuses.pages.threshold,
  pagesBonusYen: ACTIVE_READING_CHALLENGE.scoringRules.bonuses.pages.yen,
  minutesBonusThreshold: ACTIVE_READING_CHALLENGE.scoringRules.bonuses.minutes.threshold,
  minutesBonusYen: ACTIVE_READING_CHALLENGE.scoringRules.bonuses.minutes.yen,
  zeroReviewsBonusYen: ACTIVE_READING_CHALLENGE.scoringRules.bonuses.zeroReviews.yen,
};

export type ReadingBookOption = (typeof READING_BOOK_OPTIONS)[number];

export type ReadingSignoffSnapshot = {
  reviewsLeft: number;
  apprenticeCount: number;
  currentWkLevel: number;
};

export type ReadingSignoffRecord = {
  id: string;
  challengeId?: string | null;
  accountId: string;
  signoffDatePst: string;
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
  reviewsLeft: number;
  apprenticeCount: number;
  currentWkLevel: number;
  createdAt: string;
  updatedAt: string;
};

export type ReadingSignoffEntryRecord = {
  id: string;
  challengeId?: string | null;
  accountId: string;
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

export type ReadingReviewQueueSnapshot = {
  accountId: string;
  radical: number;
  kanji: number;
  vocabulary: number;
  total: number;
};

export type ReadingChallengeBookRecord = {
  id: string;
  challengeId?: string | null;
  accountId: string;
  isbn: string;
  title: string;
  thumbnailUrl: string | null;
  manualCoverUrl: string | null;
  infoUrl: string | null;
};

export type ReadingChallengeBookSeed = {
  isbn: string;
  title: string;
};

export const READING_CHALLENGE_BOOK_SEEDS_BY_NICKNAME: Record<string, ReadingChallengeBookSeed[]> = {
  kamiko: [
    { isbn: "4-8402-2466-8", title: "よつばと! 1" },
    { isbn: "4-09-140108-2", title: "ドラえもん 1" },
    { isbn: "4-09-141753-1", title: "大長編ドラえもん. vol.13 (のび太とブリキの迷宮)" },
  ],
  hanako: [
    { isbn: "4-09-149574-5", title: "ドラえもんカラー作品集. 第4巻" },
    { isbn: "4-09-140502-9", title: "ドラえもん 22" },
    { isbn: "4-09-140103-1", title: "ドラえもん 1" },
  ],
};

export type ReadingLeaderboardRow = {
  accountId: string;
  totalYen: number;
  currentStreak: number;
  perfectDays: number;
  weeklyYen: number[];
};

export type ReadingLeaderboardInputMember = {
  id: string;
};

export type ReadingTrackedMember = {
  accountId: string;
  tracked: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const ISBN10_PATTERN = /^\d{9}[\dX]$/i;
const ISBN13_PATTERN = /^\d{13}$/;

export function normalizeIsbn(input: string): string | null {
  // Accept both ASCII and full-width JP input forms (digits, separators, and X).
  const normalized = input.normalize("NFKC");
  const compact = normalized.replace(/[^\dXx]/g, "").toUpperCase();
  if (ISBN10_PATTERN.test(compact) || ISBN13_PATTERN.test(compact)) {
    return compact;
  }

  return null;
}

export function toOpenLibraryCoverUrl(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
}

export function toOpenLibraryBookUrl(isbn: string): string {
  return `https://openlibrary.org/isbn/${isbn}`;
}

export function isPstDateKey(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

export function isMonthKey(value: string): boolean {
  if (!MONTH_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}-01T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

export function toMonthKey(input: Date): string {
  const year = input.getUTCFullYear();
  const month = String(input.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getTodayDateInputValue(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKeyAsUtc(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

export function toDateKeyUtc(input: Date): string {
  const year = input.getUTCFullYear();
  const month = String(input.getUTCMonth() + 1).padStart(2, "0");
  const day = String(input.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatMonthLabel(monthKey: string): string {
  const parsed = new Date(`${monthKey}-01T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function shiftMonth(monthKey: string, offset: number): string {
  const parsed = new Date(`${monthKey}-01T12:00:00.000Z`);
  parsed.setUTCMonth(parsed.getUTCMonth() + offset);
  return toMonthKey(parsed);
}

export function buildCalendarCells(monthKey: string): Array<number | null> {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [];
  }

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<number | null> = [];

  for (let index = 0; index < startWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function dayKey(monthKey: string, day: number): string {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

export function initials(label: string): string {
  return label
    .split(/\s+/)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("")
    .slice(0, 2);
}

export function formatCampaignDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(parseDateKeyAsUtc(dateKey));
}

export function campaignDaysRemaining(todayDateKey: string): number {
  const today = parseDateKeyAsUtc(todayDateKey);
  const goal = parseDateKeyAsUtc(READING_CAMPAIGN.goalDatePst);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((goal.getTime() - today.getTime()) / msPerDay) + 1;
  return Math.max(0, diff);
}

export function isCampaignDate(dateKey: string): boolean {
  return dateKey >= READING_CAMPAIGN.startDatePst && dateKey <= READING_CAMPAIGN.goalDatePst;
}

export function currentReviewQueueFromAssignmentCache(
  assignmentCache: unknown,
  now: Date = new Date(),
): Omit<ReadingReviewQueueSnapshot, "accountId"> {
  const output = {
    radical: 0,
    kanji: 0,
    vocabulary: 0,
    total: 0,
  };

  if (!Array.isArray(assignmentCache)) {
    return output;
  }

  const nowMs = now.getTime();

  for (const row of assignmentCache) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const data = (row as { data?: unknown }).data;
    if (!data || typeof data !== "object") {
      continue;
    }

    const assignment = data as {
      subject_type?: unknown;
      srs_stage?: unknown;
      available_at?: unknown;
      unlocked_at?: unknown;
    };

    const srsStage = typeof assignment.srs_stage === "number" ? assignment.srs_stage : 0;
    if (srsStage <= 0) {
      continue;
    }

    if (typeof assignment.unlocked_at !== "string" || assignment.unlocked_at.length === 0) {
      continue;
    }

    if (typeof assignment.available_at !== "string") {
      continue;
    }

    const availableAtMs = new Date(assignment.available_at).getTime();
    if (Number.isNaN(availableAtMs) || availableAtMs > nowMs) {
      continue;
    }

    const subjectType = assignment.subject_type;
    if (subjectType === "kanji") {
      output.kanji += 1;
      output.total += 1;
      continue;
    }

    if (subjectType === "vocabulary" || subjectType === "kana_vocabulary") {
      output.vocabulary += 1;
      output.total += 1;
      continue;
    }

    if (subjectType === "radical") {
      output.radical += 1;
      output.total += 1;
    }
  }

  return output;
}

export function computeReadingLeaderboard(
  members: ReadingLeaderboardInputMember[],
  signoffs: ReadingSignoffRecord[],
  asOfDateKey: string = getTodayDateInputValue(),
): ReadingLeaderboardRow[] {
  const rows = computeChallengeLeaderboard({
    challenge: ACTIVE_READING_CHALLENGE,
    members,
    signoffs,
    asOfDateKey,
  });

  return rows.map((row) => ({
    accountId: row.accountId,
    totalYen: row.totalYen,
    currentStreak: row.currentStreak,
    perfectDays: row.perfectDays,
    weeklyYen: row.weeklyYen,
  }));
}
