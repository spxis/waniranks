import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, isAdminEmail } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";
import { EMPTY_ITEM_SPREAD, isItemSpread } from "@/lib/itemSpread";
import { prisma } from "@/lib/prisma";
import { getUserKanjiIndex } from "@/lib/wanikani";
import ExplorerTabs from "./ExplorerTabs";
import UserReadPanel from "./UserReadPanel";
import UserDashboardTabs from "./UserDashboardTabs";
import {
  LEARNED_SRS_GROUPS,
  WK_STATUSES,
  isSubjectType,
  type WkStatus,
  type SubjectType,
} from "@/lib/domainConstants";
import {
  getNewsDevSampleUrls,
  resolveInitialDashboardTab,
  resolveInitialReadTab,
  resolveInitialSrsFilter,
  resolveInitialStudyFilters,
} from "./userReadConfig";
import { canViewUserPage, resolveViewerMenuInfo } from "./userPageAuth";
import type { ItemSpreadGroupDetails, LevelProgressSnapshot, SrsGroupKey, TypeProgress } from "./UserDashboardTabs.types";
import type { JlptKanjiRow } from "@/lib/jlptTypes";

type PageProps = {
  params: Promise<{ nickname: string }>;
  searchParams: Promise<{ srs?: string; tab?: string; dashboard?: string; read?: string; studyMode?: string; mode?: string }>;
};

type LevelKanjiItem = {
  subjectId: number;
  characters: string;
  meanings: string[];
  wkLevel: number;
  srsStage: number;
  status: WkStatus;
  availableAt: string | null;
  subjectType?: SubjectType;
};

type LevelSnapshotRow = {
  level: number;
  items: unknown;
};

