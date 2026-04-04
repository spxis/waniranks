import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

type LeaderboardRow = {
  id: string;
  nickname: string;
  wkUsername: string;
  wkLevel: number;
  reviewCount: number;
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
        score: true,
        lastSyncedAt: true,
      },
    });
  } catch {
    setupMessage = "Leaderboard will appear after DATABASE_URL is configured and synced.";
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,#fca5a5_0%,transparent_40%),radial-gradient(circle_at_85%_5%,#fdba74_0%,transparent_35%),linear-gradient(180deg,#fffbeb_0%,#fef3c7_100%)]" />
      <main className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-amber-200/70 bg-white/75 p-6 shadow-[0_20px_70px_rgba(120,53,15,0.15)] backdrop-blur">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
                Family Progress
              </p>
              <h1 className="mt-1 text-4xl font-black tracking-tight text-amber-950">
                WaniRanks Leaderboard
              </h1>
              <p className="mt-2 max-w-xl text-sm text-amber-900/80">
                Share this page with your family to compare WaniKani momentum. Admin
                updates happen from the private admin page only.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex h-10 items-center justify-center rounded-full border border-amber-300 bg-amber-100 px-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-200"
            >
              Admin
            </Link>
          </div>

          {leaderboard.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center text-amber-900">
              {setupMessage || "Add your first family member from the admin page."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-amber-200">
              <table className="min-w-full divide-y divide-amber-200 bg-white/80">
                <thead className="bg-amber-100/70 text-left text-xs uppercase tracking-[0.16em] text-amber-800">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Nickname</th>
                    <th className="px-4 py-3">WaniKani</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Reviews</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Synced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 text-sm text-amber-950">
                  {leaderboard.map((row, index) => (
                    <tr key={row.id} className="hover:bg-amber-50/70">
                      <td className="px-4 py-3 font-bold">#{index + 1}</td>
                      <td className="px-4 py-3 font-semibold">{row.nickname}</td>
                      <td className="px-4 py-3">{row.wkUsername}</td>
                      <td className="px-4 py-3">{row.wkLevel}</td>
                      <td className="px-4 py-3">{row.reviewCount.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold">{row.score.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-amber-800/70">
                        {formatDate(row.lastSyncedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
