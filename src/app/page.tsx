import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

type LeaderboardRow = {
  id: string;
  nickname: string;
  wkUsername: string;
  wkLevel: number;
  reviewCount: number;
  burnedCount: number;
  pendingReviews: number;
  score: number;
  lastSyncedAt: Date;
};

function formatDate(input: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(input);
}

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

export default async function Home() {
  let leaderboard: LeaderboardRow[] = [];
  let setupMessage = "";

  try {
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
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-line bg-surface-muted text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                  <tr>
                    <th className="px-5 py-4">Rank</th>
                    <th className="px-5 py-4">Nickname</th>
                    <th className="px-5 py-4">WaniKani</th>
                    <th className="px-5 py-4">Level</th>
                    <th className="px-5 py-4">Reviewed</th>
                    <th className="px-5 py-4">Burned</th>
                    <th className="px-5 py-4">Due Now</th>
                    <th className="px-5 py-4">Score</th>
                    <th className="px-5 py-4">Synced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-sm text-slate-800">
                  {leaderboard.map((row, index) => {
                    const rank = index + 1;
                    const topRank = rank <= 3;

                    return (
                      <tr key={row.id} className="transition hover:bg-surface-muted/80">
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex min-w-12 items-center justify-center rounded-full px-3 py-1 text-sm font-black ${
                              topRank
                                ? "bg-highlight text-slate-900"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            #{rank}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-lg font-black text-foreground">{row.nickname}</td>
                        <td className="px-5 py-4 font-semibold text-slate-700">{row.wkUsername}</td>
                        <td className="px-5 py-4 text-lg font-black text-accent">{row.wkLevel}</td>
                        <td className="px-5 py-4 font-semibold">{formatNumber(row.reviewCount)}</td>
                        <td className="px-5 py-4 font-semibold">{formatNumber(row.burnedCount)}</td>
                        <td className="px-5 py-4 font-semibold text-slate-600">
                          {formatNumber(row.pendingReviews)}
                        </td>
                        <td className="px-5 py-4 text-lg font-black text-hot">
                          {formatNumber(row.score)}
                        </td>
                        <td className="px-5 py-4 text-xs uppercase tracking-[0.08em] text-slate-500">
                          {formatDate(row.lastSyncedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="mt-3 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Score formula: level x 1000 + reviewed x 2 + burned x 4
        </p>
      </main>
    </div>
  );
}
