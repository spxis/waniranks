import { notFound } from "next/navigation";

import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { refreshDueAccounts } from "@/lib/sync";
import { getUserKanjiIndex } from "@/lib/wanikani";
import ExplorerTabs from "./ExplorerTabs";
import UserDashboardTabs from "./UserDashboardTabs";

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

type JlptKanjiRow = {
  kanji: string;
  nLevel: number;
  strokeCount: number | null;
  primaryMeaning: string | null;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  nanoriReadings: string[];
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
      tokenEncrypted: true,
      tokenIv: true,
      tokenTag: true,
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
  const token = decryptToken({
    encrypted: account.tokenEncrypted,
    iv: account.tokenIv,
    tag: account.tokenTag,
  });
  const userKanjiIndex = await getUserKanjiIndex(token);
  const jlptKanjiRows = await prisma.jlptKanji.findMany({
    orderBy: [{ nLevel: "asc" }, { kanji: "asc" }],
    select: {
      kanji: true,
      nLevel: true,
      strokeCount: true,
      primaryMeaning: true,
      meanings: true,
      onReadings: true,
      kunReadings: true,
      nanoriReadings: true,
    },
  }) as JlptKanjiRow[];

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
        <UserDashboardTabs
          accountId={account.id}
          nickname={account.nickname}
          wkUsername={account.wkUsername}
          globalRank={globalRank}
          totalPlayers={totalPlayers}
          wkLevel={account.wkLevel}
          levelKanjiLearned={account.levelKanjiLearned}
          levelKanjiTotal={account.levelKanjiTotal}
          levelKanjiLocked={account.levelKanjiLocked}
          totalLearnedKanji={totalLearnedKanji}
          estimatedHoursRemaining={account.estimatedHoursRemaining}
          apprenticeCount={account.apprenticeCount}
          guruCount={account.guruCount}
          masterCount={account.masterCount}
          enlightenedCount={account.enlightenedCount}
          burnedCount={account.burnedCount}
          radicalCount={account.radicalCount}
          totalKanjiCount={itemSpread.totals.kanji}
          vocabularyCount={account.vocabularyCount}
          itemSpread={itemSpread}
          levelRadicalProgress={levelRadicalProgress}
          levelKanjiProgress={levelKanjiProgress}
          levelVocabularyProgress={levelVocabularyProgress}
          remainingToLevelUp={remainingToLevelUp}
          passedLevelUpGate={passedLevelUpGate}
        />

        <ExplorerTabs
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
          jlptItems={jlptKanjiRows.map((row) => ({
            kanji: row.kanji,
            nLevel: row.nLevel,
            strokeCount: row.strokeCount,
            primaryMeaning: row.primaryMeaning,
            meanings: row.meanings,
            onReadings: row.onReadings,
            kunReadings: row.kunReadings,
            nanoriReadings: row.nanoriReadings,
          }))}
          userKanjiItems={userKanjiIndex}
        />
      </main>
    </div>
  );
}
