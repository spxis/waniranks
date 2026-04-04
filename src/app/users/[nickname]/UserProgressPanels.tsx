"use client";

import { useEffect, useState } from "react";

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
};

type TypeProgress = {
  guruOrHigher: number;
  total: number;
  percent: number;
};

type Props = {
  accountId: string;
  wkLevel: number;
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

export default function UserProgressPanels({
  accountId,
  wkLevel,
  itemSpread,
  levelRadicalProgress,
  levelKanjiProgress,
  levelVocabularyProgress,
  remainingToLevelUp,
  passedLevelUpGate,
}: Props) {
  const storagePrefix = `wr:user:${accountId}`;
  const [showItemSpread, setShowItemSpread] = useState(true);
  const [showLevelProgress, setShowLevelProgress] = useState(true);

  useEffect(() => {
    try {
      const itemSpreadStored = window.localStorage.getItem(`${storagePrefix}:item-spread-open`);
      const levelProgressStored = window.localStorage.getItem(`${storagePrefix}:level-progress-open`);

      if (itemSpreadStored === "0") {
        setShowItemSpread(false);
      }

      if (levelProgressStored === "0") {
        setShowLevelProgress(false);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [storagePrefix]);

  function setPersistedState(key: string, value: boolean, setter: (next: boolean) => void) {
    setter(value);
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }

  return (
    <>
      <section className="rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.08)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl font-black text-foreground">Item Spread</h2>
          <div className="flex items-center gap-2">
            <div className="hidden flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 sm:flex">
              <span className="subject-pill subject-pill--radical">Radicals</span>
              <span className="subject-pill subject-pill--kanji">Kanji</span>
              <span className="subject-pill subject-pill--vocabulary">Vocabulary</span>
            </div>
            <button
              type="button"
              onClick={() =>
                setPersistedState(
                  `${storagePrefix}:item-spread-open`,
                  !showItemSpread,
                  setShowItemSpread,
                )
              }
              className="rounded-full border border-line bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-700"
            >
              {showItemSpread ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {showItemSpread ? (
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
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.08)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl font-black text-foreground">Level Progress</h2>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold text-slate-700">Level {wkLevel}</p>
            <button
              type="button"
              onClick={() =>
                setPersistedState(
                  `${storagePrefix}:level-progress-open`,
                  !showLevelProgress,
                  setShowLevelProgress,
                )
              }
              className="rounded-full border border-line bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-700"
            >
              {showLevelProgress ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {showLevelProgress ? (
          <>
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
          </>
        ) : null}
      </section>
    </>
  );
}
