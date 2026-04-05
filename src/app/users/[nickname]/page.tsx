import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { refreshDueAccounts } from "@/lib/sync";
import LevelExplorer from "./LevelExplorer";
import UserAdminRefreshButton from "./UserAdminRefreshButton";
import UserProgressPanels from "./UserProgressPanels";

type PageProps = {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<{ srs?: string }>;
};

type LevelKanjiItem = {
  subjectId: number;
  characters: string;
  meanings: string[];
  srsStage: number;
  status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
  availableAt: string | null;
  subjectType?: "kanji" | "radical" | "vocabulary";
};

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

const EMPTY_ITEM_SPREAD: ItemSpread = {
  apprentice: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
  guru: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
  master: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
  enlightened: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
  burned: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
  totals: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
};

function isItemSpread(value: unknown): value is ItemSpread {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys: Array<keyof ItemSpread> = [
    "apprentice",
    "guru",
    "master",
    "enlightened",
    "burned",
    "totals",
  ];

  return keys.every((key) => {
    const row = record[key];
    if (!row || typeof row !== "object") {
      return false;
    }

    const typedRow = row as Record<string, unknown>;
    return (
      typeof typedRow.radical === "number" &&
      typeof typedRow.kanji === "number" &&
      typeof typedRow.vocabulary === "number" &&
      typeof typedRow.total === "number"
    );
  });
}

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

