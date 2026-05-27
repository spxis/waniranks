import {
  ACTIVE_READING_CHALLENGE,
  type ReadingChallengeDefinition,
} from "@/lib/readingChallengeRules";

export type ReadingSignoffLike = {
  accountId: string;
  signoffDatePst: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
  reviewsLeft: number;
};

export type ReadingChallengeLeaderboardInputMember = {
  id: string;
};

export type ReadingChallengeLeaderboardRow = {
  accountId: string;
  totalYen: number;
  baseYen: number;
  bonusYen: number;
  currentStreak: number;
  perfectDays: number;
  weeklyYen: number[];
  weeklyBaseYen: number[];
  weeklyBonusYen: number[];
  weeklyCatchupBonusYen: number[];
};

export type ReadingDailyEarningsForecast = {
  weekIndex: number;
  weekCapYen: number;
  streakInWeek: number;
  todayMaxNormalYen: number;
  todayMinimumNormalYen: number;
  nextDayMaxNormalYenIfPerfectToday: number;
  nextDayMaxNormalYenIfMissToday: number;
};

function parseDateKeyAsUtc(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function toDateKeyUtc(input: Date): string {
  const year = input.getUTCFullYear();
  const month = String(input.getUTCMonth() + 1).padStart(2, "0");
  const day = String(input.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayMultiplierFromStreak(challenge: ReadingChallengeDefinition, streakBeforeToday: number): number {
  const { incrementPerPerfectDay, maxMultiplier } = challenge.scoringRules.streak;
  return Math.min(1 + incrementPerPerfectDay * streakBeforeToday, maxMultiplier);
}

type DayOutcome = {
  dateKey: string;
  hasRecord: boolean;
  perfect: boolean;
  score: number;
  pagesBonusYen: number;
  minutesBonusYen: number;
  zeroReviewsBonusYen: number;
};

function computeDayOutcome(
  challenge: ReadingChallengeDefinition,
  record: ReadingSignoffLike | null,
  dateKey: string,
): DayOutcome {
  if (!record) {
    return {
      dateKey,
      hasRecord: false,
      perfect: false,
      score: 0,
      pagesBonusYen: 0,
      minutesBonusYen: 0,
      zeroReviewsBonusYen: 0,
    };
  }

  const { thresholds, bonuses, baseHalfCreditScore } = challenge.scoringRules;
  const minimalCheckinScore = challenge.scoringRules.minimalCheckinScore ?? 0;
  const readingDone = record.pagesRead >= thresholds.pages || record.minutesRead >= thresholds.minutes;
  const waniDone = record.didWanikaniReviews;
  const perfect = readingDone && waniDone;
  const score = perfect ? 1 : readingDone || waniDone ? baseHalfCreditScore : minimalCheckinScore;

  const pagesBonusYen = record.pagesRead >= bonuses.pages.threshold ? bonuses.pages.yen : 0;
  const minutesBonusYen = record.minutesRead >= bonuses.minutes.threshold ? bonuses.minutes.yen : 0;
  const zeroReviewsBonusYen = bonuses.zeroReviews.enabled && waniDone && record.reviewsLeft === 0
    ? bonuses.zeroReviews.yen
    : 0;

  return {
    dateKey,
    hasRecord: true,
    perfect,
    score,
    pagesBonusYen,
    minutesBonusYen,
    zeroReviewsBonusYen,
  };
}

function computeWeeklyCatchupBonus(
  challenge: ReadingChallengeDefinition,
  weekOutcomes: DayOutcome[],
): number {
  const rules = challenge.scoringRules.bonuses.catchupStrongFinish;
  if (!rules.enabled) {
    return 0;
  }

  if (weekOutcomes.length < rules.strongFinishPerfectDays) {
    return 0;
  }

  const finishDays = weekOutcomes.slice(-rules.strongFinishPerfectDays);
  const strongFinish = finishDays.every((day) => day.perfect);
  if (!strongFinish) {
    return 0;
  }

  if (!rules.requiresEarlierFailureInWeek) {
    return rules.strongFinishPerfectDays * rules.yenPerStrongFinishDay;
  }

  const hadEarlierFailure = weekOutcomes
    .slice(0, -rules.strongFinishPerfectDays)
    .some((day) => !day.perfect);

  return hadEarlierFailure ? rules.strongFinishPerfectDays * rules.yenPerStrongFinishDay : 0;
}

function challengeStartAndEnd(challenge: ReadingChallengeDefinition, asOfDateKey: string): {
  start: Date;
  end: Date;
} {
  const start = parseDateKeyAsUtc(challenge.startDatePst);
  const endDateKey = asOfDateKey <= challenge.goalDatePst ? asOfDateKey : challenge.goalDatePst;
  const end = parseDateKeyAsUtc(endDateKey);
  return { start, end };
}

export function computeChallengeLeaderboard(input: {
  challenge?: ReadingChallengeDefinition;
  members: ReadingChallengeLeaderboardInputMember[];
  signoffs: ReadingSignoffLike[];
  asOfDateKey: string;
}): ReadingChallengeLeaderboardRow[] {
  const challenge = input.challenge ?? ACTIVE_READING_CHALLENGE;
  const signoffByMemberByDate = new Map<string, Map<string, ReadingSignoffLike>>();

  for (const row of input.signoffs) {
    const memberMap = signoffByMemberByDate.get(row.accountId) ?? new Map<string, ReadingSignoffLike>();
    memberMap.set(row.signoffDatePst, row);
    signoffByMemberByDate.set(row.accountId, memberMap);
  }

  const { start, end } = challengeStartAndEnd(challenge, input.asOfDateKey);

  return input.members.map((member) => {
    const byDate = signoffByMemberByDate.get(member.id) ?? new Map<string, ReadingSignoffLike>();
    const weeklyScores = challenge.scoringRules.weeklyCaps.map(() => 0);
    const weeklyPagesBonusYen = challenge.scoringRules.weeklyCaps.map(() => 0);
    const weeklyMinutesBonusYen = challenge.scoringRules.weeklyCaps.map(() => 0);
    const weeklyZeroReviewsBonusYen = challenge.scoringRules.weeklyCaps.map(() => 0);
    const weeklyCatchupBonusYen = challenge.scoringRules.weeklyCaps.map(() => 0);
    const weekOutcomesByIndex = new Map<number, DayOutcome[]>();

    let streak = 0;
    let weekStreak = 0;
    let previousWeekIndex = -1;
    let perfectDays = 0;

    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const dateKey = toDateKeyUtc(cursor);
      const record = byDate.get(dateKey) ?? null;
      const outcome = computeDayOutcome(challenge, record, dateKey);
      const weekIndex = Math.floor((cursor.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));

      if (weekIndex !== previousWeekIndex && challenge.scoringRules.streak.resetEachWeek) {
        weekStreak = 0;
        previousWeekIndex = weekIndex;
      }

      if (weekIndex >= 0 && weekIndex < weeklyScores.length) {
        weeklyPagesBonusYen[weekIndex] += outcome.pagesBonusYen;
        weeklyMinutesBonusYen[weekIndex] += outcome.minutesBonusYen;
        weeklyZeroReviewsBonusYen[weekIndex] += outcome.zeroReviewsBonusYen;
      }

      if (outcome.perfect) {
        streak += 1;
        weekStreak += 1;
        perfectDays += 1;
      } else {
        streak = 0;
        weekStreak = 0;
      }

      const multiplier = outcome.perfect ? dayMultiplierFromStreak(challenge, Math.max(0, weekStreak - 1)) : 1;
      const weightedScore = outcome.score * multiplier;

      if (weekIndex >= 0 && weekIndex < weeklyScores.length) {
        weeklyScores[weekIndex] += weightedScore;
      }

      const weekOutcomes = weekOutcomesByIndex.get(weekIndex) ?? [];
      weekOutcomes.push(outcome);
      weekOutcomesByIndex.set(weekIndex, weekOutcomes);
    }

    const weeklyBaseYen = weeklyScores.map((score, index) => {
      const cap = challenge.scoringRules.weeklyCaps[index] ?? 0;
      const payout = cap * (score / challenge.scoringRules.weeklyPerfectScore);
      return Math.max(0, Math.min(cap, Math.round(payout)));
    });

    for (const [weekIndex, outcomes] of weekOutcomesByIndex.entries()) {
      if (weekIndex < 0 || weekIndex >= weeklyCatchupBonusYen.length) {
        continue;
      }
      weeklyCatchupBonusYen[weekIndex] = computeWeeklyCatchupBonus(challenge, outcomes);
    }

    const weeklyRawBonusYen = weeklyScores.map((_, index) => (
      weeklyPagesBonusYen[index] +
      weeklyMinutesBonusYen[index] +
      weeklyZeroReviewsBonusYen[index] +
      weeklyCatchupBonusYen[index]
    ));

    const weeklyBonusYen = weeklyRawBonusYen.map((value, index) => {
      const cap = challenge.scoringRules.bonuses.weeklyCapYen[index];
      if (typeof cap !== "number") {
        return Math.max(0, value);
      }
      return Math.max(0, Math.min(cap, value));
    });

    const baseYen = weeklyBaseYen.reduce((sum, value) => sum + value, 0);
    const bonusYen = weeklyBonusYen.reduce((sum, value) => sum + value, 0);

    return {
      accountId: member.id,
      totalYen: baseYen + bonusYen,
      baseYen,
      bonusYen,
      currentStreak: streak,
      perfectDays,
      weeklyYen: weeklyBaseYen.map((value, index) => value + weeklyBonusYen[index]),
      weeklyBaseYen,
      weeklyBonusYen,
      weeklyCatchupBonusYen,
    };
  });
}

export function getChallengeDailyEarningsForecast(input: {
  challenge?: ReadingChallengeDefinition;
  accountId: string;
  signoffs: ReadingSignoffLike[];
  todayDateKey: string;
}): ReadingDailyEarningsForecast {
  const challenge = input.challenge ?? ACTIVE_READING_CHALLENGE;
  const { todayDateKey } = input;

  if (todayDateKey < challenge.startDatePst || todayDateKey > challenge.goalDatePst) {
    return {
      weekIndex: -1,
      weekCapYen: 0,
      streakInWeek: 0,
      todayMaxNormalYen: 0,
      todayMinimumNormalYen: 0,
      nextDayMaxNormalYenIfPerfectToday: 0,
      nextDayMaxNormalYenIfMissToday: 0,
    };
  }

  const byDate = new Map<string, ReadingSignoffLike>();
  for (const signoff of input.signoffs) {
    if (signoff.accountId === input.accountId) {
      byDate.set(signoff.signoffDatePst, signoff);
    }
  }

  const challengeStartDate = parseDateKeyAsUtc(challenge.startDatePst);
  const today = parseDateKeyAsUtc(todayDateKey);
  const currentWeekIndex = Math.floor(
    (today.getTime() - challengeStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  const currentWeekCap = challenge.scoringRules.weeklyCaps[currentWeekIndex] ?? 0;

  const weekStart = new Date(challengeStartDate);
  weekStart.setUTCDate(weekStart.getUTCDate() + currentWeekIndex * 7);

  let streakInWeek = 0;
  for (const cursor = new Date(weekStart); cursor < today; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dateKey = toDateKeyUtc(cursor);
    const outcome = computeDayOutcome(challenge, byDate.get(dateKey) ?? null, dateKey);
    if (!outcome.perfect) {
      streakInWeek = 0;
      continue;
    }
    streakInWeek += 1;
  }

  const todayMaxNormalYen = Math.round(
    currentWeekCap *
      (dayMultiplierFromStreak(challenge, streakInWeek) / challenge.scoringRules.weeklyPerfectScore),
  );
  const todayMinimumNormalYen = Math.round(
    currentWeekCap *
      (challenge.scoringRules.baseHalfCreditScore / challenge.scoringRules.weeklyPerfectScore),
  );

  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = toDateKeyUtc(tomorrow);
  const tomorrowWeekIndex = Math.floor(
    (tomorrow.getTime() - challengeStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  const tomorrowWeekCap = challenge.scoringRules.weeklyCaps[tomorrowWeekIndex] ?? 0;

  let nextDayMaxNormalYenIfPerfectToday = 0;
  let nextDayMaxNormalYenIfMissToday = 0;

  if (tomorrowKey >= challenge.startDatePst && tomorrowKey <= challenge.goalDatePst) {
    const sameWeek = tomorrowWeekIndex === currentWeekIndex;
    const nextStreakAfterPerfectToday = sameWeek ? streakInWeek + 1 : 0;

    nextDayMaxNormalYenIfPerfectToday = Math.round(
      tomorrowWeekCap *
        (dayMultiplierFromStreak(challenge, nextStreakAfterPerfectToday) /
          challenge.scoringRules.weeklyPerfectScore),
    );

    nextDayMaxNormalYenIfMissToday = Math.round(
      tomorrowWeekCap *
        (dayMultiplierFromStreak(challenge, 0) / challenge.scoringRules.weeklyPerfectScore),
    );
  }

  return {
    weekIndex: currentWeekIndex,
    weekCapYen: currentWeekCap,
    streakInWeek,
    todayMaxNormalYen,
    todayMinimumNormalYen,
    nextDayMaxNormalYenIfPerfectToday,
    nextDayMaxNormalYenIfMissToday,
  };
}
