"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { getStoredEnum, setStoredEnum } from "@/lib/clientStorage";
import { formatDateTimeShort, formatRelativeFromNow } from "@/lib/timeFormat";
import SegmentedControl from "@/app/shared/SegmentedControl";
import UserHeaderMenu from "./UserHeaderMenu";
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
  viewerMenuInfo,
  canViewAllUserPages,
  initialDashboardTab,
  learnContent,
  readContent,
}: Props) {
  const tabStorageKey = `wr:user:${accountId}:dashboard-tab`;
  const levelProgressStorageKey = `wr:user:${accountId}:level-progress-level`;
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
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (initialDashboardTab !== "learn") {
      return initialDashboardTab;
    }
    return getStoredEnum(
      tabStorageKey,
      ["learn", "stats", "read"] as const,
      "learn",
    );
  });
  const [selectedProgressLevel, setSelectedProgressLevel] = useState<number>(() => {
    if (typeof window === "undefined") {
      return wkLevel;
    }
    const raw = window.localStorage.getItem(levelProgressStorageKey);
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : wkLevel;
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [flashViewerOpen, setFlashViewerOpen] = useState(false);
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
    const onStudyViewerModeChange = (event: Event) => {
      const custom = event as CustomEvent<{ open?: boolean; viewerMode?: "detail" | "flash" | null }>;
      setFlashViewerOpen(Boolean(custom.detail?.open) && custom.detail?.viewerMode === "flash");
    };

    window.addEventListener("wr:study-viewer-mode", onStudyViewerModeChange as EventListener);
    return () => {
      window.removeEventListener("wr:study-viewer-mode", onStudyViewerModeChange as EventListener);
    };
  }, []);

  const effectiveSelectedProgressLevel =
    safeProgressLevels.includes(selectedProgressLevel)
      ? selectedProgressLevel
      : safeProgressLevels.includes(wkLevel)
        ? wkLevel
        : safeProgressLevels[safeProgressLevels.length - 1] ?? wkLevel;

  useEffect(() => {
    if (!safeProgressLevels.includes(effectiveSelectedProgressLevel)) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(levelProgressStorageKey, String(effectiveSelectedProgressLevel));
  }, [effectiveSelectedProgressLevel, levelProgressStorageKey, safeProgressLevels]);

  const selectedLevelProgress = levelProgressByLevel?.[effectiveSelectedProgressLevel] ?? {
    radical: levelRadicalProgress,
    kanji: levelKanjiProgress,
    vocabulary: levelVocabularyProgress,
    remainingToLevelUp,
    passedLevelUpGate,
  };

  const hasActivity = Boolean(lastActivityAt || liveData?.lastActivityAt);
  const updatedRelativeLabel = formatRelativeTime(liveLastSyncedMs);
  const updatedAbsoluteLabel = formatAbsoluteTime(liveLastSyncedMs);
  const activeRelativeLabel = hasActivity ? formatRelativeTime(liveLastActivityMs) : "Unknown";
  const activeAbsoluteLabel = hasActivity ? formatAbsoluteTime(liveLastActivityMs) : "Unknown";

  const headerSection = (
    <section className="rounded-[2rem] border border-line bg-surface/90 p-3 shadow-[0_24px_80px_rgba(15,111,255,0.15)] sm:p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent sm:text-xs">
              User dashboard
            </p>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="min-w-0 truncate text-xl font-black leading-none text-foreground sm:text-2xl">
                {nickname}
              </h1>
              {viewerMatchesAccount ? (
                <span className="inline-flex shrink-0 select-none items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-800">
                  Me
                </span>
              ) : null}
            </div>
            <p className="mt-1 min-w-0 truncate text-xs font-semibold text-foreground/70 sm:text-sm">
              @{wkUsername}
              {linkedEmail ? <span className="text-foreground/55"> · {linkedEmail}</span> : null}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex shrink-0 flex-col rounded-2xl border border-line bg-surface-muted px-3 py-2 text-right leading-tight sm:px-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">Rank</span>
              <span className="text-xl font-black text-foreground sm:text-3xl">#{globalRank}</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/65">
                of {formatNumber(totalPlayers)} players
              </span>
            </div>

            <UserHeaderMenu
              accountId={accountId}
              viewedWkUsername={wkUsername}
              viewerMenuInfo={viewerMenuInfo}
              hidden={activeTab === "learn" && flashViewerOpen}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

          {canViewAllUserPages && totalPlayers > 1 ? (
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-foreground/70">
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

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface-muted px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">Updated</p>
            <p className="mt-0.5 text-sm font-black text-foreground sm:text-base">{updatedRelativeLabel}</p>
            <p className="text-[10px] font-semibold text-foreground/60 sm:text-xs">{updatedAbsoluteLabel}</p>
          </div>

          <div className="rounded-xl border border-line bg-surface-muted px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">Active</p>
            <p className="mt-0.5 text-sm font-black text-foreground sm:text-base">{activeRelativeLabel}</p>
            <p className="text-[10px] font-semibold text-foreground/60 sm:text-xs">{activeAbsoluteLabel}</p>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <>
      {headerSection}
      {activeTab === "learn" ? (
        <section className="mt-4" role="tabpanel">
          {learnContent}
        </section>
      ) : null}
      {activeTab === "stats" ? (
        <section className="mt-4 space-y-4" role="tabpanel">
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
            wkLevel={effectiveSelectedProgressLevel}
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
        </section>
      ) : null}
      {activeTab === "read" ? (
        <section className="mt-4" role="tabpanel">
          {readContent}
        </section>
      ) : null}
    </>
  );
}
