import {
  computeChallengeLeaderboard,
  type ReadingSignoffLike,
} from "@/lib/readingChallengeEngine";
import {
  ACTIVE_READING_CHALLENGE,
  type ReadingChallengeDefinition,
} from "@/lib/readingChallengeRules";

export type ReadingChallengeSimulationScenarioId =
  | "minimal_pass_every_day"
  | "maximal_every_day"
  | "midweek_fail_then_strong_finish";

export type ReadingChallengeSimulationResult = {
  scenarioId: ReadingChallengeSimulationScenarioId;
  totalYen: number;
  baseYen: number;
  bonusYen: number;
  weeklyYen: number[];
  weeklyBaseYen: number[];
  weeklyBonusYen: number[];
  weeklyCatchupBonusYen: number[];
  perfectDays: number;
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

function dateKeysInRange(startDatePst: string, goalDatePst: string): string[] {
  const out: string[] = [];
  const start = parseDateKeyAsUtc(startDatePst);
  const end = parseDateKeyAsUtc(goalDatePst);

  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    out.push(toDateKeyUtc(cursor));
  }

  return out;
}

function weekDayIndex(challengeStartDatePst: string, dateKey: string): number {
  const start = parseDateKeyAsUtc(challengeStartDatePst);
  const date = parseDateKeyAsUtc(dateKey);
  const diffDays = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return ((diffDays % 7) + 7) % 7;
}

function makeRecord(args: {
  accountId: string;
  dateKey: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
  reviewsLeft: number;
}): ReadingSignoffLike {
  return {
    accountId: args.accountId,
    signoffDatePst: args.dateKey,
    pagesRead: args.pagesRead,
    minutesRead: args.minutesRead,
    didWanikaniReviews: args.didWanikaniReviews,
    reviewsLeft: args.reviewsLeft,
  };
}

function signoffsForScenario(args: {
  challenge: ReadingChallengeDefinition;
  accountId: string;
  scenarioId: ReadingChallengeSimulationScenarioId;
}): ReadingSignoffLike[] {
  const { challenge, accountId, scenarioId } = args;
  const { thresholds } = challenge.scoringRules;
  const keys = dateKeysInRange(challenge.startDatePst, challenge.goalDatePst);

  if (scenarioId === "minimal_pass_every_day") {
    return keys.map((dateKey) =>
      makeRecord({
        accountId,
        dateKey,
        pagesRead: thresholds.pages,
        minutesRead: 0,
        didWanikaniReviews: true,
        reviewsLeft: 5,
      }),
    );
  }

  if (scenarioId === "maximal_every_day") {
    return keys.map((dateKey) =>
      makeRecord({
        accountId,
        dateKey,
        pagesRead: thresholds.pages + 20,
        minutesRead: challenge.scoringRules.bonuses.minutes.threshold + 5,
        didWanikaniReviews: true,
        reviewsLeft: 0,
      }),
    );
  }

  return keys.flatMap((dateKey) => {
    const day = weekDayIndex(challenge.startDatePst, dateKey);

    if (day === 2) {
      return [];
    }

    if (day >= 5) {
      return [
        makeRecord({
          accountId,
          dateKey,
          pagesRead: thresholds.pages + 12,
          minutesRead: challenge.scoringRules.bonuses.minutes.threshold + 2,
          didWanikaniReviews: true,
          reviewsLeft: 0,
        }),
      ];
    }

    return [
      makeRecord({
        accountId,
        dateKey,
        pagesRead: thresholds.pages,
        minutesRead: 0,
        didWanikaniReviews: true,
        reviewsLeft: 8,
      }),
    ];
  });
}

export function runReadingChallengeSimulation(
  challenge: ReadingChallengeDefinition = ACTIVE_READING_CHALLENGE,
): ReadingChallengeSimulationResult[] {
  const scenarios: ReadingChallengeSimulationScenarioId[] = [
    "minimal_pass_every_day",
    "maximal_every_day",
    "midweek_fail_then_strong_finish",
  ];

  return scenarios.map((scenarioId) => {
    const accountId = `sim-${scenarioId}`;
    const signoffs = signoffsForScenario({
      challenge,
      accountId,
      scenarioId,
    });

    const row = computeChallengeLeaderboard({
      challenge,
      members: [{ id: accountId }],
      signoffs,
      asOfDateKey: challenge.goalDatePst,
    })[0];

    return {
      scenarioId,
      totalYen: row.totalYen,
      baseYen: row.baseYen,
      bonusYen: row.bonusYen,
      weeklyYen: row.weeklyYen,
      weeklyBaseYen: row.weeklyBaseYen,
      weeklyBonusYen: row.weeklyBonusYen,
      weeklyCatchupBonusYen: row.weeklyCatchupBonusYen,
      perfectDays: row.perfectDays,
    };
  });
}
