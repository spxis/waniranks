import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { refreshDueAccounts } from "@/lib/sync";
import LeaderboardAdminActions from "./LeaderboardAdminActions";
import UserHeaderMenu from "./users/[nickname]/UserHeaderMenu";
import { resolveViewerMenuInfo } from "./users/[nickname]/userPageAuth";
import LeaderboardTable from "./leaderboard/components/LeaderboardTable";

export const dynamic = "force-dynamic";

type LeaderboardRow = {
  id: string;
  nickname: string;
  wkUsername: string;
  wkLevel: number;
  reviewCount: number;
  burnedCount: number;
  pendingReviews: number;
  radicalCount: number;
  vocabularyCount: number;
  apprenticeCount: number;
  guruCount: number;
  masterCount: number;
  enlightenedCount: number;
  levelKanjiTotal: number;
  levelKanjiLearned: number;
  levelKanjiGuruPlus: number;
  levelKanjiLocked: number;
  itemSpread: unknown;
  jlptCounts: unknown;
  lastActivityAt: Date | null;
  lastRadicalGuruedAt: Date | null;
  lastKanjiGuruedAt: Date | null;
  lastVocabularyGuruedAt: Date | null;
  lastRadicalGuruedItem: unknown;
  lastKanjiGuruedItem: unknown;
  lastVocabularyGuruedItem: unknown;
  score: number;
  lastSyncedAt: Date;
  dailyDelta?: {
    score: number;
    reviewCount: number;
    wkLevel: number;
    radicalCount: number;
    vocabularyCount: number;
    burnedCount: number;
    levelKanjiLearned: number;
  } | null;
};

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

