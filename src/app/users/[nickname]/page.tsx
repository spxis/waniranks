import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";
import { EMPTY_ITEM_SPREAD, isItemSpread } from "@/lib/itemSpread";
import { prisma } from "@/lib/prisma";
import { getUserKanjiIndex } from "@/lib/wanikani";
import ExplorerTabs from "./ExplorerTabs";
import UserDashboardTabs from "./UserDashboardTabs";

type PageProps = {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<{ srs?: string; tab?: string }>;
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

  const rankedAccounts = await prisma.account.findMany({
    orderBy: [{ score: "desc" }, { wkLevel: "desc" }, { reviewCount: "desc" }],
    select: { id: true, nickname: true, wkUsername: true },
  });
  const rankedIndex = rankedAccounts.findIndex((row) => row.id === account.id);
  const safeRankedIndex = rankedAccounts.length > 0 ? (rankedIndex >= 0 ? rankedIndex : 0) : -1;
  const globalRank = Math.max(1, rankedIndex + 1);
  const totalPlayers = rankedAccounts.length;
  const previousRanked =
    rankedAccounts.length > 1
      ? rankedAccounts[(safeRankedIndex - 1 + rankedAccounts.length) % rankedAccounts.length]
      : null;
  const nextRanked =
    rankedAccounts.length > 1
      ? rankedAccounts[(safeRankedIndex + 1) % rankedAccounts.length]
      : null;

  const currentLevelItems = levelKanjiItems.filter(
    (item) => item.subjectType === "radical" || item.subjectType === "kanji" || item.subjectType === "vocabulary",
  );

  function typeProgress(type: "radical" | "kanji" | "vocabulary") {
    const items = currentLevelItems.filter((item) => item.subjectType === type);
    const unlockedItems = items.filter((item) => item.srsStage > 0);
    const guruOrHigher = unlockedItems.filter((item) => item.srsStage >= 5).length;

    return {
      guruOrHigher,
      total: unlockedItems.length,
      percent: unlockedItems.length === 0 ? 0 : Math.round((guruOrHigher / unlockedItems.length) * 100),
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
