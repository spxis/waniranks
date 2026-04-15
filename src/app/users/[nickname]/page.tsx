import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";
import { EMPTY_ITEM_SPREAD, isItemSpread } from "@/lib/itemSpread";
import { prisma } from "@/lib/prisma";
import { getUserKanjiIndex } from "@/lib/wanikani";
import ExplorerTabs from "./ExplorerTabs";
import UserDashboardTabs from "./UserDashboardTabs";
import type { LevelProgressSnapshot, TypeProgress } from "./UserDashboardTabs.types";

type PageProps = {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<{ srs?: string; tab?: string }>;
};

type LevelKanjiItem = {
  subjectId: number;
  characters: string;
  meanings: string[];
  wkLevel: number;
  srsStage: number;
  status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
  availableAt: string | null;
  subjectType?: "kanji" | "radical" | "vocabulary";
};

type LevelSnapshotRow = {
  level: number;
  items: unknown;
};

type JlptKanjiRow = {
  kanji: string;
  nLevel: number;
  strokeCount: number | null;
  frequencyRank: number | null;
  schoolGrade: number | null;
  heisigKeyword: string | null;
  unicodeHex: string | null;
  sourceJlpt: number | null;
  primaryMeaning: string | null;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  nanoriReadings: string[];
  notes: string[];
  wordExamples: unknown;
};