export default async function Home() {
  const session = await getServerSession(authOptions);
  const viewerEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const viewerMenuInfo = await resolveViewerMenuInfo({
    viewerEmail,
    sessionName: session?.user?.name?.trim() ?? null,
  });

  let leaderboard: LeaderboardRow[] = [];
  let setupMessage = "";
  let runtimeError = "";

  try {
    const refreshPromise = refreshDueAccounts(1).catch((error) => {
      console.error("Non-blocking refresh failed", error);
      return { refreshed: 0, skipped: 0 };
    });

    leaderboard = await prisma.account.findMany({
      orderBy: [{ score: "desc" }, { wkLevel: "desc" }, { reviewCount: "desc" }],
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
        itemSpread: true,
        jlptCounts: true,
        lastActivityAt: true,
        lastRadicalGuruedAt: true,
        lastKanjiGuruedAt: true,
        lastVocabularyGuruedAt: true,
        lastRadicalGuruedItem: true,
        lastKanjiGuruedItem: true,
        lastVocabularyGuruedItem: true,
        score: true,
        lastSyncedAt: true,
      },
    });

    if (leaderboard.length > 0) {
      const accountIds = leaderboard.map((row) => row.id);
      const snapshots = await prisma.dailyAccountSnapshot.findMany({
        where: { accountId: { in: accountIds } },
        orderBy: [{ snapshotDatePst: "desc" }],
        select: {
          accountId: true,
          score: true,
          reviewCount: true,
          wkLevel: true,
          radicalCount: true,
          vocabularyCount: true,
          burnedCount: true,
          levelKanjiLearned: true,
        },
      });

      const latestTwoByAccount = new Map<
        string,
        Array<{
          score: number;
          reviewCount: number;
          wkLevel: number;
          radicalCount: number;
          vocabularyCount: number;
          burnedCount: number;
          levelKanjiLearned: number;
        }>
      >();

      for (const snapshot of snapshots) {
        const current = latestTwoByAccount.get(snapshot.accountId) ?? [];
        if (current.length >= 2) {
          continue;
        }

        current.push({
          score: snapshot.score,
          reviewCount: snapshot.reviewCount,
          wkLevel: snapshot.wkLevel,
          radicalCount: snapshot.radicalCount,
          vocabularyCount: snapshot.vocabularyCount,
          burnedCount: snapshot.burnedCount,
          levelKanjiLearned: snapshot.levelKanjiLearned,
        });
        latestTwoByAccount.set(snapshot.accountId, current);
      }

      leaderboard = leaderboard.map((row) => {
        const snapshotsForAccount = latestTwoByAccount.get(row.id) ?? [];
        const previous = snapshotsForAccount[1] ?? null;

        if (!previous) {
          return { ...row, dailyDelta: null };
        }

        return {
          ...row,
          dailyDelta: {
            score: row.score - previous.score,
            reviewCount: row.reviewCount - previous.reviewCount,
            wkLevel: row.wkLevel - previous.wkLevel,
            radicalCount: row.radicalCount - previous.radicalCount,
            vocabularyCount: row.vocabularyCount - previous.vocabularyCount,
            burnedCount: row.burnedCount - previous.burnedCount,
            levelKanjiLearned: row.levelKanjiLearned - previous.levelKanjiLearned,
          },
        };
      });
    }

    void refreshPromise;
  } catch (error) {
    runtimeError = error instanceof Error ? error.message : "Unknown server error";
    setupMessage = "Leaderboard will appear after DATABASE_URL is configured and synced.";
  }

  const totalReviews = leaderboard.reduce((sum, row) => sum + row.reviewCount, 0);
  const averageLevel =
    leaderboard.length > 0
      ? Math.round(
          leaderboard.reduce((sum, row) => sum + row.wkLevel, 0) / leaderboard.length,
        )
      : 0;
  const topScore = leaderboard[0]?.score ?? 0;

  return (
    <div className="relative min-h-screen overflow-hidden pb-12">
      <div className="noise-overlay pointer-events-none absolute inset-0" />
      <main className="relative mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        <section className="animate-enter rounded-[2rem] border border-line/80 bg-surface/85 p-5 shadow-[0_24px_80px_rgba(15,111,255,0.17)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
                Family Statboard
              </p>
              <h1 className="mt-2 text-4xl leading-[0.9] text-foreground sm:text-6xl lg:text-7xl">
                UmaKuma
              </h1>
              <p className="mt-4 max-w-2xl text-base text-foreground/75 sm:text-lg">
                Live level race for your household. Keep it competitive, track progress,
                and flex daily review grind.
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
              <Link
                href="/join"
                className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-surface px-6 text-sm font-bold uppercase tracking-[0.14em] text-foreground transition hover:bg-surface-muted"
              >
                Join Board
              </Link>
              <LeaderboardAdminActions />
              <UserHeaderMenu viewerMenuInfo={viewerMenuInfo} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
            <article className="animate-enter animate-enter-delay-1 rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/70">
                Players
              </p>
              <p className="mt-2 text-4xl font-black text-foreground sm:text-5xl">
                {formatNumber(leaderboard.length)}
              </p>
            </article>
            <article className="animate-enter animate-enter-delay-2 rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/70">
                Total Reviews
              </p>
              <p className="mt-2 text-4xl font-black text-foreground sm:text-5xl">
                {formatNumber(totalReviews)}
              </p>
            </article>
            <article className="animate-enter animate-enter-delay-3 rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/70">
                Avg. Level / Top Score
              </p>
              <p className="mt-2 text-4xl font-black text-foreground sm:text-5xl">
                L{averageLevel}
              </p>
              <p className="text-sm font-semibold text-foreground/65">{formatNumber(topScore)} pts</p>
            </article>
          </div>
        </section>

        <section className="animate-enter animate-enter-delay-2 mt-6 overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
          {runtimeError ? (
            <div className="border-b border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-900">
              <p className="font-bold uppercase tracking-[0.08em]">Runtime error detected</p>
              <p className="mt-1 break-words font-medium">{runtimeError}</p>
            </div>
          ) : null}
          {leaderboard.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-xl font-black text-foreground">No players yet</p>
              <p className="mt-2 text-foreground/70">
                {setupMessage || "Add your first family member from the admin page."}
              </p>
            </div>
          ) : (
            <LeaderboardTable
              rows={leaderboard.map((row) => ({
                ...row,
                lastActivityAt: row.lastActivityAt ? row.lastActivityAt.toISOString() : null,
                lastRadicalGuruedAt: row.lastRadicalGuruedAt
                  ? row.lastRadicalGuruedAt.toISOString()
                  : null,
                lastKanjiGuruedAt: row.lastKanjiGuruedAt
                  ? row.lastKanjiGuruedAt.toISOString()
                  : null,
                lastVocabularyGuruedAt: row.lastVocabularyGuruedAt
                  ? row.lastVocabularyGuruedAt.toISOString()
                  : null,
                lastRadicalGuruedItem: row.lastRadicalGuruedItem,
                lastKanjiGuruedItem: row.lastKanjiGuruedItem,
                lastVocabularyGuruedItem: row.lastVocabularyGuruedItem,
                lastSyncedAt: row.lastSyncedAt.toISOString(),
              }))}
            />
          )}
        </section>
        <p className="mt-3 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55">
          Score formula: level x 1000 + reviewed x 2 + burned x 4 + learned kanji x 3
        </p>
      </main>
    </div>
  );
}
