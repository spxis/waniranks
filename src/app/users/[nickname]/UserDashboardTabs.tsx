"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import UserAdminRefreshButton from "./UserAdminRefreshButton";
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
type TypeProgress = {
  guruOrHigher: number;
  total: number;
  percent: number;
};
type TabId = "main" | "item-spread" | "level-progress";
type Props = {
  accountId: string;
  nickname: string;
  wkUsername: string;
  previousUser: { nickname: string; wkUsername: string } | null;
  nextUser: { nickname: string; wkUsername: string } | null;
  linkedEmail: string | null;
  viewerMatchesAccount: boolean;
  lastSyncedAt: string;
  lastActivityAt: string | null;
  globalRank: number;
  totalPlayers: number;
  wkLevel: number;
  levelKanjiLearned: number;
  levelKanjiTotal: number;
  levelKanjiLocked: number;
  totalLearnedKanji: number;
  estimatedHoursRemaining: number | null;
  apprenticeCount: number;
  guruCount: number;
  masterCount: number;
  enlightenedCount: number;
  burnedCount: number;
  radicalCount: number;
  totalKanjiCount: number;
  vocabularyCount: number;
  itemSpread: ItemSpread;
  levelRadicalProgress: TypeProgress;
  levelKanjiProgress: TypeProgress;
  levelVocabularyProgress: TypeProgress;
  remainingToLevelUp: number;
  passedLevelUpGate: boolean;
};
type LiveData = {
  lastSyncedAt: string;
  lastActivityAt: string | null;
};
function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}
export default function UserDashboardTabs({
  accountId,
  nickname,
  wkUsername,
  previousUser,
  nextUser,
  linkedEmail,
  viewerMatchesAccount,
  lastSyncedAt,
  lastActivityAt,
  globalRank,
  totalPlayers,
  wkLevel,
  levelKanjiLearned,
  levelKanjiTotal,
  levelKanjiLocked,
  totalLearnedKanji,
  estimatedHoursRemaining,
  apprenticeCount,
  guruCount,
  masterCount,
  enlightenedCount,
  burnedCount,
  radicalCount,
  totalKanjiCount,
  vocabularyCount,
  itemSpread,
  levelRadicalProgress,
  levelKanjiProgress,
  levelVocabularyProgress,
  remainingToLevelUp,
  passedLevelUpGate,
}: Props) {
  const tabStorageKey = `wr:user:${accountId}:dashboard-tab`;
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === "undefined") {
      return "main";
    }
    try {
      const stored = window.localStorage.getItem(tabStorageKey);
      return stored === "main" || stored === "item-spread" || stored === "level-progress"
        ? stored
        : "main";
    } catch {
      return "main";
    }
  });
  const actionButtonBaseClass =
    "inline-flex h-10 shrink-0 items-center justify-center rounded-full border px-4 text-xs font-bold uppercase tracking-[0.1em] transition disabled:cursor-not-allowed disabled:opacity-60";
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { data: liveData, mutate } = useSWR<LiveData>(
    `/api/accounts/${accountId}/live`,
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      const payload = (await response.json()) as LiveData;
      if (!response.ok) {
        throw new Error("Could not fetch live account data.");
      }
      return payload;
    },
    { refreshInterval: 15_000, revalidateOnFocus: true },
  );
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const onUserRefreshed = (event: Event) => {
      const custom = event as CustomEvent<{ accountId?: string }>;
      if (custom.detail?.accountId !== accountId) {
        return;
      }
      void mutate();
    };
    window.addEventListener("wr:user-refreshed", onUserRefreshed as EventListener);
    return () => {
      window.removeEventListener("wr:user-refreshed", onUserRefreshed as EventListener);
    };
  }, [accountId, mutate]);
  const liveLastSyncedMs = new Date(liveData?.lastSyncedAt ?? lastSyncedAt).getTime();
  const liveLastActivityMs = new Date(liveData?.lastActivityAt ?? lastActivityAt ?? "").getTime();
  function formatRelativeTime(timestampMs: number): string {
    if (Number.isNaN(timestampMs)) {
      return "unknown";
    }
    const deltaMs = nowMs - timestampMs;
    if (deltaMs < 30_000) {
      return "just now";
    }
    const minuteMs = 60_000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;
    if (deltaMs < hourMs) {
      const minutes = Math.max(1, Math.round(deltaMs / minuteMs));
      return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }
    if (deltaMs < dayMs) {
      const hours = Math.max(1, Math.round(deltaMs / hourMs));
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    const days = Math.max(1, Math.round(deltaMs / dayMs));
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  function formatAbsoluteTime(timestampMs: number): string {
    if (Number.isNaN(timestampMs)) {
      return "Unknown";
    }
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestampMs));
  }
  function switchTab(next: TabId) {
    setActiveTab(next);
    try {
      window.localStorage.setItem(tabStorageKey, next);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }
  function tabClass(tab: TabId): string {
    const active = activeTab === tab;
    return active
      ? `${actionButtonBaseClass} border-accent bg-accent text-white`
      : `${actionButtonBaseClass} border-line bg-surface text-foreground hover:bg-surface-muted`;
  }
  return (
    <section className="rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.15)] sm:p-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">User detail</p>
            <Link
              href="/"
              className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-surface px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition hover:bg-surface-muted"
            >
              Leaderboard
            </Link>
          </div>
          <div className="ml-auto hidden items-center justify-end gap-2 sm:flex">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="User dashboard tabs">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "main"}
                className={tabClass("main")}
                onClick={() => switchTab("main")}
              >
                Main Data
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "item-spread"}
                className={tabClass("item-spread")}
                onClick={() => switchTab("item-spread")}
              >
                Item Spread
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "level-progress"}
                className={tabClass("level-progress")}
                onClick={() => switchTab("level-progress")}
              >
                Level Progress
              </button>
            </div>
            <UserAdminRefreshButton
              accountId={accountId}
              label={"\u21BB"}
              ariaLabel="Refresh"
              iconOnly
              showMessage={false}
              buttonClassName="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-lg font-bold text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <UserAdminRefreshButton
            accountId={accountId}
            label={"\u21BB"}
            ariaLabel="Refresh"
            iconOnly
            showMessage={false}
            buttonClassName="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-lg font-bold text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
          />
        </div>
        <div
          className="flex w-full items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:hidden"
          role="tablist"
          aria-label="User dashboard tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "main"}
            className={tabClass("main")}
            onClick={() => switchTab("main")}
          >
            <span className="sm:hidden">Main</span>
            <span className="hidden sm:inline">Main Data</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "item-spread"}
            className={tabClass("item-spread")}
            onClick={() => switchTab("item-spread")}
          >
            <span className="sm:hidden">Items</span>
            <span className="hidden sm:inline">Item Spread</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "level-progress"}
            className={tabClass("level-progress")}
            onClick={() => switchTab("level-progress")}
          >
            <span className="sm:hidden">Level</span>
            <span className="hidden sm:inline">Level Progress</span>
          </button>
        </div>
        <div className="flex w-full items-start gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-4xl leading-[0.95] text-foreground sm:text-5xl">{nickname}</h1>
            {viewerMatchesAccount ? (
              <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-800">
                Me
              </span>
            ) : null}
          </div>
          <div className="ml-auto shrink-0 text-right">
            <p className="text-2xl font-black uppercase tracking-[0.06em] text-foreground sm:text-4xl">
              <span>Rank #{globalRank}</span>
              <span className="ml-2 text-base font-bold text-foreground/65 sm:text-xl">
                of {formatNumber(totalPlayers)}
              </span>
            </p>
            {previousUser && nextUser ? (
              <div className="mt-1 flex items-center justify-end gap-2 text-xs font-bold uppercase tracking-[0.08em] text-foreground/70">
                <Link href={`/users/${encodeURIComponent(previousUser.wkUsername)}`} className="rounded-full border border-line bg-surface px-2 py-0.5 hover:bg-surface-muted" aria-label={`Previous user ${previousUser.nickname}`}>
                  {"< "}{previousUser.nickname}
                </Link>
                <Link href={`/users/${encodeURIComponent(nextUser.wkUsername)}`} className="rounded-full border border-line bg-surface px-2 py-0.5 hover:bg-surface-muted" aria-label={`Next user ${nextUser.nickname}`}>
                  {nextUser.nickname}{" >"}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-foreground/70">
            @{wkUsername}
            {linkedEmail ? <span className="text-foreground/55"> · {linkedEmail}</span> : null}
          </p>
          <p className="shrink-0 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/60 sm:text-xs">
            <span className="sm:hidden">
              Upd {formatRelativeTime(liveLastSyncedMs)}
              <span className="mx-1 text-foreground/40">|</span>
              Act {lastActivityAt || liveData?.lastActivityAt ? formatRelativeTime(liveLastActivityMs) : "Unknown"}
            </span>
            <span className="hidden sm:inline">
              Updated {formatAbsoluteTime(liveLastSyncedMs)} ({formatRelativeTime(liveLastSyncedMs)})
              <span className="mx-2 text-foreground/40">|</span>
              Active {lastActivityAt || liveData?.lastActivityAt ? `${formatAbsoluteTime(liveLastActivityMs)} (${formatRelativeTime(liveLastActivityMs)})` : "Unknown"}
            </span>
          </p>
        </div>
      </div>
      {activeTab === "main" ? (
        <div className="mt-4" role="tabpanel">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <article className="rounded-2xl border border-line bg-surface-muted p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Level</p>
              <p className="mt-2 text-4xl font-black text-accent">{wkLevel}</p>
            </article>
            <article className="rounded-2xl border border-line bg-surface-muted p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Learned Kanji</p>
              <p className="mt-2 text-4xl font-black text-foreground">{formatNumber(levelKanjiLearned)}</p>
              <p className="text-xs text-foreground/65">of {formatNumber(levelKanjiTotal)} in this level</p>
            </article>
            <article className="rounded-2xl border border-line bg-surface-muted p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Remaining (Level)</p>
              <p className="mt-2 text-4xl font-black text-hot">{formatNumber(Math.max(0, levelKanjiTotal - levelKanjiLearned))}</p>
              <p className="text-xs text-foreground/65">locked: {formatNumber(levelKanjiLocked)}</p>
            </article>
            <article className="rounded-2xl border border-kanji/30 bg-kanji/10 p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-kanji">Total Learned</p>
              <p className="mt-2 text-4xl font-black text-kanji">{formatNumber(totalLearnedKanji)}</p>
              <p className="text-xs text-foreground/65">all kanji at Guru+</p>
            </article>
            <article className="rounded-2xl border border-line bg-surface-muted p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Est. Time Remaining</p>
              <p className="mt-2 text-3xl font-black text-foreground">
                {estimatedHoursRemaining === null ? "Unknown" : `${estimatedHoursRemaining}h`}
              </p>
              <p className="text-xs text-foreground/65">Until 90% level kanji at Guru+</p>
            </article>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
            <Link href="?srs=apprentice#explorer" className="rounded-xl border border-line bg-surface px-3 py-2 text-center text-sm font-semibold text-foreground hover:bg-surface-muted">
              <span className="block">Apprentice:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(apprenticeCount)}</span>
            </Link>
            <Link href="?srs=guru#explorer" className="rounded-xl border border-line bg-surface px-3 py-2 text-center text-sm font-semibold text-foreground hover:bg-surface-muted">
              <span className="block">Guru:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(guruCount)}</span>
            </Link>
            <Link href="?srs=master#explorer" className="rounded-xl border border-line bg-surface px-3 py-2 text-center text-sm font-semibold text-foreground hover:bg-surface-muted">
              <span className="block">Master:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(masterCount)}</span>
            </Link>
            <Link href="?srs=enlightened#explorer" className="rounded-xl border border-line bg-surface px-3 py-2 text-center text-sm font-semibold text-foreground hover:bg-surface-muted">
              <span className="block">Enlightened:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(enlightenedCount)}</span>
            </Link>
            <Link href="?srs=burned#explorer" className="rounded-xl border border-line bg-surface px-3 py-2 text-center text-sm font-semibold text-foreground hover:bg-surface-muted">
              <span className="block">Burned:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(burnedCount)}</span>
            </Link>
            <div className="rounded-xl border border-radical/40 bg-radical/10 px-3 py-2 text-center text-sm font-semibold text-radical">
              <span className="block">Radicals:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(radicalCount)}</span>
            </div>
            <div className="rounded-xl border border-kanji/40 bg-kanji/10 px-3 py-2 text-center text-sm font-semibold text-kanji">
              <span className="block">Kanji:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(totalKanjiCount)}</span>
            </div>
            <div className="rounded-xl border border-vocabulary/40 bg-vocabulary/10 px-3 py-2 text-center text-sm font-semibold text-vocabulary">
              <span className="block">Vocabulary:</span>
              <span className="mt-0.5 block text-4xl leading-none">{formatNumber(vocabularyCount)}</span>
            </div>
          </div>
        </div>
      ) : null}
      {activeTab === "item-spread" ? (
        <div className="mt-4" role="tabpanel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black text-foreground">Item Spread</h2>
            <div className="hidden flex-wrap items-center gap-2 text-sm font-semibold text-foreground/80 sm:flex">
              <span className="subject-pill subject-pill--radical">Radicals</span>
              <span className="subject-pill subject-pill--kanji">Kanji</span>
              <span className="subject-pill subject-pill--vocabulary">Vocabulary</span>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {([
              ["Apprentice", itemSpread.apprentice],
              ["Guru", itemSpread.guru],
              ["Master", itemSpread.master],
              ["Enlightened", itemSpread.enlightened],
              ["Burned", itemSpread.burned],
            ] as const).map(([label, row]) => (
              <div
                key={label}
                className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.9fr] items-center gap-2 rounded-xl border border-line bg-surface-muted px-3 py-2"
              >
                <p className="text-xl font-semibold text-foreground">{label}</p>
                <span className="subject-pill subject-pill--radical justify-center">{formatNumber(row.radical)}</span>
                <span className="subject-pill subject-pill--kanji justify-center">{formatNumber(row.kanji)}</span>
                <span className="subject-pill subject-pill--vocabulary justify-center">{formatNumber(row.vocabulary)}</span>
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-center text-2xl font-black text-foreground">
                  {formatNumber(row.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {activeTab === "level-progress" ? (
        <div className="mt-4" role="tabpanel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-black text-foreground">Level Progress</h2>
            <p className="text-2xl font-semibold text-foreground/80">Level {wkLevel}</p>
          </div>
          <p className="mt-3 text-lg text-foreground/75">Number of items Guru&apos;d in this level.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {([
              ["Radicals", "radical", levelRadicalProgress],
              ["Kanji", "kanji", levelKanjiProgress],
              ["Vocabulary", "vocabulary", levelVocabularyProgress],
            ] as const).map(([label, type, progress]) => (
              <article key={label} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="flex items-center gap-2 px-4 py-3">
                  <span className={`subject-pill subject-pill--${type}`}>{label}</span>
                </div>
                <div className="h-2 bg-surface-muted">
                  <div
                    className={`h-full ${
                      type === "radical"
                        ? "bg-radical"
                        : type === "kanji"
                          ? "bg-kanji"
                          : "bg-vocabulary"
                    }`}
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground/80">
                  <p className="text-4xl font-black text-foreground">
                    {formatNumber(progress.guruOrHigher)}/{formatNumber(progress.total)}
                  </p>
                  <a href="#explorer" className="text-lg font-bold text-foreground/80 hover:text-accent">
                    See all
                  </a>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-line bg-surface-muted px-4 py-4 text-lg text-foreground/85">
            {passedLevelUpGate
              ? "You have passed this level gate, but there are still items you have not Guru'd yet."
              : `Guru ${formatNumber(remainingToLevelUp)} more kanji to level up.`}
          </div>
        </div>
      ) : null}
    </section>
  );
}