export default async function UserDetailPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const viewerEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const { nickname } = await params;
  const userKey = decodeURIComponent(nickname);
  const query = await searchParams;
  const initialTab = query.tab === "jlpt" ? "jlpt" : query.tab === "level" ? "level" : "study";
  const shouldLoadJlptData = initialTab === "jlpt";
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

  const account = await prisma.account.findFirst({
    where: { wkUsername: userKey },
    select: {
      id: true,
      tokenEncrypted: true,
      tokenIv: true,
      tokenTag: true,
      nickname: true,
      wkUsername: true,
      joinedByEmail: true,
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
      lastActivityAt: true,
      lastSyncedAt: true,
    },
  });

  if (!account) {
    notFound();
  }

  const levelKanjiItems = (account.levelKanjiItems ?? []) as LevelKanjiItem[];
  const itemSpread = isItemSpread(account.itemSpread) ? account.itemSpread : EMPTY_ITEM_SPREAD;
  const userKanjiIndex = shouldLoadJlptData
    ? await getUserKanjiIndex(
        decryptToken({
          encrypted: account.tokenEncrypted,
          iv: account.tokenIv,
          tag: account.tokenTag,
        }),
      )
    : [];
  const jlptKanjiRows = shouldLoadJlptData
    ? ((await prisma.jlptKanji.findMany({
        orderBy: [{ nLevel: "asc" }, { kanji: "asc" }],
        select: {
          kanji: true,
          nLevel: true,
          strokeCount: true,
          frequencyRank: true,
          schoolGrade: true,
          heisigKeyword: true,
          unicodeHex: true,
          sourceJlpt: true,
          primaryMeaning: true,
          meanings: true,
          onReadings: true,
          kunReadings: true,
          nanoriReadings: true,
          notes: true,
          wordExamples: true,
        },
      })) as JlptKanjiRow[])
    : [];

  const levelSnapshots = (await prisma.levelSnapshot.findMany({
    where: { accountId: account.id },
    orderBy: { level: "asc" },
    select: {
      level: true,
      items: true,
    },
  })) as LevelSnapshotRow[];

  const rankedAccounts = await prisma.account.findMany({
    orderBy: [{ score: "desc" }, { wkLevel: "desc" }, { reviewCount: "desc" }],
    select: { id: true, nickname: true, wkUsername: true },
  });
  const rankedIndex = rankedAccounts.findIndex((row) => row.id === account.id);
  const globalRank = Math.max(1, rankedIndex + 1);
  const totalPlayers = rankedAccounts.length;
  const rankSlotIndex =
    rankedAccounts.length > 0
      ? Math.min(Math.max(globalRank - 1, 0), rankedAccounts.length - 1)
      : -1;
  const previousRanked =
    rankedAccounts.length > 1
      ? rankedAccounts[(rankSlotIndex - 1 + rankedAccounts.length) % rankedAccounts.length]
      : null;
  const nextRanked =
    rankedAccounts.length > 1
      ? rankedAccounts[(rankSlotIndex + 1) % rankedAccounts.length]
      : null;

  const progressItemsByLevel = new Map<number, LevelKanjiItem[]>();

  for (const row of levelSnapshots) {
    const rawItems = Array.isArray(row.items) ? row.items : [];
    const items = rawItems.filter(
      (item): item is LevelKanjiItem =>
        typeof item === "object" &&
        item !== null &&
        (item as LevelKanjiItem).subjectType !== undefined &&
        ((item as LevelKanjiItem).subjectType === "radical" ||
          (item as LevelKanjiItem).subjectType === "kanji" ||
          (item as LevelKanjiItem).subjectType === "vocabulary"),
    );

    progressItemsByLevel.set(row.level, items);
  }

  if (!progressItemsByLevel.has(account.wkLevel)) {
    const fallbackItems = levelKanjiItems.filter(
      (item) => item.subjectType === "radical" || item.subjectType === "kanji" || item.subjectType === "vocabulary",
    );
    progressItemsByLevel.set(account.wkLevel, fallbackItems);
  }

  function computeTypeProgress(itemsForLevel: LevelKanjiItem[], type: "radical" | "kanji" | "vocabulary"): TypeProgress {
    const items = itemsForLevel.filter((item) => item.subjectType === type);
    const locked = items.filter((item) => item.srsStage <= 0).length;
    const apprentice = items.filter((item) => item.srsStage >= 1 && item.srsStage <= 4).length;
    const guru = items.filter((item) => item.srsStage === 5 || item.srsStage === 6).length;
    const master = items.filter((item) => item.srsStage === 7).length;
    const enlightened = items.filter((item) => item.srsStage === 8).length;
    const burned = items.filter((item) => item.srsStage >= 9).length;
    const guruOrHigher = guru + master + enlightened + burned;
    const total = items.length;

    return {
      guruOrHigher,
      total,
      percent: total === 0 ? 0 : Math.round((guruOrHigher / total) * 100),
      locked,
      apprentice,
      guru,
      master,
      enlightened,
      burned,
    };
  }

  function computeLevelSnapshot(level: number): LevelProgressSnapshot {
    const itemsForLevel = progressItemsByLevel.get(level) ?? [];
    const radical = computeTypeProgress(itemsForLevel, "radical");
    const kanji = computeTypeProgress(itemsForLevel, "kanji");
    const vocabulary = computeTypeProgress(itemsForLevel, "vocabulary");
    const remainingToLevelUp = Math.max(0, Math.ceil(kanji.total * 0.9) - kanji.guruOrHigher);

    return {
      radical,
      kanji,
      vocabulary,
      remainingToLevelUp,
      passedLevelUpGate: kanji.guruOrHigher >= Math.ceil(kanji.total * 0.9),
    };
  }

  const higherStartedLevels = Array.from(progressItemsByLevel.entries())
    .filter(([level, items]) => level > account.wkLevel && items.some((item) => item.srsStage > 0))
    .map(([level]) => level)
    .sort((a, b) => a - b);

  const availableProgressLevels = [
    ...Array.from({ length: Math.max(1, account.wkLevel) }, (_, index) => index + 1),
    ...higherStartedLevels,
  ];

  const levelProgressByLevel = Object.fromEntries(
    availableProgressLevels.map((level) => [level, computeLevelSnapshot(level)]),
  ) as Record<number, LevelProgressSnapshot>;

  const currentLevelProgress = levelProgressByLevel[account.wkLevel] ?? computeLevelSnapshot(account.wkLevel);
  const levelRadicalProgress = currentLevelProgress.radical;
  const levelKanjiProgress = currentLevelProgress.kanji;
  const levelVocabularyProgress = currentLevelProgress.vocabulary;
  const totalLearnedKanji =
    itemSpread.guru.kanji +
    itemSpread.master.kanji +
    itemSpread.enlightened.kanji +
    itemSpread.burned.kanji;

  const remainingToLevelUp = currentLevelProgress.remainingToLevelUp;
  const passedLevelUpGate = currentLevelProgress.passedLevelUpGate;
  const linkedEmail = account.joinedByEmail?.trim().toLowerCase() ?? null;
  const viewerMatchesAccount = Boolean(viewerEmail && linkedEmail && viewerEmail === linkedEmail);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <main className="relative mx-auto w-full max-w-6xl space-y-6">
        <UserDashboardTabs
          accountId={account.id}
          nickname={account.nickname}
          wkUsername={account.wkUsername}
          linkedEmail={account.joinedByEmail}
          viewerMatchesAccount={viewerMatchesAccount}
          lastSyncedAt={account.lastSyncedAt.toISOString()}
          lastActivityAt={account.lastActivityAt ? account.lastActivityAt.toISOString() : null}
          globalRank={globalRank}
          totalPlayers={totalPlayers}
          previousUser={
            previousRanked
              ? {
                  nickname: previousRanked.nickname,
                  wkUsername: previousRanked.wkUsername,
                }
              : null
          }
          nextUser={
            nextRanked
              ? {
                  nickname: nextRanked.nickname,
                  wkUsername: nextRanked.wkUsername,
                }
              : null
          }
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
          availableProgressLevels={availableProgressLevels}
          levelProgressByLevel={levelProgressByLevel}
        />

        <ExplorerTabs
          accountId={account.id}
          maxLevel={account.wkLevel}
          accountPendingReviews={account.pendingReviews}
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
            frequencyRank: row.frequencyRank,
            schoolGrade: row.schoolGrade,
            heisigKeyword: row.heisigKeyword,
            unicodeHex: row.unicodeHex,
            sourceJlpt: row.sourceJlpt,
            primaryMeaning: row.primaryMeaning,
            meanings: row.meanings,
            onReadings: row.onReadings,
            kunReadings: row.kunReadings,
            nanoriReadings: row.nanoriReadings,
            notes: row.notes,
            wordExamples: row.wordExamples,
          }))}
          userKanjiItems={userKanjiIndex}
        />
      </main>
    </div>
  );
}
