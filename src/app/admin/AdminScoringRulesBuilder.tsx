"use client";

import { ACTIVE_READING_CHALLENGE } from "@/lib/readingChallengeRules";

type AdminScoringRulesBuilderProps = {
  value: string;
  disabled: boolean;
  onChange: (nextValue: string) => void;
};

type ScoringRules = typeof ACTIVE_READING_CHALLENGE.scoringRules;

function toJson(rules: ScoringRules): string {
  return JSON.stringify(rules, null, 2);
}

function parseRules(value: string): { rules: ScoringRules | null; error: string | null } {
  try {
    const parsed = JSON.parse(value) as ScoringRules;
    return { rules: parsed, error: null };
  } catch {
    return { rules: null, error: "JSON is invalid. Fix it in Advanced editor or reset builder." };
  }
}

function parseIntegerList(input: string, fallback: number[]): number[] {
  const values = input
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && Number.isInteger(value) && value >= 0);

  return values.length > 0 ? values : fallback;
}

export default function AdminScoringRulesBuilder({ value, disabled, onChange }: AdminScoringRulesBuilderProps) {
  const { rules, error } = parseRules(value);

  function apply(mutator: (draft: ScoringRules) => void) {
    if (!rules) {
      return;
    }

    const next = structuredClone(rules);
    mutator(next);
    onChange(toJson(next));
  }

  function applyGenerousPreset() {
    if (!rules) {
      return;
    }

    const next = structuredClone(rules);
    next.weeklyPerfectScore = Number((next.weeklyPerfectScore + 1.2).toFixed(2));
    next.baseHalfCreditScore = Number((next.baseHalfCreditScore + 0.25).toFixed(2));
    next.thresholds.pages = Math.max(1, Math.round(next.thresholds.pages * 0.66));
    next.thresholds.minutes = Math.max(1, Math.round(next.thresholds.minutes * 0.66));
    next.weeklyCaps = next.weeklyCaps.map((value) => Math.round(value * 1.2));
    next.bonuses.weeklyCapYen = next.bonuses.weeklyCapYen.map((value) => Math.round(value * 1.4));
    next.bonuses.pages.threshold = Math.max(1, Math.round(next.bonuses.pages.threshold * 0.8));
    next.bonuses.pages.yen = Math.round(next.bonuses.pages.yen * 1.5);
    next.bonuses.minutes.threshold = Math.max(1, Math.round(next.bonuses.minutes.threshold * 0.8));
    next.bonuses.minutes.yen = Math.round(next.bonuses.minutes.yen * 1.5);
    next.bonuses.zeroReviews.enabled = true;
    next.bonuses.zeroReviews.yen = Math.round(next.bonuses.zeroReviews.yen * 1.8);
    next.bonuses.catchupStrongFinish.enabled = true;
    next.bonuses.catchupStrongFinish.requiresEarlierFailureInWeek = false;
    next.bonuses.catchupStrongFinish.yenPerStrongFinishDay = Math.round(
      next.bonuses.catchupStrongFinish.yenPerStrongFinishDay * 2,
    );

    onChange(toJson(next));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-foreground/65">Scoring rules builder</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(toJson(ACTIVE_READING_CHALLENGE.scoringRules))}
            className="h-8 rounded-full border border-line bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 disabled:opacity-60"
            disabled={disabled}
          >
            Reset to 40k base
          </button>
          <button
            type="button"
            onClick={applyGenerousPreset}
            className="h-8 rounded-full border border-line bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 disabled:opacity-60"
            disabled={disabled || !rules}
          >
            Generate generous preset
          </button>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p> : null}

      <div className="grid gap-3 rounded-lg border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-foreground/75">
          Weekly perfect score
          <input
            type="number"
            step="0.01"
            value={rules?.weeklyPerfectScore ?? ""}
            onChange={(event) => apply((next) => { next.weeklyPerfectScore = Number(event.target.value || 0); })}
            className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-xs"
            disabled={disabled || !rules}
          />
        </label>
        <label className="text-xs font-semibold text-foreground/75">
          Base half-credit score
          <input
            type="number"
            step="0.01"
            value={rules?.baseHalfCreditScore ?? ""}
            onChange={(event) => apply((next) => { next.baseHalfCreditScore = Number(event.target.value || 0); })}
            className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-xs"
            disabled={disabled || !rules}
          />
        </label>
        <label className="text-xs font-semibold text-foreground/75">
          Reading pages threshold
          <input
            type="number"
            value={rules?.thresholds.pages ?? ""}
            onChange={(event) => apply((next) => { next.thresholds.pages = Number(event.target.value || 0); })}
            className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-xs"
            disabled={disabled || !rules}
          />
        </label>
        <label className="text-xs font-semibold text-foreground/75">
          Reading minutes threshold
          <input
            type="number"
            value={rules?.thresholds.minutes ?? ""}
            onChange={(event) => apply((next) => { next.thresholds.minutes = Number(event.target.value || 0); })}
            className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-xs"
            disabled={disabled || !rules}
          />
        </label>
        <label className="sm:col-span-2 text-xs font-semibold text-foreground/75">
          Weekly base caps (comma-separated)
          <input
            type="text"
            value={rules?.weeklyCaps.join(", ") ?? ""}
            onChange={(event) => apply((next) => { next.weeklyCaps = parseIntegerList(event.target.value, next.weeklyCaps); })}
            className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-xs"
            disabled={disabled || !rules}
          />
        </label>
        <label className="sm:col-span-2 text-xs font-semibold text-foreground/75">
          Weekly bonus caps (comma-separated)
          <input
            type="text"
            value={rules?.bonuses.weeklyCapYen.join(", ") ?? ""}
            onChange={(event) => apply((next) => {
              next.bonuses.weeklyCapYen = parseIntegerList(event.target.value, next.bonuses.weeklyCapYen);
            })}
            className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-xs"
            disabled={disabled || !rules}
          />
        </label>
      </div>
    </div>
  );
}
