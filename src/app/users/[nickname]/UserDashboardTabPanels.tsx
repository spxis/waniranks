"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  LEARNED_SRS_GROUP_LABELS,
  LEARNED_SRS_GROUPS,
  SUBJECT_TYPES,
  WK_STATUSES,
  type SrsProgressStatus,
  type SubjectType,
} from "@/lib/domainConstants";
import type { ItemSpread, ItemSpreadRow } from "@/lib/itemSpread";
import {
  formatNumber,
  srsBadgeClass,
  srsSegmentClass,
  srsSegmentTextClass,
  stageLabel,
} from "./userDashboardSrsUi";
import {
  DASHBOARD_SUBJECT_TYPES,
} from "./UserDashboard.constants";

import { subjectTypePluralLabel } from "./shared/subjectTypeLabels";
import type {
  ItemSpreadGroupDetails,
  LevelProgressSnapshot,
  SrsGroupKey,
  TypeProgress,
} from "./UserDashboardTabs.types";

type MainTabPanelProps = {
  wkLevel: number;
  levelKanjiLearned: number;
  levelKanjiTotal: number;
  levelKanjiLocked: number;
  totalLearnedKanji: number;
  estimatedHoursRemaining: number | null;
  apprenticeCount: number;
  guruCount: number;
  masterCount: number;
  enlightenedCount: number;
  burnedCount: number;
  radicalCount: number;
  totalKanjiCount: number;
  vocabularyCount: number;
};

export function MainTabPanel({
  wkLevel,
  levelKanjiLearned,
  levelKanjiTotal,
  levelKanjiLocked,
  totalLearnedKanji,
  estimatedHoursRemaining,
  apprenticeCount,
  guruCount,
  masterCount,
  enlightenedCount,
  burnedCount,
  radicalCount,
  totalKanjiCount,
  vocabularyCount,
}: MainTabPanelProps) {
  const srsCountsByGroup: Record<SrsGroupKey, number> = {
    apprentice: apprenticeCount,
    guru: guruCount,
    master: masterCount,
    enlightened: enlightenedCount,
    burned: burnedCount,
  };

  return (
    <div className="mt-3 sm:mt-4" role="tabpanel">
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:grid-cols-5">
        <article className="rounded-xl border border-line bg-surface-muted p-2 text-center sm:rounded-2xl sm:p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70 sm:text-xs">Level</p>
          <p className="mt-1 text-xl font-black text-accent sm:mt-2 sm:text-4xl">{formatNumber(wkLevel)}</p>
        </article>
        <article className="rounded-xl border border-line bg-surface-muted p-2 text-center sm:rounded-2xl sm:p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70 sm:text-xs">Learned Kanji</p>
          <p className="mt-1 text-xl font-black text-foreground sm:mt-2 sm:text-4xl">{formatNumber(levelKanjiLearned)}</p>
          <p className="text-[10px] text-foreground/65 sm:text-xs">of {formatNumber(levelKanjiTotal)} in this level</p>
        </article>
        <article className="rounded-xl border border-line bg-surface-muted p-2 text-center sm:rounded-2xl sm:p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70 sm:text-xs">Remaining</p>
          <p className="mt-1 text-xl font-black text-hot sm:mt-2 sm:text-4xl">
            {formatNumber(Math.max(0, levelKanjiTotal - levelKanjiLearned))}
          </p>
          <p className="text-[10px] text-foreground/65 sm:text-xs">locked: {formatNumber(levelKanjiLocked)}</p>
        </article>
        <article className="rounded-xl border border-kanji/30 bg-kanji/10 p-2 text-center sm:rounded-2xl sm:p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-kanji sm:text-xs">Total Learned</p>
          <p className="mt-1 text-xl font-black text-kanji sm:mt-2 sm:text-4xl">{formatNumber(totalLearnedKanji)}</p>
          <p className="text-[10px] text-foreground/65 sm:text-xs">all kanji at Guru+</p>
        </article>
        <article className="col-span-2 rounded-xl border border-line bg-surface-muted p-2 text-center sm:col-span-1 sm:rounded-2xl sm:p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70 sm:text-xs">Est. Time Remaining</p>
          <p className="mt-1 text-lg font-black text-foreground sm:mt-2 sm:text-3xl">
            {estimatedHoursRemaining === null ? "Unknown" : `${estimatedHoursRemaining}h`}
          </p>
          <p className="text-[10px] text-foreground/65 sm:text-xs">Until 90% level kanji at Guru+</p>
        </article>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5 sm:mt-4 sm:gap-2 lg:grid-cols-8">
        {LEARNED_SRS_GROUP_LABELS.map(({ key, label, shortLabel }) => (
          <SrsLink key={key} label={label} shortLabel={shortLabel} query={key} value={srsCountsByGroup[key]} />
        ))}
        <div className="rounded-lg border border-radical/40 bg-radical/10 px-1.5 py-1.5 text-center text-[10px] font-semibold text-radical sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
          <span className="block"><span className="sm:hidden">Rad:</span><span className="hidden sm:inline">{subjectTypePluralLabel(SUBJECT_TYPES.radical)}:</span></span>
          <span className="mt-0.5 block text-xl font-black leading-none sm:text-4xl">{formatNumber(radicalCount)}</span>
        </div>
        <div className="rounded-lg border border-kanji/40 bg-kanji/10 px-1.5 py-1.5 text-center text-[10px] font-semibold text-kanji sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
          <span className="block"><span className="sm:hidden">Kan:</span><span className="hidden sm:inline">{subjectTypePluralLabel(SUBJECT_TYPES.kanji)}:</span></span>
          <span className="mt-0.5 block text-xl font-black leading-none sm:text-4xl">{formatNumber(totalKanjiCount)}</span>
        </div>
        <div className="rounded-lg border border-vocabulary/40 bg-vocabulary/10 px-1.5 py-1.5 text-center text-[10px] font-semibold text-vocabulary sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
          <span className="block"><span className="sm:hidden">Voc:</span><span className="hidden sm:inline">{subjectTypePluralLabel(SUBJECT_TYPES.vocabulary)}:</span></span>
          <span className="mt-0.5 block text-xl font-black leading-none sm:text-4xl">{formatNumber(vocabularyCount)}</span>
        </div>
      </div>
    </div>
  );
}

