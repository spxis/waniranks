"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import UserAdminRefreshButton from "./UserAdminRefreshButton";

type ItemSpreadRow = {
  radical: number;
  kanji: number;
  vocabulary: number;
  total: number;
};

type ItemSpread = {
  apprentice: ItemSpreadRow;
  guru: ItemSpreadRow;
  master: ItemSpreadRow;
  enlightened: ItemSpreadRow;
  burned: ItemSpreadRow;
  totals: ItemSpreadRow;
};

type TypeProgress = {
  guruOrHigher: number;
  total: number;
  percent: number;
};

type TabId = "main" | "item-spread" | "level-progress";

type Props = {
  accountId: string;
  nickname: string;
  wkUsername: string;
  globalRank: number;
  totalPlayers: number;
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
  itemSpread: ItemSpread;
  levelRadicalProgress: TypeProgress;
  levelKanjiProgress: TypeProgress;
  levelVocabularyProgress: TypeProgress;
  remainingToLevelUp: number;
  passedLevelUpGate: boolean;
};

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

export default function UserDashboardTabs({
  accountId,
  nickname,
  wkUsername,
  globalRank,
  totalPlayers,
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
  itemSpread,
  levelRadicalProgress,
  levelKanjiProgress,
  levelVocabularyProgress,
  remainingToLevelUp,
  passedLevelUpGate,
}: Props) {
  const tabStorageKey = `wr:user:${accountId}:dashboard-tab`;
  const [activeTab, setActiveTab] = useState<TabId>("main");
  const actionButtonBaseClass =
    "inline-flex h-10 min-w-[9.5rem] items-center justify-center rounded-full border px-4 text-xs font-bold uppercase tracking-[0.1em] transition disabled:cursor-not-allowed disabled:opacity-60";

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(tabStorageKey);
      if (stored === "main" || stored === "item-spread" || stored === "level-progress") {
        setActiveTab(stored);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [tabStorageKey]);

  function switchTab(next: TabId) {
    setActiveTab(next);
    try {
      window.localStorage.setItem(tabStorageKey, next);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }

  function tabClass(tab: TabId): string {
    const active = activeTab === tab;
    return active
      ? `${actionButtonBaseClass} border-accent bg-accent text-white`
      : `${actionButtonBaseClass} border-line bg-white text-slate-700 hover:bg-surface-muted`;
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.15)] sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">User detail</p>
            <Link
              href="/"
              className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-white px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-700 transition hover:bg-surface-muted"
            >
              Leaderboard
            </Link>
          </div>
          <h1 className="mt-2 text-4xl leading-[0.95] text-foreground sm:text-5xl">{nickname}</h1>
          <p className="mt-2 text-sm text-slate-600">@{wkUsername}</p>
          <p className="mt-1 inline-flex rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
            Global Rank #{globalRank} of {formatNumber(totalPlayers)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="User dashboard tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "main"}
              className={tabClass("main")}
              onClick={() => switchTab("main")}
            >
              Main Data
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "item-spread"}
              className={tabClass("item-spread")}
              onClick={() => switchTab("item-spread")}
            >
              Item Spread
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "level-progress"}
              className={tabClass("level-progress")}
              onClick={() => switchTab("level-progress")}
            >
              Level Progress
            </button>
          </div>
          <span className="hidden h-8 w-px bg-line lg:inline-block" aria-hidden="true" />
          <UserAdminRefreshButton
            accountId={accountId}
            label="Refresh"
            showMessage={false}
            buttonClassName={`${actionButtonBaseClass} border-line bg-white text-slate-800 hover:bg-surface-muted`}
          />
        </div>
      </div>

      {activeTab === "main" ? (
        <div className="mt-4" role="tabpanel">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <article className="rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Level</p>
              <p className="mt-2 text-4xl font-black text-accent">{wkLevel}</p>
            </article>
            <article className="rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Learned Kanji</p>
              <p className="mt-2 text-4xl font-black text-foreground">{formatNumber(levelKanjiLearned)}</p>
              <p className="text-xs text-slate-600">of {formatNumber(levelKanjiTotal)} in this level</p>
            </article>
            <article className="rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Remaining (Level)</p>
              <p className="mt-2 text-4xl font-black text-hot">{formatNumber(Math.max(0, levelKanjiTotal - levelKanjiLearned))}</p>
              <p className="text-xs text-slate-600">locked: {formatNumber(levelKanjiLocked)}</p>
            </article>
            <article className="rounded-2xl border border-kanji/30 bg-kanji/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-kanji">Total Learned</p>
              <p className="mt-2 text-4xl font-black text-kanji">{formatNumber(totalLearnedKanji)}</p>
              <p className="text-xs text-slate-600">all kanji at Guru+</p>
            </article>
            <article className="rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Est. Time Remaining</p>
              <p className="mt-2 text-3xl font-black text-foreground">
                {estimatedHoursRemaining === null ? "Unknown" : `${estimatedHoursRemaining}h`}
              </p>
              <p className="text-xs text-slate-600">Until 90% level kanji at Guru+</p>
            </article>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
            <Link href="?srs=apprentice#explorer" className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-muted">
              <span className="block">Apprentice:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(apprenticeCount)}</span>
            </Link>
            <Link href="?srs=guru#explorer" className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-muted">
              <span className="block">Guru:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(guruCount)}</span>
            </Link>
            <Link href="?srs=master#explorer" className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-muted">
              <span className="block">Master:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(masterCount)}</span>
            </Link>
            <Link href="?srs=enlightened#explorer" className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-muted">
              <span className="block">Enlightened:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(enlightenedCount)}</span>
            </Link>
            <Link href="?srs=burned#explorer" className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-muted">
              <span className="block">Burned:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(burnedCount)}</span>
            </Link>
            <div className="rounded-xl border border-radical/40 bg-radical/10 px-3 py-2 text-sm font-semibold text-radical">
              <span className="block">Radicals:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(radicalCount)}</span>
            </div>
            <div className="rounded-xl border border-kanji/40 bg-kanji/10 px-3 py-2 text-sm font-semibold text-kanji">
              <span className="block">Kanji:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(totalKanjiCount)}</span>
            </div>
            <div className="rounded-xl border border-vocabulary/40 bg-vocabulary/10 px-3 py-2 text-sm font-semibold text-vocabulary">
              <span className="block">Vocabulary:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(vocabularyCount)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "item-spread" ? (
        <div className="mt-4" role="tabpanel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black text-foreground">Item Spread</h2>
            <div className="hidden flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 sm:flex">
              <span className="subject-pill subject-pill--radical">Radicals</span>
              <span className="subject-pill subject-pill--kanji">Kanji</span>
              <span className="subject-pill subject-pill--vocabulary">Vocabulary</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {([
              ["Apprentice", itemSpread.apprentice],
              ["Guru", itemSpread.guru],
              ["Master", itemSpread.master],
              ["Enlightened", itemSpread.enlightened],
              ["Burned", itemSpread.burned],
            ] as const).map(([label, row]) => (
              <div
                key={label}
                className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.9fr] items-center gap-2 rounded-xl border border-line bg-surface-muted px-3 py-2"
              >
                <p className="text-xl font-semibold text-slate-800">{label}</p>
                <span className="subject-pill subject-pill--radical justify-center">{formatNumber(row.radical)}</span>
                <span className="subject-pill subject-pill--kanji justify-center">{formatNumber(row.kanji)}</span>
                <span className="subject-pill subject-pill--vocabulary justify-center">{formatNumber(row.vocabulary)}</span>
                <span className="rounded-full border border-line bg-white px-3 py-1 text-center text-2xl font-black text-foreground">
                  {formatNumber(row.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "level-progress" ? (
        <div className="mt-4" role="tabpanel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black text-foreground">Level Progress</h2>
            <p className="text-2xl font-semibold text-slate-700">Level {wkLevel}</p>
          </div>

          <p className="mt-3 text-lg text-slate-700">Number of items Guru&apos;d in this level.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {([
              ["Radicals", "radical", levelRadicalProgress],
              ["Kanji", "kanji", levelKanjiProgress],
              ["Vocabulary", "vocabulary", levelVocabularyProgress],
            ] as const).map(([label, type, progress]) => (
              <article key={label} className="overflow-hidden rounded-2xl border border-line bg-white">
                <div className="flex items-center gap-2 px-4 py-3">
                  <span className={`subject-pill subject-pill--${type}`}>{label}</span>
                </div>
                <div className="h-2 bg-slate-200">
                  <div
                    className={`h-full ${
                      type === "radical"
                        ? "bg-radical"
                        : type === "kanji"
                          ? "bg-kanji"
                          : "bg-vocabulary"
                    }`}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700">
                  <p className="text-4xl font-black text-foreground">
                    {formatNumber(progress.guruOrHigher)}/{formatNumber(progress.total)}
                  </p>
                  <a href="#explorer" className="text-lg font-bold text-slate-700 hover:text-accent">
                    See all
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-surface-muted px-4 py-4 text-lg text-slate-800">
            {passedLevelUpGate
              ? "You have passed this level gate, but there are still items you have not Guru'd yet."
              : `Guru ${formatNumber(remainingToLevelUp)} more kanji to level up.`}
          </div>
        </div>
      ) : null}
    </section>
  );
}
