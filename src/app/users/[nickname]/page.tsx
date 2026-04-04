import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { refreshDueAccounts } from "@/lib/sync";
import LevelExplorer from "./LevelExplorer";

type PageProps = {
  params: Promise<{ nickname: string }>;
};

type LevelKanjiItem = {
  subjectId: number;
  characters: string;
  meanings: string[];
  srsStage: number;
  status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
  availableAt: string | null;
};

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

export default async function UserDetailPage({ params }: PageProps) {
  const { nickname } = await params;
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
      lastSyncedAt: true,
    },
  });

  if (!account) {
    notFound();
  }

  const levelKanjiItems = (account.levelKanjiItems ?? []) as LevelKanjiItem[];

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
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">User detail</p>
          <h1 className="mt-2 text-4xl leading-[0.95] text-foreground sm:text-5xl">{account.nickname}</h1>
          <p className="mt-2 text-sm text-slate-600">@{account.wkUsername}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              Apprentice: {formatNumber(account.apprenticeCount)}
            </div>
            <div className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              Guru: {formatNumber(account.guruCount)}
            </div>
            <div className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              Master: {formatNumber(account.masterCount)}
            </div>
            <div className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              Enlightened: {formatNumber(account.enlightenedCount)}
            </div>
            <div className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              Burned: {formatNumber(account.burnedCount)}
            </div>
          </div>
        </section>

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
        />
      </main>
    </div>
  );
}