type ItemSpreadTabPanelProps = {
  itemSpread: ItemSpread;
  itemSpreadDetails: ItemSpreadGroupDetails;
};

export function ItemSpreadTabPanel({ itemSpread, itemSpreadDetails }: ItemSpreadTabPanelProps) {
  const [detailedView, setDetailedView] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<SrsGroupKey, boolean>>(() =>
    Object.fromEntries(LEARNED_SRS_GROUPS.map((group) => [group, false])) as Record<SrsGroupKey, boolean>,
  );

  const groupedRows: Array<[SrsGroupKey, string, ItemSpreadRow]> = LEARNED_SRS_GROUP_LABELS.map(({ key, label }) => [
    key,
    label,
    itemSpread[key],
  ]);

  const toggleExpanded = (group: SrsGroupKey) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };
  return (
    <div className="mt-4" role="tabpanel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-black text-foreground">Item Spread</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDetailedView((prev) => !prev)}
            className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-surface px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
          >
            {detailedView ? "Regular View" : "Detailed View"}
          </button>
          <div className="hidden flex-wrap items-center gap-2 text-sm font-semibold text-foreground/80 sm:flex">
            <span className="subject-pill subject-pill--radical">{subjectTypePluralLabel(SUBJECT_TYPES.radical)}</span>
            <span className="subject-pill subject-pill--kanji">{subjectTypePluralLabel(SUBJECT_TYPES.kanji)}</span>
            <span className="subject-pill subject-pill--vocabulary">{subjectTypePluralLabel(SUBJECT_TYPES.vocabulary)}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {groupedRows.map(([groupKey, label, row]) => {
          const details = itemSpreadDetails[groupKey];
          const isExpanded = expandedGroups[groupKey];
          const hasDetails = details.levels.length > 0;

          return (
            <div key={groupKey} className="overflow-hidden rounded-xl border border-line bg-surface-muted">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.9fr_auto] items-center gap-2 px-3 py-2">
                <p className="text-xl font-semibold text-foreground">{label}</p>
                <span className="subject-pill subject-pill--radical justify-center">{formatNumber(row.radical)}</span>
                <span className="subject-pill subject-pill--kanji justify-center">{formatNumber(row.kanji)}</span>
                <span className="subject-pill subject-pill--vocabulary justify-center">{formatNumber(row.vocabulary)}</span>
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-center text-2xl font-black text-foreground">
                  {formatNumber(row.total)}
                </span>
                <button
                  type="button"
                  onClick={() => toggleExpanded(groupKey)}
                  disabled={!hasDetails}
                  className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-surface px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isExpanded ? "Hide" : "Expand"}
                </button>
              </div>
              {isExpanded ? (
                <div className="border-t border-line/70 bg-surface px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/70">Kanji Levels In {label}</p>
                  <div className="mt-2 space-y-1.5">
                    {details.levels.map((levelRow) => (
                      <div
                        key={`${groupKey}-level-${levelRow.level}`}
                        className="grid grid-cols-[auto_1fr_1fr_1fr_auto] items-center gap-2 rounded-lg border border-line bg-surface-muted px-2 py-1.5"
                      >
                        <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/70">L{levelRow.level}</span>
                        <span className="subject-pill subject-pill--radical justify-center">{formatNumber(levelRow.radical)}</span>
                        <span className="subject-pill subject-pill--kanji justify-center">{formatNumber(levelRow.kanji)}</span>
                        <span className="subject-pill subject-pill--vocabulary justify-center">{formatNumber(levelRow.vocabulary)}</span>
                        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-black text-foreground">
                          {formatNumber(levelRow.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {detailedView ? (
                    <div className="mt-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/70">SRS Stage Breakdown</p>
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {details.stages.map((stageRow) => (
                          <div
                            key={`${groupKey}-stage-${stageRow.label}`}
                            className="rounded-lg border border-line bg-surface-muted px-2 py-1.5"
                          >
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/70">{stageRow.label}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <span className="subject-pill subject-pill--radical">R {formatNumber(stageRow.radical)}</span>
                              <span className="subject-pill subject-pill--kanji">K {formatNumber(stageRow.kanji)}</span>
                              <span className="subject-pill subject-pill--vocabulary">V {formatNumber(stageRow.vocabulary)}</span>
                              <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-black text-foreground">
                                T {formatNumber(stageRow.total)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type LevelProgressTabPanelProps = {
  accountId: string;
  currentWkLevel: number;
  wkLevel: number;
  levelOptions: number[];
  levelProgressByLevel: Record<number, LevelProgressSnapshot>;
  onSelectLevel: (level: number) => void;
  levelRadicalProgress: TypeProgress;
  levelKanjiProgress: TypeProgress;
  levelVocabularyProgress: TypeProgress;
  remainingToLevelUp: number;
  passedLevelUpGate: boolean;
};

export function LevelProgressTabPanel({
  accountId,
  currentWkLevel,
  wkLevel,
  levelOptions,
  levelProgressByLevel,
  onSelectLevel,
  levelRadicalProgress,
  levelKanjiProgress,
  levelVocabularyProgress,
  remainingToLevelUp,
  passedLevelUpGate,
}: LevelProgressTabPanelProps) {
  const levelProgressByType: Record<SubjectType, TypeProgress> = {
    [SUBJECT_TYPES.radical]: levelRadicalProgress,
    [SUBJECT_TYPES.kanji]: levelKanjiProgress,
    [SUBJECT_TYPES.vocabulary]: levelVocabularyProgress,
  };

  const storageKey = `wr:user:${accountId}:level-progress-view`;
  const [viewMode, setViewMode] = useState<"browser" | "last5">(() => {
    if (typeof window === "undefined") {
      return "browser";
    }
    const stored = window.localStorage.getItem(storageKey);
    return stored === "browser" || stored === "last5" ? stored : "browser";
  });
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(storageKey, viewMode);
  }, [storageKey, viewMode]);
  const lastFiveLevels = useMemo(() => {
    const uptoCurrent = levelOptions.filter((level) => level <= currentWkLevel);
    return uptoCurrent.slice(-5).reverse();
  }, [currentWkLevel, levelOptions]);

  return (
    <div className="mt-4" role="tabpanel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-black text-foreground">Level Progress</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => setViewMode("last5")}
              className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.1em] ${
                viewMode === "last5" ? "bg-accent text-white" : "text-foreground hover:bg-surface-muted"
              }`}
            >
              Last 5
            </button>
            <button
              type="button"
              onClick={() => setViewMode("browser")}
              className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.1em] ${
                viewMode === "browser" ? "bg-accent text-white" : "text-foreground hover:bg-surface-muted"
              }`}
            >
              Level Browser
            </button>
          </div>
          {viewMode === "browser" ? (
            <label className="flex items-center gap-2 text-foreground/80">
              <span className="text-sm font-bold uppercase tracking-[0.08em]">Level</span>
              <select
                value={wkLevel}
                onChange={(event) => onSelectLevel(Number(event.target.value))}
                className="h-10 rounded-full border border-line bg-surface px-4 text-lg font-semibold text-foreground"
              >
                {levelOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>
      {viewMode === "browser" ? (
        <>
          <p className="mt-3 text-lg text-foreground/75">Number of items Guru&apos;d in this level.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {DASHBOARD_SUBJECT_TYPES.map((type) => {
              const label = subjectTypePluralLabel(type);
              const progress = levelProgressByType[type];
              const stageCounts: Array<[SrsProgressStatus, number]> = [
                [WK_STATUSES.apprentice, progress.apprentice],
                [WK_STATUSES.guru, progress.guru],
                [WK_STATUSES.master, progress.master],
                [WK_STATUSES.enlightened, progress.enlightened],
                [WK_STATUSES.burned, progress.burned],
                [WK_STATUSES.locked, progress.locked],
              ];
              const visibleStages = stageCounts.filter(([, count]) => count > 0);
              const remainingToGuru = Math.max(0, progress.total - progress.guruOrHigher);

              return (
                <article key={label} className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <div className="flex items-center gap-2 px-4 py-3">
                    <span className={`subject-pill subject-pill--${type}`}>{label}</span>
                  </div>
                  <div className="px-4">
                    <div className="flex h-6 w-full overflow-hidden rounded-full border border-line/60 bg-surface-muted">
                      {progress.total > 0
                        ? visibleStages.map(([stage, count]) => {
                            const widthPercent = (count / progress.total) * 100;

                            return (
                              <div
                                key={stage}
                                className={`relative flex h-full shrink-0 items-center justify-center ${srsSegmentClass(stage)}`}
                                style={{ width: `${widthPercent}%` }}
                                title={`${stageLabel(stage)}: ${formatNumber(count)}`}
                              >
                                {widthPercent >= 16 ? (
                                  <span
                                    className={`px-1 text-[10px] font-black leading-none ${srsSegmentTextClass(stage)}`}
                                  >
                                    {formatNumber(count)}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })
                        : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-foreground/75">
                      {visibleStages.map(([stage, count]) => (
                        <span
                          key={`${stage}-count`}
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 ${srsBadgeClass(stage)}`}
                        >
                          {stageLabel(stage)} {formatNumber(count)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground/80">
                    <div>
                      <p className="text-4xl font-black text-foreground" title={`${progress.percent}% Guru+`}>
                        {formatNumber(progress.guruOrHigher)}/{formatNumber(progress.total)}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">
                        Remaining to Guru+: {formatNumber(remainingToGuru)}
                      </p>
                    </div>
                    <a href="#explorer" className="text-lg font-bold text-foreground/80 hover:text-accent">
                      See all
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-5 rounded-2xl border border-line bg-surface-muted px-4 py-4 text-lg text-foreground/85">
            {passedLevelUpGate
              ? "You have passed this level gate, but there are still items you have not Guru'd yet."
              : `Guru ${formatNumber(remainingToLevelUp)} more kanji to level up.`}
          </div>
        </>
      ) : (
        <div className="mt-4 space-y-3">
          {lastFiveLevels.map((level) => {
            const snapshot = levelProgressByLevel[level];
            if (!snapshot) {
              return null;
            }

            const snapshotProgressByType: Record<SubjectType, TypeProgress> = {
              [SUBJECT_TYPES.radical]: snapshot.radical,
              [SUBJECT_TYPES.kanji]: snapshot.kanji,
              [SUBJECT_TYPES.vocabulary]: snapshot.vocabulary,
            };

            return (
              <article key={`last5-${level}`} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-black uppercase tracking-[0.08em] text-foreground">Level {level}</p>
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">
                    Kanji Guru+: {formatNumber(snapshot.kanji.guruOrHigher)}/{formatNumber(snapshot.kanji.total)}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {DASHBOARD_SUBJECT_TYPES.map((type) => {
                    const label = subjectTypePluralLabel(type);
                    const progress = snapshotProgressByType[type];

                    return (
                    <div key={`${level}-${label}`} className="rounded-xl border border-line bg-surface-muted px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`subject-pill subject-pill--${type}`}>{label}</span>
                        <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/70">
                          {formatNumber(progress.percent)}%
                        </span>
                      </div>
                      <p className="mt-1 text-2xl font-black text-foreground">
                        {formatNumber(progress.guruOrHigher)}/{formatNumber(progress.total)}
                      </p>
                    </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground/75">
                  {snapshot.passedLevelUpGate
                    ? "Level gate passed; remaining items are below Guru+."
                    : `Guru ${formatNumber(snapshot.remainingToLevelUp)} more kanji to level up.`}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SrsLink({
  label,
  shortLabel,
  query,
  value,
}: {
  label: string;
  shortLabel: string;
  query: SrsGroupKey;
  value: number;
}) {
  return (
    <Link
      href={`?srs=${query}#explorer`}
      className="select-none rounded-lg border border-line bg-surface px-1.5 py-1.5 text-center text-[10px] font-semibold text-foreground hover:bg-surface-muted sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm"
    >
      <span className="block"><span className="sm:hidden">{shortLabel}:</span><span className="hidden sm:inline">{label}:</span></span>
      <span className="mt-0.5 block text-xl font-black leading-none sm:text-4xl">{formatNumber(value)}</span>
    </Link>
  );
}
