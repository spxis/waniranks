export type ReadingChallengeStatus = "draft" | "active" | "completed" | "archived";

export type ReadingChallengeScoringRules = {
  weeklyCaps: number[];
  weeklyPerfectScore: number;
  baseHalfCreditScore: number;
  streak: {
    incrementPerPerfectDay: number;
    maxMultiplier: number;
    resetEachWeek: boolean;
  };
  thresholds: {
    pages: number;
    minutes: number;
  };
  bonuses: {
    weeklyCapYen: number[];
    pages: {
      threshold: number;
      yen: number;
    };
    minutes: {
      threshold: number;
      yen: number;
    };
    zeroReviews: {
      enabled: boolean;
      yen: number;
    };
    catchupStrongFinish: {
      enabled: boolean;
      strongFinishPerfectDays: number;
      requiresEarlierFailureInWeek: boolean;
      yenPerStrongFinishDay: number;
    };
  };
};

export type ReadingChallengeDefinition = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: ReadingChallengeStatus;
  currencyCode: "JPY";
  startDatePst: string;
  goalDatePst: string;
  tripDatePst: string;
  targetBaseYen: number;
  scoringRules: ReadingChallengeScoringRules;
};

export const FIRST_READING_CHALLENGE: ReadingChallengeDefinition = {
  id: "reading-challenge-2026-trip",
  slug: "japan-trip-2026-40k",
  name: "Japan Trip 2026",
  description: "Build steady daily reading and WaniKani habits toward trip savings.",
  status: "active",
  currencyCode: "JPY",
  startDatePst: "2026-05-24",
  goalDatePst: "2026-07-20",
  tripDatePst: "2026-07-21",
  targetBaseYen: 40_000,
  scoringRules: {
    weeklyCaps: [3500, 4000, 4500, 4750, 5000, 5250, 6000, 7000],
    weeklyPerfectScore: 9.1,
    baseHalfCreditScore: 0.5,
    streak: {
      incrementPerPerfectDay: 0.1,
      maxMultiplier: 1.6,
      resetEachWeek: true,
    },
    thresholds: {
      pages: 15,
      minutes: 15,
    },
    bonuses: {
      weeklyCapYen: [900, 950, 1000, 1050, 1100, 1150, 1200, 1250],
      pages: {
        threshold: 15,
        yen: 250,
      },
      minutes: {
        threshold: 30,
        yen: 500,
      },
      zeroReviews: {
        enabled: true,
        yen: 150,
      },
      catchupStrongFinish: {
        enabled: true,
        strongFinishPerfectDays: 2,
        requiresEarlierFailureInWeek: true,
        yenPerStrongFinishDay: 125,
      },
    },
  },
};

export const ACTIVE_READING_CHALLENGE = FIRST_READING_CHALLENGE;
