import {
  ACTIVE_READING_CHALLENGE,
  type ReadingChallengeDefinition,
} from "@/lib/readingChallengeRules";
import { runReadingChallengeSimulation } from "@/lib/readingChallengeSimulation";

function formatYen(value: number): string {
  return `JPY ${value.toLocaleString("en-US")}`;
}

const SCENARIO_LABELS: Record<string, string> = {
  minimal_pass_every_day: "Minimal pass daily",
  maximal_every_day: "Max effort daily",
  midweek_fail_then_strong_finish: "Midweek fail + strong finish",
};

type Props = {
  challenge?: ReadingChallengeDefinition;
};

export default function AdminChallengeSimulator({
  challenge = ACTIVE_READING_CHALLENGE,
}: Props) {
  const results = runReadingChallengeSimulation(challenge);

  return (
    <section id="challenge-simulator" className="rounded-2xl border border-line bg-surface/90 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">Challenge simulator</p>
          <h3 className="mt-1 text-xl font-black text-foreground">{challenge.name}</h3>
          <p className="mt-1 text-sm text-foreground/70">
            {challenge.startDatePst} to {challenge.goalDatePst} · target base {formatYen(challenge.targetBaseYen)}
          </p>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full divide-y divide-line text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-[0.08em] text-foreground/70">
            <tr>
              <th className="px-3 py-2">Scenario</th>
              <th className="px-3 py-2">Base</th>
              <th className="px-3 py-2">Bonus</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Perfect days</th>
              <th className="px-3 py-2">Weekly bonus (capped)</th>
              <th className="px-3 py-2">Weekly payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {results.map((row) => (
              <tr key={row.scenarioId} className="bg-surface">
                <td className="px-3 py-2 font-semibold text-foreground">
                  {SCENARIO_LABELS[row.scenarioId] ?? row.scenarioId}
                </td>
                <td className="px-3 py-2 text-foreground/80">{formatYen(row.baseYen)}</td>
                <td className="px-3 py-2 text-foreground/80">{formatYen(row.bonusYen)}</td>
                <td className="px-3 py-2 font-bold text-accent">{formatYen(row.totalYen)}</td>
                <td className="px-3 py-2 text-foreground/80">{row.perfectDays}</td>
                <td className="px-3 py-2 text-xs text-foreground/75">
                  {row.weeklyBonusYen.map((value, index) => `W${index + 1}:${value.toLocaleString("en-US")}`).join(" · ")}
                </td>
                <td className="px-3 py-2 text-xs text-foreground/75">
                  {row.weeklyYen.map((value, index) => `W${index + 1}:${value.toLocaleString("en-US")}`).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-xs text-foreground/70">
        Perfect day means both reading threshold and WaniKani review activity were completed for that day.
      </div>
      <div className="mt-1 text-xs text-foreground/70">
        Weekly bonus values are capped by scoringRules.bonuses.weeklyCapYen.
      </div>

      <details className="mt-3 rounded-xl border border-line bg-surface-muted p-3">
        <summary className="cursor-pointer text-sm font-bold text-foreground">Challenge definition JSON</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-2 text-xs text-foreground/80">
          {JSON.stringify(challenge, null, 2)}
        </pre>
      </details>
    </section>
  );
}
