import { describe, expect, it } from "vitest";

import { ACTIVE_READING_CHALLENGE } from "@/lib/readingChallengeRules";
import { runReadingChallengeSimulation } from "@/lib/readingChallengeSimulation";

describe("runReadingChallengeSimulation", () => {
  it("covers min/max/failure scenarios end-to-end", () => {
    const results = runReadingChallengeSimulation(ACTIVE_READING_CHALLENGE);

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.weeklyYen).toHaveLength(ACTIVE_READING_CHALLENGE.scoringRules.weeklyCaps.length);
      expect(result.totalYen).toBeGreaterThan(0);
      expect(result.baseYen + result.bonusYen).toBe(result.totalYen);
    }
  });

  it("keeps base payout around 40,000 for daily minimal passes", () => {
    const results = runReadingChallengeSimulation(ACTIVE_READING_CHALLENGE);
    const minimal = results.find((row) => row.scenarioId === "minimal_pass_every_day");

    expect(minimal).toBeTruthy();
    expect(minimal?.baseYen).toBeGreaterThanOrEqual(39_500);
    expect(minimal?.baseYen).toBeLessThanOrEqual(40_000);
  });

  it("rewards max effort and strong finish after a failed day", () => {
    const results = runReadingChallengeSimulation(ACTIVE_READING_CHALLENGE);
    const maximal = results.find((row) => row.scenarioId === "maximal_every_day");
    const failureRecovery = results.find((row) => row.scenarioId === "midweek_fail_then_strong_finish");

    expect(maximal).toBeTruthy();
    expect(failureRecovery).toBeTruthy();

    expect(maximal!.totalYen).toBeGreaterThan(maximal!.baseYen);
    expect(failureRecovery!.weeklyCatchupBonusYen.some((value) => value > 0)).toBe(true);
    expect(failureRecovery!.totalYen).toBeGreaterThan(failureRecovery!.baseYen);
  });

  it("caps total bonuses per week for max effort scenario", () => {
    const results = runReadingChallengeSimulation(ACTIVE_READING_CHALLENGE);
    const maximal = results.find((row) => row.scenarioId === "maximal_every_day");

    expect(maximal).toBeTruthy();

    const weeklyCaps = ACTIVE_READING_CHALLENGE.scoringRules.bonuses.weeklyCapYen;
    expect(maximal!.weeklyBonusYen.every((value, index) => value <= (weeklyCaps[index] ?? Number.POSITIVE_INFINITY))).toBe(true);
    expect(maximal!.bonusYen).toBeLessThanOrEqual(weeklyCaps.reduce((sum, value) => sum + value, 0));
  });
});
