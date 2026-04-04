import { prisma } from "@/lib/prisma";
import { refreshDueAccounts } from "@/lib/sync";
import Link from "next/link";
import LeaderboardTable from "./LeaderboardTable";

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
  lastActivityAt: Date | null;
  score: number;
  lastSyncedAt: Date;
};

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

export default async function Home() {
  let leaderboard: LeaderboardRow[] = [];
  let setupMessage = "";

  try {
    await refreshDueAccounts(1);

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
        lastActivityAt: true,
        score: true,
        lastSyncedAt: true,
      },
    });
  } catch {
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
                WaniRanks
              </h1>
              <p className="mt-4 max-w-2xl text-base text-slate-700 sm:text-lg">
                Live level race for your household. Keep it competitive, track progress,
                and flex daily review grind.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center rounded-full border border-accent/50 bg-accent px-6 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-accent-2"
            >
              Open Admin
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
            <article className="animate-enter animate-enter-delay-1 rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                Players
              </p>
              <p className="mt-2 text-4xl font-black text-foreground sm:text-5xl">
                {formatNumber(leaderboard.length)}
              </p>
            </article>
            <article className="animate-enter animate-enter-delay-2 rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                Total Reviews
              </p>
              <p className="mt-2 text-4xl font-black text-foreground sm:text-5xl">
                {formatNumber(totalReviews)}
              </p>
            </article>
            <article className="animate-enter animate-enter-delay-3 rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                Avg. Level / Top Score
              </p>
              <p className="mt-2 text-4xl font-black text-foreground sm:text-5xl">
                L{averageLevel}
              </p>
              <p className="text-sm font-semibold text-slate-600">{formatNumber(topScore)} pts</p>
            </article>
          </div>
        </section>

        <section className="animate-enter animate-enter-delay-2 mt-6 overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
          {leaderboard.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-xl font-black text-foreground">No players yet</p>
              <p className="mt-2 text-slate-600">
                {setupMessage || "Add your first family member from the admin page."}
              </p>
            </div>
          ) : (
            <LeaderboardTable
              rows={leaderboard.map((row) => ({
                ...row,
                lastActivityAt: row.lastActivityAt ? row.lastActivityAt.toISOString() : null,
                lastSyncedAt: row.lastSyncedAt.toISOString(),
              }))}
            />
          )}
        </section>
        <p className="mt-3 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Score formula: level x 1000 + reviewed x 2 + burned x 4
        </p>
      </main>
    </div>
  );
}