export default async function UserDetailPage({ params, searchParams }: PageProps) {
  const { nickname } = await params;
  const query = await searchParams;
  const allowedSrs = new Set([
    "all",
    "apprentice",
    "guru",
    "master",
    "enlightened",
    "burned",
    "locked",
  ]);
  const initialSrsFilter = allowedSrs.has(query.srs ?? "")
    ? (query.srs as
        | "all"
        | "apprentice"
        | "guru"
        | "master"
        | "enlightened"
        | "burned"
        | "locked")
    : "all";

  await refreshDueAccounts(1);

  const account = await prisma.account.findUnique({
    where: { nickname: decodeURIComponent(nickname) },
    select: {
      id: true,
      nickname: true,
      wkUsername: true,
      wkLevel: true,
      reviewCount: true,
      burnedCount: true,
      pendingReviews: true,
      radicalCount: true,
      vocabularyCount: true,
      apprenticeCount: true,
      guruCount: true,
      masterCount: true,
      enlightenedCount: true,
      levelKanjiTotal: true,
      levelKanjiLearned: true,
      levelKanjiGuruPlus: true,
      levelKanjiLocked: true,
      estimatedHoursRemaining: true,
      levelKanjiItems: true,
      itemSpread: true,
      lastSyncedAt: true,
    },
  });

  if (!account) {
    notFound();
  }

  const levelKanjiItems = (account.levelKanjiItems ?? []) as LevelKanjiItem[];
  const itemSpread = isItemSpread(account.itemSpread) ? account.itemSpread : EMPTY_ITEM_SPREAD;

  const rankedAccounts = await prisma.account.findMany({
    orderBy: [{ score: "desc" }, { wkLevel: "desc" }, { reviewCount: "desc" }],
    select: { id: true },
  });
  const globalRank = Math.max(1, rankedAccounts.findIndex((row) => row.id === account.id) + 1);
  const totalPlayers = rankedAccounts.length;

  const currentLevelItems = levelKanjiItems.filter(
    (item) => item.subjectType === "radical" || item.subjectType === "kanji" || item.subjectType === "vocabulary",
  );

  function typeProgress(type: "radical" | "kanji" | "vocabulary") {
    const items = currentLevelItems.filter((item) => item.subjectType === type);
    const guruOrHigher = items.filter((item) => item.srsStage >= 5).length;

    return {
      guruOrHigher,
      total: items.length,
      percent: items.length === 0 ? 0 : Math.round((guruOrHigher / items.length) * 100),
    };
  }

  const levelRadicalProgress = typeProgress("radical");
  const levelKanjiProgress = typeProgress("kanji");
  const levelVocabularyProgress = typeProgress("vocabulary");
  const totalLearnedKanji =
    itemSpread.guru.kanji +
    itemSpread.master.kanji +
    itemSpread.enlightened.kanji +
    itemSpread.burned.kanji;

  const kanjiGuruGoal = Math.ceil(account.levelKanjiTotal * 0.9);
  const remainingToLevelUp = Math.max(0, kanjiGuruGoal - account.levelKanjiGuruPlus);
  const passedLevelUpGate = account.levelKanjiGuruPlus >= kanjiGuruGoal;

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <main className="relative mx-auto w-full max-w-6xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-surface-muted"
        >
          Back to leaderboard
        </Link>

        <section className="rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.15)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">User detail</p>
              <h1 className="mt-2 text-4xl leading-[0.95] text-foreground sm:text-5xl">{account.nickname}</h1>
              <p className="mt-2 text-sm text-slate-600">@{account.wkUsername}</p>
              <p className="mt-1 inline-flex rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                Global Rank #{globalRank} of {formatNumber(totalPlayers)}
              </p>
            </div>
            <UserAdminRefreshButton accountId={account.id} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <article className="rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Level</p>
              <p className="mt-2 text-4xl font-black text-accent">{account.wkLevel}</p>
            </article>
            <article className="rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Learned Kanji</p>
              <p className="mt-2 text-4xl font-black text-foreground">
                {formatNumber(account.levelKanjiLearned)}
              </p>
              <p className="text-xs text-slate-600">of {formatNumber(account.levelKanjiTotal)} in this level</p>
            </article>
            <article className="rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Remaining (Level)</p>
              <p className="mt-2 text-4xl font-black text-hot">
                {formatNumber(Math.max(0, account.levelKanjiTotal - account.levelKanjiLearned))}
              </p>
              <p className="text-xs text-slate-600">locked: {formatNumber(account.levelKanjiLocked)}</p>
            </article>
            <article className="rounded-2xl border border-kanji/30 bg-kanji/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-kanji">Total Learned</p>
              <p className="mt-2 text-4xl font-black text-kanji">{formatNumber(totalLearnedKanji)}</p>
              <p className="text-xs text-slate-600">all kanji at Guru+</p>
            </article>
            <article className="rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Est. Time Remaining</p>
              <p className="mt-2 text-3xl font-black text-foreground">
                {account.estimatedHoursRemaining === null
                  ? "Unknown"
                  : `${account.estimatedHoursRemaining}h`}
              </p>
              <p className="text-xs text-slate-600">Until 90% level kanji at Guru+</p>
            </article>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
            <Link href={`?srs=apprentice#explorer`} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-muted">
              <span className="block">Apprentice:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(account.apprenticeCount)}</span>
            </Link>
            <Link href={`?srs=guru#explorer`} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-muted">
              <span className="block">Guru:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(account.guruCount)}</span>
            </Link>
            <Link href={`?srs=master#explorer`} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-muted">
              <span className="block">Master:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(account.masterCount)}</span>
            </Link>
            <Link href={`?srs=enlightened#explorer`} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-muted">
              <span className="block">Enlightened:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(account.enlightenedCount)}</span>
            </Link>
            <Link href={`?srs=burned#explorer`} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-muted">
              <span className="block">Burned:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(account.burnedCount)}</span>
            </Link>
            <div className="rounded-xl border border-radical/40 bg-radical/10 px-3 py-2 text-sm font-semibold text-radical">
              <span className="block">Radicals:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(account.radicalCount)}</span>
            </div>
            <div className="rounded-xl border border-kanji/40 bg-kanji/10 px-3 py-2 text-sm font-semibold text-kanji">
              <span className="block">Kanji:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(itemSpread.totals.kanji)}</span>
            </div>
            <div className="rounded-xl border border-vocabulary/40 bg-vocabulary/10 px-3 py-2 text-sm font-semibold text-vocabulary">
              <span className="block">Vocabulary:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(account.vocabularyCount)}</span>
            </div>
          </div>
        </section>

        <UserProgressPanels
          accountId={account.id}
          wkLevel={account.wkLevel}
          itemSpread={itemSpread}
          levelRadicalProgress={levelRadicalProgress}
          levelKanjiProgress={levelKanjiProgress}
          levelVocabularyProgress={levelVocabularyProgress}
          remainingToLevelUp={remainingToLevelUp}
          passedLevelUpGate={passedLevelUpGate}
        />

        <LevelExplorer
          accountId={account.id}
          maxLevel={account.wkLevel}
          initialSnapshot={{
            level: account.wkLevel,
            kanjiTotal: account.levelKanjiTotal,
            kanjiLearned: account.levelKanjiLearned,
            kanjiGuruPlus: account.levelKanjiGuruPlus,
            kanjiLocked: account.levelKanjiLocked,
            estimatedHoursRemaining: account.estimatedHoursRemaining,
            items: levelKanjiItems,
            syncedAt: account.lastSyncedAt.toISOString(),
          }}
          initialSrsFilter={initialSrsFilter}
        />
      </main>
    </div>
  );
}
