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
        <SrsLink label="Apprentice" shortLabel="Appr" query="apprentice" value={apprenticeCount} />
        <SrsLink label="Guru" shortLabel="Guru" query="guru" value={guruCount} />
        <SrsLink label="Master" shortLabel="Mstr" query="master" value={masterCount} />
        <SrsLink label="Enlightened" shortLabel="Enl" query="enlightened" value={enlightenedCount} />
        <SrsLink label="Burned" shortLabel="Burn" query="burned" value={burnedCount} />
        <div className="rounded-lg border border-radical/40 bg-radical/10 px-1.5 py-1.5 text-center text-[10px] font-semibold text-radical sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
          <span className="block"><span className="sm:hidden">Rad:</span><span className="hidden sm:inline">{subjectTypePluralLabel("radical")}:</span></span>
          <span className="mt-0.5 block text-xl font-black leading-none sm:text-4xl">{formatNumber(radicalCount)}</span>
        </div>
        <div className="rounded-lg border border-kanji/40 bg-kanji/10 px-1.5 py-1.5 text-center text-[10px] font-semibold text-kanji sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
          <span className="block"><span className="sm:hidden">Kan:</span><span className="hidden sm:inline">{subjectTypePluralLabel("kanji")}:</span></span>
          <span className="mt-0.5 block text-xl font-black leading-none sm:text-4xl">{formatNumber(totalKanjiCount)}</span>
        </div>
        <div className="rounded-lg border border-vocabulary/40 bg-vocabulary/10 px-1.5 py-1.5 text-center text-[10px] font-semibold text-vocabulary sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
          <span className="block"><span className="sm:hidden">Voc:</span><span className="hidden sm:inline">{subjectTypePluralLabel("vocabulary")}:</span></span>
          <span className="mt-0.5 block text-xl font-black leading-none sm:text-4xl">{formatNumber(vocabularyCount)}</span>
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
  levelOptions: number[];
  onSelectLevel: (level: number) => void;
  levelRadicalProgress: TypeProgress;
  levelKanjiProgress: TypeProgress;
  levelVocabularyProgress: TypeProgress;
  remainingToLevelUp: number;
  passedLevelUpGate: boolean;
};

export function LevelProgressTabPanel({
  wkLevel,
  levelOptions,
  onSelectLevel,
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
      </div>
      <p className="mt-3 text-lg text-foreground/75">Number of items Guru&apos;d in this level.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {([
          [subjectTypePluralLabel("radical"), "radical", levelRadicalProgress],
          [subjectTypePluralLabel("kanji"), "kanji", levelKanjiProgress],
          [subjectTypePluralLabel("vocabulary"), "vocabulary", levelVocabularyProgress],
        ] as const).map(([label, type, progress]) => {
          const stageCounts = [
            ["apprentice", progress.apprentice],
            ["guru", progress.guru],
            ["master", progress.master],
            ["enlightened", progress.enlightened],
            ["burned", progress.burned],
            ["locked", progress.locked],
          ] as const;
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
    </div>
  );
}

function srsSegmentClass(stage: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned"): string {
  if (stage === "locked") return "bg-foreground/15";
  if (stage === "apprentice") return "bg-hot";
  if (stage === "guru") return "bg-accent";
  if (stage === "master") return "bg-sky-500";
  if (stage === "enlightened") return "bg-amber-500";
  return "bg-emerald-500";
}

function srsSegmentTextClass(stage: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned"): string {
  if (stage === "enlightened") return "text-slate-900";
  if (stage === "locked") return "text-slate-900";
  return "text-white";
}

function srsBadgeClass(stage: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned"): string {
  if (stage === "apprentice") return "border-hot/40 bg-hot/10 text-hot";
  if (stage === "guru") return "border-accent/40 bg-accent/10 text-accent";
  if (stage === "master") return "border-sky-500/40 bg-sky-500/10 text-sky-700";
  if (stage === "enlightened") return "border-amber-500/40 bg-amber-500/10 text-amber-800";
  if (stage === "burned") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800";
  return "border-foreground/30 bg-foreground/10 text-foreground";
}

function stageLabel(stage: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned"): string {
  if (stage === "locked") return "Lock";
  if (stage === "apprentice") return "Appr";
  if (stage === "guru") return "Guru";
  if (stage === "master") return "Mast";
  if (stage === "enlightened") return "Enli";
  if (stage === "burned") return "Burn";
  return "Lock";
}

function SrsLink({ label, shortLabel, query, value }: { label: string; shortLabel: string; query: string; value: number }) {
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

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}
