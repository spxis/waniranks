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
  startDatePst: "2026-05-25",
  goalDatePst: "2026-07-20",
  tripDatePst: "2026-07-21",
  maxYen: 40_000,
  weeklyCaps: [3500, 4000, 4500, 4750, 5000, 5250, 6000, 7000] as const,
  weeklyPerfectScore: 9.1,
} as const;

export type ReadingBookOption = (typeof READING_BOOK_OPTIONS)[number];

export type ReadingSignoffSnapshot = {
  reviewsLeft: number;
  apprenticeCount: number;
  currentWkLevel: number;
};

export type ReadingSignoffRecord = {
  id: string;
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

export type ReadingChallengePlayerRecord = {
  accountId: string;
  challengeBooks: [string, string, string];
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

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

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

function computeDayScore(input: ReadingSignoffRecord | null): { perfect: boolean; score: number } {
  if (!input) {
    return { perfect: false, score: 0 };
  }

  const readingDone = input.pagesRead > 0 && input.minutesRead > 0;
  const waniDone = input.didWanikaniReviews;
  const completion = (Number(readingDone) + Number(waniDone)) / 2;
  return {
    perfect: readingDone && waniDone,
    score: completion,
  };
}

export function computeReadingLeaderboard(
  members: ReadingLeaderboardInputMember[],
  signoffs: ReadingSignoffRecord[],
): ReadingLeaderboardRow[] {
  const signoffByMemberByDate = new Map<string, Map<string, ReadingSignoffRecord>>();

  for (const row of signoffs) {
    const memberMap = signoffByMemberByDate.get(row.accountId) ?? new Map<string, ReadingSignoffRecord>();
    memberMap.set(row.signoffDatePst, row);
    signoffByMemberByDate.set(row.accountId, memberMap);
  }

  const startDate = parseDateKeyAsUtc(READING_CAMPAIGN.startDatePst);
  const endDate = parseDateKeyAsUtc(READING_CAMPAIGN.goalDatePst);

  return members.map((member) => {
    const byDate = signoffByMemberByDate.get(member.id) ?? new Map<string, ReadingSignoffRecord>();
    const weeklyScores = READING_CAMPAIGN.weeklyCaps.map(() => 0);
    let streak = 0;
    let perfectDays = 0;

    for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const dateKey = toDateKeyUtc(cursor);
      const record = byDate.get(dateKey) ?? null;
      const { perfect, score } = computeDayScore(record);

      if (perfect) {
        streak += 1;
        perfectDays += 1;
      } else {
        streak = 0;
      }

      const multiplier = perfect ? Math.min(1 + 0.1 * (streak - 1), 1.6) : 1;
      const weightedScore = score * multiplier;
      const weekIndex = Math.floor((cursor.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

      if (weekIndex >= 0 && weekIndex < weeklyScores.length) {
        weeklyScores[weekIndex] += weightedScore;
      }
    }

    const weeklyYen = weeklyScores.map((score, index) => {
      const cap = READING_CAMPAIGN.weeklyCaps[index] ?? 0;
      const payout = cap * (score / READING_CAMPAIGN.weeklyPerfectScore);
      return Math.max(0, Math.min(cap, Math.round(payout)));
    });

    return {
      accountId: member.id,
      totalYen: weeklyYen.reduce((sum, value) => sum + value, 0),
      currentStreak: streak,
      perfectDays,
      weeklyYen,
    };
  });
}
