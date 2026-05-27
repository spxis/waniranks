import { z } from "zod";

import { isPstDateKey } from "@/lib/readingSignoff";

export const readingChallengeStatusSchema = z.enum(["draft", "active", "completed", "archived"]);

export const readingChallengeScoringRulesSchema = z.object({
  weeklyCaps: z.array(z.number().int().min(0).max(100_000)).min(1).max(24),
  weeklyPerfectScore: z.number().min(0).max(100),
  baseHalfCreditScore: z.number().min(0).max(100),
  minimalCheckinScore: z.number().min(0).max(100).optional(),
  streak: z.object({
    incrementPerPerfectDay: z.number().min(0).max(10),
    maxMultiplier: z.number().min(1).max(10),
    resetEachWeek: z.boolean(),
  }),
  thresholds: z.object({
    pages: z.number().int().min(0).max(5000),
    minutes: z.number().int().min(0).max(1440),
  }),
  bonuses: z.object({
    weeklyCapYen: z.array(z.number().int().min(0).max(100_000)).min(1).max(24),
    pages: z.object({
      threshold: z.number().int().min(0).max(5000),
      yen: z.number().int().min(0).max(100_000),
    }),
    minutes: z.object({
      threshold: z.number().int().min(0).max(1440),
      yen: z.number().int().min(0).max(100_000),
    }),
    zeroReviews: z.object({
      enabled: z.boolean(),
      yen: z.number().int().min(0).max(100_000),
    }),
    catchupStrongFinish: z.object({
      enabled: z.boolean(),
      strongFinishPerfectDays: z.number().int().min(0).max(7),
      requiresEarlierFailureInWeek: z.boolean(),
      yenPerStrongFinishDay: z.number().int().min(0).max(100_000),
    }),
  }),
});

export const readingChallengeMutationSchema = z
  .object({
    id: z.string().min(1).max(120).optional(),
    slug: z.string().trim().min(2).max(120),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(2).max(280),
    status: readingChallengeStatusSchema,
    currencyCode: z.literal("JPY"),
    startDatePst: z.string().refine((value) => isPstDateKey(value), {
      message: "Invalid start date.",
    }),
    goalDatePst: z.string().refine((value) => isPstDateKey(value), {
      message: "Invalid goal date.",
    }),
    tripDatePst: z.string().refine((value) => isPstDateKey(value), {
      message: "Invalid trip date.",
    }),
    targetBaseYen: z.number().int().min(0).max(500_000),
    scoringRules: readingChallengeScoringRulesSchema,
  })
  .superRefine((value, ctx) => {
    if (value.startDatePst > value.goalDatePst) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDatePst"],
        message: "Start date must be on or before goal date.",
      });
    }

    if (value.goalDatePst > value.tripDatePst) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["goalDatePst"],
        message: "Goal date must be on or before trip date.",
      });
    }

    if (value.scoringRules.weeklyCaps.length !== value.scoringRules.bonuses.weeklyCapYen.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scoringRules", "bonuses", "weeklyCapYen"],
        message: "Weekly base caps and weekly bonus caps must have the same length.",
      });
    }
  });
