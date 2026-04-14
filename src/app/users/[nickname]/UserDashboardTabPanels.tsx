import Link from "next/link";

import { subjectTypePluralLabel } from "./shared/subjectTypeLabels";
import type { ItemSpread, TypeProgress } from "./UserDashboardTabs.types";

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
  return (
    <div className="mt-4" role="tabpanel">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <article className="rounded-2xl border border-line bg-surface-muted p-3 text-center sm:p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Level</p>
          <p className="mt-2 text-3xl font-black text-accent sm:text-4xl">{formatNumber(wkLevel)}</p>
        </article>
        <article className="rounded-2xl border border-line bg-surface-muted p-3 text-center sm:p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Learned Kanji</p>
          <p className="mt-2 text-3xl font-black text-foreground sm:text-4xl">{formatNumber(levelKanjiLearned)}</p>
          <p className="text-xs text-foreground/65">of {formatNumber(levelKanjiTotal)} in this level</p>
        </article>
        <article className="rounded-2xl border border-line bg-surface-muted p-3 text-center sm:p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Remaining (Level)</p>
          <p className="mt-2 text-3xl font-black text-hot sm:text-4xl">
            {formatNumber(Math.max(0, levelKanjiTotal - levelKanjiLearned))}
          </p>
          <p className="text-xs text-foreground/65">locked: {formatNumber(levelKanjiLocked)}</p>
        </article>
        <article className="rounded-2xl border border-kanji/30 bg-kanji/10 p-3 text-center sm:p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-kanji">Total Learned</p>
          <p className="mt-2 text-3xl font-black text-kanji sm:text-4xl">{formatNumber(totalLearnedKanji)}</p>
          <p className="text-xs text-foreground/65">all kanji at Guru+</p>
        </article>
        <article className="col-span-2 rounded-2xl border border-line bg-surface-muted p-3 text-center sm:col-span-1 sm:p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Est. Time Remaining</p>
          <p className="mt-2 text-2xl font-black text-foreground sm:text-3xl">
            {estimatedHoursRemaining === null ? "Unknown" : `${estimatedHoursRemaining}h`}
          </p>
          <p className="text-xs text-foreground/65">Until 90% level kanji at Guru+</p>
        </article>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <SrsLink label="Apprentice" query="apprentice" value={apprenticeCount} />
        <SrsLink label="Guru" query="guru" value={guruCount} />
        <SrsLink label="Master" query="master" value={masterCount} />
        <SrsLink label="Enlightened" query="enlightened" value={enlightenedCount} />
        <SrsLink label="Burned" query="burned" value={burnedCount} />
        <div className="rounded-xl border border-radical/40 bg-radical/10 px-3 py-2 text-center text-sm font-semibold text-radical">
          <span className="block">{subjectTypePluralLabel("radical")}:</span>
          <span className="mt-0.5 block text-4xl leading-none">{formatNumber(radicalCount)}</span>
        </div>
        <div className="rounded-xl border border-kanji/40 bg-kanji/10 px-3 py-2 text-center text-sm font-semibold text-kanji">
          <span className="block">{subjectTypePluralLabel("kanji")}:</span>
          <span className="mt-0.5 block text-4xl leading-none">{formatNumber(totalKanjiCount)}</span>
        </div>
        <div className="rounded-xl border border-vocabulary/40 bg-vocabulary/10 px-3 py-2 text-center text-sm font-semibold text-vocabulary">
          <span className="block">{subjectTypePluralLabel("vocabulary")}:</span>
          <span className="mt-0.5 block text-4xl leading-none">{formatNumber(vocabularyCount)}</span>
        </div>
      </div>
    </div>
  );
}

type ItemSpreadTabPanelProps = {
  itemSpread: ItemSpread;
};

export function ItemSpreadTabPanel({ itemSpread }: ItemSpreadTabPanelProps) {
  return (
    <div className="mt-4" role="tabpanel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-black text-foreground">Item Spread</h2>
        <div className="hidden flex-wrap items-center gap-2 text-sm font-semibold text-foreground/80 sm:flex">
          <span className="subject-pill subject-pill--radical">{subjectTypePluralLabel("radical")}</span>
          <span className="subject-pill subject-pill--kanji">{subjectTypePluralLabel("kanji")}</span>
          <span className="subject-pill subject-pill--vocabulary">{subjectTypePluralLabel("vocabulary")}</span>
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
            <p className="text-xl font-semibold text-foreground">{label}</p>
            <span className="subject-pill subject-pill--radical justify-center">{formatNumber(row.radical)}</span>
            <span className="subject-pill subject-pill--kanji justify-center">{formatNumber(row.kanji)}</span>
            <span className="subject-pill subject-pill--vocabulary justify-center">{formatNumber(row.vocabulary)}</span>
            <span className="rounded-full border border-line bg-surface px-3 py-1 text-center text-2xl font-black text-foreground">
              {formatNumber(row.total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type LevelProgressTabPanelProps = {
  wkLevel: number;
  levelRadicalProgress: TypeProgress;
  levelKanjiProgress: TypeProgress;
  levelVocabularyProgress: TypeProgress;
  remainingToLevelUp: number;
  passedLevelUpGate: boolean;
};

export function LevelProgressTabPanel({
  wkLevel,
  levelRadicalProgress,
  levelKanjiProgress,
  levelVocabularyProgress,
  remainingToLevelUp,
  passedLevelUpGate,
}: LevelProgressTabPanelProps) {
  return (
    <div className="mt-4" role="tabpanel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-black text-foreground">Level Progress</h2>
        <p className="text-2xl font-semibold text-foreground/80">Level {wkLevel}</p>
      </div>
      <p className="mt-3 text-lg text-foreground/75">Number of items Guru&apos;d in this level.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {([
          [subjectTypePluralLabel("radical"), "radical", levelRadicalProgress],
          [subjectTypePluralLabel("kanji"), "kanji", levelKanjiProgress],
          [subjectTypePluralLabel("vocabulary"), "vocabulary", levelVocabularyProgress],
        ] as const).map(([label, type, progress]) => (
          <article key={label} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex items-center gap-2 px-4 py-3">
              <span className={`subject-pill subject-pill--${type}`}>{label}</span>
            </div>
            <div className="h-2 bg-surface-muted">
              <div
                className={`h-full ${
                  type === "radical" ? "bg-radical" : type === "kanji" ? "bg-kanji" : "bg-vocabulary"
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground/80">
              <p className="text-4xl font-black text-foreground">
                {formatNumber(progress.guruOrHigher)}/{formatNumber(progress.total)}
              </p>
              <a href="#explorer" className="text-lg font-bold text-foreground/80 hover:text-accent">
                See all
              </a>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-line bg-surface-muted px-4 py-4 text-lg text-foreground/85">
        {passedLevelUpGate
          ? "You have passed this level gate, but there are still items you have not Guru'd yet."
          : `Guru ${formatNumber(remainingToLevelUp)} more kanji to level up.`}
      </div>
    </div>
  );
}

function SrsLink({ label, query, value }: { label: string; query: string; value: number }) {
  return (
    <Link
      href={`?srs=${query}#explorer`}
      className="select-none rounded-xl border border-line bg-surface px-3 py-2 text-center text-sm font-semibold text-foreground hover:bg-surface-muted"
    >
      <span className="block">{label}:</span>
      <span className="mt-0.5 block text-3xl leading-none sm:text-4xl">{formatNumber(value)}</span>
    </Link>
  );
}

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}
