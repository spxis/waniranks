import { EMPTY_ITEM_SPREAD, isItemSpread } from "@/lib/itemSpread";
import { LEARNED_SRS_GROUP_LABELS } from "@/lib/domainConstants";
import {
  LEADERBOARD_24H_OVERALL_LABELS,
  LEADERBOARD_JLPT_LABEL_ROWS,
} from "./Leaderboard.constants";

import type { LeaderboardRow, LeaderboardTab } from "../lib/leaderboardTypes";
import {
  deltaClass,
  formatDate,
  formatDelta,
  formatNumber,
  formatSince,
  jlptCompletionClass,
  jlptCountsFromRow,
} from "../lib/leaderboardUtils";

type Props = {
  row: LeaderboardRow;
  activeTab: LeaderboardTab;
  canRefreshAdmin: boolean;
  isRefreshing: boolean;
  onRefreshUser: () => Promise<void>;
  showItemSpreadPanel: boolean;
  showLevelProgressPanel: boolean;
  onToggleItemSpreadPanel: () => void;
  onToggleLevelProgressPanel: () => void;
};

export default function LeaderboardExpandedRow({
  row,
  activeTab,
  canRefreshAdmin,
  isRefreshing,
  onRefreshUser,
  showItemSpreadPanel,
  showLevelProgressPanel,
  onToggleItemSpreadPanel,
  onToggleLevelProgressPanel,
}: Props) {
  const spread = isItemSpread(row.itemSpread) ? row.itemSpread : EMPTY_ITEM_SPREAD;
  const jlpt = jlptCountsFromRow(row);
  const kanjiGoal = Math.ceil(row.levelKanjiTotal * 0.9);
  const remainingToLevelUp = Math.max(0, kanjiGoal - row.levelKanjiGuruPlus);

  const stageCountByKey = {
    apprentice: row.apprenticeCount,
    guru: row.guruCount,
    master: row.masterCount,
    enlightened: row.enlightenedCount,
    burned: row.burnedCount,
  } as const;

  function jlptCountForLabel(label: "N5" | "N4" | "N3" | "N2" | "N1") {
    if (label === "N5") return jlpt.n5;
    if (label === "N4") return jlpt.n4;
    if (label === "N3") return jlpt.n3;
    if (label === "N2") return jlpt.n2;
    return jlpt.n1;
  }

  function deltaForOverallLabel(label: (typeof LEADERBOARD_24H_OVERALL_LABELS)[number]) {
    if (label === "Score") return row.dailyDelta?.score;
    if (label === "Reviews") return row.dailyDelta?.reviewCount;
    if (label === "Level") return row.dailyDelta?.wkLevel;
    if (label === "Radicals") return row.dailyDelta?.radicalCount;
    if (label === "Vocab") return row.dailyDelta?.vocabularyCount;
    if (label === "Burned") return row.dailyDelta?.burnedCount;
    return row.dailyDelta?.levelKanjiLearned;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[0.7fr_1.5fr_1.5fr_1fr]">
        <div className="rounded-2xl border border-accent/25 bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Due Now</p>
          <p className="mt-1 text-4xl font-black text-accent">{formatNumber(row.pendingReviews)}</p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/60">
            Last updated {formatDate(row.lastSyncedAt)} ({formatSince(row.lastSyncedAt)})
          </p>
          {canRefreshAdmin ? (
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => {
                void onRefreshUser();
              }}
              className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-line bg-white px-4 text-[11px] font-black uppercase tracking-[0.1em] text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? "Refreshing..." : "Refresh user"}
            </button>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">SRS Stages</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LEARNED_SRS_GROUP_LABELS.map(({ key, label }) => (
              <div key={label} className="min-w-[84px] flex-1 rounded-xl border border-line bg-surface-muted p-2 text-center">
                <p className="text-[10px] font-bold uppercase text-foreground/70">{label}</p>
                <p className="text-xl font-black leading-none text-foreground">{formatNumber(stageCountByKey[key])}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">JLPT Levels</p>
          <div className="mt-3 space-y-2">
            {LEADERBOARD_JLPT_LABEL_ROWS.map((labels, rowIndex) => (
              <div key={`jlpt-row-${rowIndex}`} className={`grid ${rowIndex === 0 ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
                {labels.map((label) => {
                  const count = jlptCountForLabel(label);

                  return (
                    <div key={label} className={`rounded-xl border p-2 text-center ${jlptCompletionClass(count.percent)}`}>
                      <p className="text-[10px] font-bold uppercase opacity-90">{label}</p>
                      <p className="text-lg font-black leading-none">
                        {formatNumber(count.learned)}/{formatNumber(count.total)}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold opacity-90">{count.percent}%</p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Level {row.wkLevel} Kanji</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80">
              Learned: {formatNumber(row.levelKanjiLearned)}
            </span>
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80">
              Total: {formatNumber(row.levelKanjiTotal)}
            </span>
            <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80">
              Locked: {formatNumber(row.levelKanjiLocked)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.8fr_1.2fr]">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Item Spread</p>
            <button
              type="button"
              onClick={onToggleItemSpreadPanel}
              className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground"
            >
              {showItemSpreadPanel ? "Collapse" : "Expand"}
            </button>
          </div>
          {showItemSpreadPanel ? (
            <>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                <span className="subject-pill subject-pill--radical">Radical</span>
                <span className="subject-pill subject-pill--kanji">Kanji</span>
                <span className="subject-pill subject-pill--vocabulary">Vocabulary</span>
              </div>
              <div className="mt-2 space-y-1">
                {LEARNED_SRS_GROUP_LABELS.map(({ key, label }) => {
                  const data = spread[key];

                  return (
                  <div
                    key={label}
                    className="grid grid-cols-[1.1fr_0.7fr_0.7fr_0.8fr_0.8fr] items-center gap-2 rounded-lg border border-line bg-surface-muted px-2 py-1 text-xs font-semibold text-foreground/80"
                  >
                    <p>{label}</p>
                    <p className="text-radical">{formatNumber(data.radical)}</p>
                    <p className="text-kanji">{formatNumber(data.kanji)}</p>
                    <p className="text-vocabulary">{formatNumber(data.vocabulary)}</p>
                    <p className="text-right text-base font-black text-foreground">{formatNumber(data.total)}</p>
                  </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Level Progress</p>
            <button
              type="button"
              onClick={onToggleLevelProgressPanel}
              className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground"
            >
              {showLevelProgressPanel ? "Collapse" : "Expand"}
            </button>
          </div>
          {showLevelProgressPanel ? (
            <>
              <p className="mt-1 text-sm font-semibold text-foreground/80">Level {row.wkLevel}</p>
              <div className="mt-3 h-2 rounded-full bg-surface-muted">
                <div
                  className="h-2 rounded-full bg-kanji"
                  style={{
                    width: `${
                      row.levelKanjiTotal === 0 ? 0 : Math.min(100, Math.round((row.levelKanjiGuruPlus / row.levelKanjiTotal) * 100))
                    }%`,
                  }}
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground/80">
                Guru+ Kanji: {formatNumber(row.levelKanjiGuruPlus)}/{formatNumber(row.levelKanjiTotal)}
              </p>
              <p className="mt-1 text-sm text-foreground/70">
                {row.levelKanjiGuruPlus >= kanjiGoal
                  ? "Level-up gate passed; cleanup remains."
                  : `Need ${formatNumber(remainingToLevelUp)} more Guru+ kanji to level up.`}
              </p>
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/60">Last Gurued</p>
                <div className="mt-2 space-y-1 text-xs font-semibold text-foreground/75">
                  <p>Radical: {row.lastRadicalGuruedAt ? formatDate(row.lastRadicalGuruedAt) : "-"}</p>
                  <p>Kanji: {row.lastKanjiGuruedAt ? formatDate(row.lastKanjiGuruedAt) : "-"}</p>
                  <p>Vocab: {row.lastVocabularyGuruedAt ? formatDate(row.lastVocabularyGuruedAt) : "-"}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">24h Change</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            activeTab === "overall"
              ? LEADERBOARD_24H_OVERALL_LABELS.map((label) => [label, deltaForOverallLabel(label)] as const)
              : ([
                  ["Level", row.dailyDelta?.wkLevel],
                  [
                    activeTab === "radicals"
                      ? "Radicals"
                      : activeTab === "kanji"
                        ? "Learned Kanji"
                        : "Vocab",
                    activeTab === "radicals"
                      ? row.dailyDelta?.radicalCount
                      : activeTab === "kanji"
                        ? row.dailyDelta?.levelKanjiLearned
                        : row.dailyDelta?.vocabularyCount,
                  ],
                  ["Burned", row.dailyDelta?.burnedCount],
                ] as const)
          ).map(([label, delta]) => (
            <div key={label} className="rounded-xl border border-line bg-surface-muted px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/70">{label}</p>
              <p className={`mt-1 text-xl font-black ${deltaClass(delta)}`}>{formatDelta(delta)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
