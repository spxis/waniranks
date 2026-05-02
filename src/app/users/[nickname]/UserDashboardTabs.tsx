"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { getStoredEnum, setStoredEnum } from "@/lib/clientStorage";
import { formatDateTimeShort, formatRelativeFromNow } from "@/lib/timeFormat";
import SegmentedControl from "@/app/shared/SegmentedControl";
import UserAdminRefreshButton from "./UserAdminRefreshButton";
import {
  ItemSpreadTabPanel,
  LevelProgressTabPanel,
  MainTabPanel,
} from "./UserDashboardTabPanels";
import type { LiveData, TabId, UserDashboardTabsProps as Props } from "./UserDashboardTabs.types";
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
  itemSpreadDetails,
  levelRadicalProgress,
  levelKanjiProgress,
  levelVocabularyProgress,
  remainingToLevelUp,
  passedLevelUpGate,
  availableProgressLevels = [],
  levelProgressByLevel = {},
}: Props) {
  const tabStorageKey = `wr:user:${accountId}:dashboard-tab`;
  const safeProgressLevels = useMemo(
    () =>
      Array.from(
        new Set([
          ...Array.from({ length: Math.max(1, wkLevel) }, (_, index) => index + 1),
          ...(Array.isArray(availableProgressLevels) ? availableProgressLevels : []),
        ]),
      ).sort((a, b) => a - b),
    [availableProgressLevels, wkLevel],
  );
  const [activeTab, setActiveTab] = useState<TabId>("learn");
  const levelProgressStorageKey = `wr:user:${accountId}:level-progress-level`;
  const [selectedProgressLevel, setSelectedProgressLevel] = useState<number>(wkLevel);
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
    const storedTab = getStoredEnum(
      tabStorageKey,
      ["learn", "stats", "read"] as const,
      "learn",
    );
    setActiveTab(storedTab);

  }, [tabStorageKey]);

  useEffect(() => {
    const raw = window.localStorage.getItem(levelProgressStorageKey);
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && safeProgressLevels.includes(parsed)) {
      setSelectedProgressLevel(parsed);
      return;
    }

    setSelectedProgressLevel(wkLevel);
  }, [levelProgressStorageKey, safeProgressLevels, wkLevel]);

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
    return formatRelativeFromNow(timestampMs, {
      nowMs,
      style: "long",
      allowFuture: false,
      noValueLabel: "unknown",
      invalidLabel: "unknown",
      justNowLabel: "just now",
    });
  }
  function formatAbsoluteTime(timestampMs: number): string {
    return formatDateTimeShort(timestampMs, "Unknown");
  }
  function switchTab(next: TabId) {
    setActiveTab(next);
    setStoredEnum(tabStorageKey, next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wr:dashboard-tab-change", { detail: { tab: next } }));
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("wr:dashboard-tab-change", { detail: { tab: activeTab } }));
  }, [activeTab]);

  useEffect(() => {
    if (safeProgressLevels.length === 0) {
      return;
    }

    if (safeProgressLevels.includes(selectedProgressLevel)) {
      return;
    }

    const next = safeProgressLevels.includes(wkLevel)
      ? wkLevel
      : safeProgressLevels[safeProgressLevels.length - 1] ?? wkLevel;
    setSelectedProgressLevel(next);
  }, [safeProgressLevels, selectedProgressLevel, wkLevel]);

  useEffect(() => {
    if (!safeProgressLevels.includes(selectedProgressLevel)) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(levelProgressStorageKey, String(selectedProgressLevel));
  }, [levelProgressStorageKey, safeProgressLevels, selectedProgressLevel]);

  const selectedLevelProgress = levelProgressByLevel?.[selectedProgressLevel] ?? {
    radical: levelRadicalProgress,
    kanji: levelKanjiProgress,
    vocabulary: levelVocabularyProgress,
    remainingToLevelUp,
    passedLevelUpGate,
  };
  return (
    <section className="rounded-[2rem] border border-line bg-surface/90 p-3 shadow-[0_24px_80px_rgba(15,111,255,0.15)] sm:p-8">
      <div className="flex flex-col gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">User detail</p>
            <Link
              href="/"
              className="inline-flex h-8 select-none items-center justify-center rounded-full border border-line bg-surface px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition hover:bg-surface-muted"
            >
              Leaderboard
            </Link>
            <Link
              href={`/users/${encodeURIComponent(wkUsername)}/history`}
              className="inline-flex h-8 select-none items-center justify-center rounded-full border border-line bg-surface px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition hover:bg-surface-muted"
            >
              History
            </Link>
          </div>
          <div className="ml-auto hidden items-center justify-end gap-2 sm:flex">
            <SegmentedControl
              ariaLabel="User dashboard tabs"
              value={activeTab}
              onChange={switchTab}
              size="md"
              asTabs
              options={[
                { value: "learn", label: "Learn" },
                { value: "stats", label: "Stats" },
                { value: "read", label: "Read" },
              ]}
            />
            <UserAdminRefreshButton
              accountId={accountId}
              label={"\u21BB"}
              ariaLabel="Refresh"
              iconOnly
              showMessage={false}
              buttonClassName="inline-flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full border border-line bg-surface text-lg font-bold text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <UserAdminRefreshButton
            accountId={accountId}
            label={"\u21BB"}
            ariaLabel="Refresh"
            iconOnly
            showMessage={false}
            buttonClassName="inline-flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full border border-line bg-surface text-lg font-bold text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
          />
        </div>
        <div className="sm:hidden">
          <SegmentedControl
            ariaLabel="User dashboard tabs"
            value={activeTab}
            onChange={switchTab}
            size="md"
            asTabs
            options={[
              { value: "learn", label: "Learn" },
              { value: "stats", label: "Stats" },
              { value: "read", label: "Read" },
            ]}
          />
        </div>
        <div className="flex w-full items-start gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-2xl leading-[0.95] text-foreground sm:text-5xl">{nickname}</h1>
            {viewerMatchesAccount ? (
              <span className="inline-flex select-none items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-800">
                Me
              </span>
            ) : null}
          </div>
          <div className="ml-auto shrink-0 text-right">
            <p className="text-lg font-black uppercase tracking-[0.06em] text-foreground sm:text-4xl">
              <span>Rank #{globalRank}</span>
              <span className="ml-1 text-sm font-bold text-foreground/65 sm:ml-2 sm:text-xl">
                of {formatNumber(totalPlayers)}
              </span>
            </p>
            {totalPlayers > 1 ? (
              <div className="mt-1 flex items-center justify-end gap-2 text-xs font-bold uppercase tracking-[0.08em] text-foreground/70">
                <Link
                  href={`/users/${encodeURIComponent(previousUser?.wkUsername ?? wkUsername)}`}
                  className="rounded-full border border-line bg-surface px-2 py-0.5 select-none hover:bg-surface-muted"
                  aria-label={`Previous user ${previousUser?.nickname ?? nickname}`}
                >
                  {"< "}{previousUser?.nickname ?? nickname}
                </Link>
                <Link
                  href={`/users/${encodeURIComponent(nextUser?.wkUsername ?? wkUsername)}`}
                  className="rounded-full border border-line bg-surface px-2 py-0.5 select-none hover:bg-surface-muted"
                  aria-label={`Next user ${nextUser?.nickname ?? nickname}`}
                >
                  {nextUser?.nickname ?? nickname}{" >"}
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
      {activeTab === "learn" ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface-muted p-4 sm:p-6" role="tabpanel">
          <h2 className="text-2xl font-black text-foreground">Learn</h2>
          <p className="mt-2 text-sm text-foreground/75">
            Use Study, WaniKani Explorer, and JLPT Explorer below to review, drill, and explore.
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/60">
            Stats were moved to the Stats tab for a cleaner learn flow.
          </p>
        </div>
      ) : null}
      {activeTab === "stats" ? (
        <div className="mt-4 space-y-4" role="tabpanel">
          <section className="rounded-2xl border border-line bg-surface-muted p-3 sm:p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/65">Snapshot</p>
            <MainTabPanel
              wkLevel={wkLevel}
              levelKanjiLearned={levelKanjiLearned}
              levelKanjiTotal={levelKanjiTotal}
              levelKanjiLocked={levelKanjiLocked}
              totalLearnedKanji={totalLearnedKanji}
              estimatedHoursRemaining={estimatedHoursRemaining}
              apprenticeCount={apprenticeCount}
              guruCount={guruCount}
              masterCount={masterCount}
              enlightenedCount={enlightenedCount}
              burnedCount={burnedCount}
              radicalCount={radicalCount}
              totalKanjiCount={totalKanjiCount}
              vocabularyCount={vocabularyCount}
            />
          </section>

          <section className="rounded-2xl border border-line bg-surface-muted p-3 sm:p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/65">Item spread</p>
          <ItemSpreadTabPanel itemSpread={itemSpread} itemSpreadDetails={itemSpreadDetails} />
          </section>

          <section className="rounded-2xl border border-line bg-surface-muted p-3 sm:p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/65">Level progress</p>
          <LevelProgressTabPanel
            accountId={accountId}
            currentWkLevel={wkLevel}
            wkLevel={selectedProgressLevel}
            levelOptions={safeProgressLevels}
            levelProgressByLevel={levelProgressByLevel}
            onSelectLevel={setSelectedProgressLevel}
            levelRadicalProgress={selectedLevelProgress.radical}
            levelKanjiProgress={selectedLevelProgress.kanji}
            levelVocabularyProgress={selectedLevelProgress.vocabulary}
            remainingToLevelUp={selectedLevelProgress.remainingToLevelUp}
            passedLevelUpGate={selectedLevelProgress.passedLevelUpGate}
          />
          </section>
        </div>
      ) : null}
      {activeTab === "read" ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface-muted p-4 sm:p-6" role="tabpanel">
          <h2 className="text-2xl font-black text-foreground">Read</h2>
          <p className="mt-2 text-sm text-foreground/75">
            Open the News Reader to practice reading and track your article history and stats.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/news"
              className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
            >
              Read News
            </Link>
            <Link
              href="/news/history"
              className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
            >
              News History
            </Link>
            <Link
              href="/news/stats"
              className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
            >
              News Stats
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