export default async function UserDetailPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const viewerEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const viewerMenuInfo = await resolveViewerMenuInfo({
    viewerEmail,
    sessionName: session?.user?.name?.trim() ?? null,
  });
  const { nickname } = await params;
  const userKey = decodeURIComponent(nickname);
  const query = await searchParams;
  const initialTab = query.tab === "jlpt" ? "jlpt" : query.tab === "level" ? "level" : "study";
  const shouldLoadJlptData = initialTab === "jlpt";
  const initialSrsFilter = resolveInitialSrsFilter(query);
  const initialDashboardTab = resolveInitialDashboardTab(query);
  const initialReadTab = resolveInitialReadTab(query);
  const initialQueueMode = query.mode === "lesson" ? "lesson" : query.mode === "review" ? "review" : null;
  const initialStudyMode = query.studyMode === "on" || query.studyMode === "1" ? true : query.studyMode === "off" || query.studyMode === "0" ? false : null;
  const initialStudyFilters = resolveInitialStudyFilters(query);

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

  const canViewThisPage = canViewUserPage({
    viewerEmail,
    viewerMenuInfo,
    targetWkUsername: account.wkUsername,
  });
  if (!canViewThisPage) {
    redirect("/join?access=denied");
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

  const createEmptyItemSpreadDetails = (): ItemSpreadGroupDetails => ({
    [WK_STATUSES.apprentice]: { levels: [], stages: [] },
    [WK_STATUSES.guru]: { levels: [], stages: [] },
    [WK_STATUSES.master]: { levels: [], stages: [] },
    [WK_STATUSES.enlightened]: { levels: [], stages: [] },
    [WK_STATUSES.burned]: { levels: [], stages: [] },
  });

  const itemSpreadDetails: ItemSpreadGroupDetails = createEmptyItemSpreadDetails();

  const groupByStage = (srsStage: number): { group: SrsGroupKey; label: string } | null => {
    if (srsStage >= 1 && srsStage <= 4) return { group: WK_STATUSES.apprentice, label: `SRS ${srsStage}` };
    if (srsStage === 5) return { group: WK_STATUSES.guru, label: "SRS 5" };
    if (srsStage === 6) return { group: WK_STATUSES.guru, label: "SRS 6" };
    if (srsStage === 7) return { group: WK_STATUSES.master, label: "SRS 7" };
    if (srsStage === 8) return { group: WK_STATUSES.enlightened, label: "SRS 8" };
    if (srsStage >= 9) return { group: WK_STATUSES.burned, label: "SRS 9+" };
    return null;
  };

  for (const [level, items] of Array.from(progressItemsByLevel.entries()).sort((a, b) => b[0] - a[0])) {
    const stageTotalsByGroup = Object.fromEntries(
      LEARNED_SRS_GROUPS.map((group) => [group, new Map<string, { radical: number; kanji: number; vocabulary: number; total: number }>()]),
    ) as Record<SrsGroupKey, Map<string, { radical: number; kanji: number; vocabulary: number; total: number }>>;
    const levelTotalsByGroup = Object.fromEntries(
      LEARNED_SRS_GROUPS.map((group) => [group, { radical: 0, kanji: 0, vocabulary: 0, total: 0 }]),
    ) as Record<SrsGroupKey, { radical: number; kanji: number; vocabulary: number; total: number }>;

    for (const item of items) {
      const bucket = groupByStage(item.srsStage);
      if (!bucket) {
        continue;
      }

      const subjectType = item.subjectType;
      if (!isSubjectType(subjectType)) {
        continue;
      }

      const groupTotals = levelTotalsByGroup[bucket.group];
      groupTotals[subjectType] += 1;
      groupTotals.total += 1;

      const stageMap = stageTotalsByGroup[bucket.group];
      const stageTotals = stageMap.get(bucket.label) ?? { radical: 0, kanji: 0, vocabulary: 0, total: 0 };
      stageTotals[subjectType] += 1;
      stageTotals.total += 1;
      stageMap.set(bucket.label, stageTotals);
    }

    (Object.keys(levelTotalsByGroup) as SrsGroupKey[]).forEach((groupKey) => {
      const totals = levelTotalsByGroup[groupKey];
      if (totals.total <= 0) {
        return;
      }

      itemSpreadDetails[groupKey].levels.push({
        level,
        radical: totals.radical,
        kanji: totals.kanji,
        vocabulary: totals.vocabulary,
        total: totals.total,
      });

      const stageRows = Array.from(stageTotalsByGroup[groupKey].entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, counts]) => ({
          label,
          radical: counts.radical,
          kanji: counts.kanji,
          vocabulary: counts.vocabulary,
          total: counts.total,
        }));

      for (const row of stageRows) {
        const existing = itemSpreadDetails[groupKey].stages.find((stage) => stage.label === row.label);
        if (existing) {
          existing.radical += row.radical;
          existing.kanji += row.kanji;
          existing.vocabulary += row.vocabulary;
          existing.total += row.total;
        } else {
          itemSpreadDetails[groupKey].stages.push(row);
        }
      }
    });
  }

  (Object.keys(itemSpreadDetails) as SrsGroupKey[]).forEach((groupKey) => {
    itemSpreadDetails[groupKey].stages.sort((a, b) => a.label.localeCompare(b.label));
  });

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
    <div className="relative min-h-screen overflow-hidden px-2 py-3 sm:px-6 sm:py-8 lg:px-8">
      <main className="relative mx-auto w-full max-w-6xl space-y-3 sm:space-y-6">
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
          itemSpreadDetails={itemSpreadDetails}
          levelRadicalProgress={levelRadicalProgress}
          levelKanjiProgress={levelKanjiProgress}
          levelVocabularyProgress={levelVocabularyProgress}
          remainingToLevelUp={remainingToLevelUp}
          passedLevelUpGate={passedLevelUpGate}
          availableProgressLevels={availableProgressLevels}
          levelProgressByLevel={levelProgressByLevel}
          viewerMenuInfo={viewerMenuInfo}
          canViewAllUserPages={isAdminEmail(viewerEmail)}
          initialDashboardTab={initialDashboardTab}
          learnContent={(
            <ExplorerTabs
              accountId={account.id}
              maxLevel={account.wkLevel}
              accountPendingReviews={account.pendingReviews}
              initialQueueMode={initialQueueMode}
              initialStudyMode={initialStudyMode}
              initialStudyFilters={{
                viewedLevel: initialStudyFilters.viewedLevel,
                typeFilter: initialStudyFilters.typeFilter,
                srsFilter: initialStudyFilters.srsFilter,
                srsStageFilter: initialStudyFilters.srsStageFilter,
                recentOnly: initialStudyFilters.recentOnly,
                showLocked: initialStudyFilters.showLocked,
              }}
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
          )}
          readContent={(
            <UserReadPanel
              userWkLevel={account.wkLevel}
              devSampleUrls={getNewsDevSampleUrls()}
              initialTab={initialReadTab}
            />
          )}
        />
      </main>
    </div>
  );
}
