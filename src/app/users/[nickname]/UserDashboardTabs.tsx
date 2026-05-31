"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { getStoredEnum, setStoredEnum } from "@/lib/clientStorage";
import { formatRelativeFromNow } from "@/lib/timeFormat";
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
  newsContent,
  readContent,
}: Props) {
  const tabStorageKey = `wr:user:${accountId}:dashboard-tab-v2`;
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
  const [activeTab, setActiveTab] = useState<TabId>(initialDashboardTab);
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
    // Avoid SSR/client hydration mismatch: only read localStorage after mount.
    if (initialDashboardTab !== "learn") {
      return;
    }

    const persistedTab = getStoredEnum(
      tabStorageKey,
      ["learn", "stats", "news", "read"] as const,
      "learn",
    );

    if (persistedTab !== activeTab) {
      const restoreTimer = window.setTimeout(() => {
        setActiveTab(persistedTab);
      }, 0);

      return () => {
        window.clearTimeout(restoreTimer);
      };
    }
  }, [activeTab, initialDashboardTab, tabStorageKey]);

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
  function switchTab(next: TabId) {
    setActiveTab(next);
    setStoredEnum(tabStorageKey, next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wr:dashboard-tab-change", { detail: { tab: next } }));
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (activeTab === "learn") {
      params.delete("dashboard");
    } else {
      params.set("dashboard", activeTab);
    }

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }

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
  const activeRelativeLabel = hasActivity ? formatRelativeTime(liveLastActivityMs) : "Unknown";

  const headerSection = (
    <section className="rounded-4xl border border-line bg-surface/90 p-3 shadow-[0_24px_80px_rgba(15,111,255,0.15)] sm:p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate text-xs font-bold uppercase tracking-[0.14em] text-accent">
            View user:
            <span className="ml-1 text-lg font-black normal-case tracking-normal text-foreground sm:text-xl">{nickname}</span>
          </p>
          {viewerMatchesAccount ? (
            <span className="inline-flex shrink-0 select-none items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-800">
              Me
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <p className="shrink-0 text-sm font-black uppercase tracking-[0.06em] text-foreground sm:text-base">
              #{globalRank}
              <span className="ml-1 text-xs font-bold text-foreground/65">/ {formatNumber(totalPlayers)}</span>
            </p>
            <UserHeaderMenu
              accountId={accountId}
              viewedWkUsername={wkUsername}
              viewerMenuInfo={viewerMenuInfo}
              showAdminActions={canViewAllUserPages}
              hidden={activeTab === "learn" && flashViewerOpen}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SegmentedControl
            ariaLabel="User dashboard tabs"
            value={activeTab}
            onChange={switchTab}
            size="md"
            asTabs
            mobileFill
            className="flex w-full items-center rounded-full border border-line bg-surface p-1 sm:inline-flex sm:w-auto"
            options={[
              { value: "learn", label: "Learn" },
              { value: "stats", label: "Stats" },
              { value: "news", label: "News" },
              { value: "read", label: "Read" },
            ]}
          />

          {canViewAllUserPages && totalPlayers > 1 ? (
            <div className="hidden items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-foreground/70 sm:flex">
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

        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-foreground/70 sm:text-sm">
            @{wkUsername}
            {linkedEmail ? <span className="text-foreground/55"> · {linkedEmail}</span> : null}
          </p>
          <p className="shrink-0 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/55 sm:text-xs">
            <span className="sm:hidden">
              Upd {updatedRelativeLabel}
              <span className="mx-1 text-foreground/35">|</span>
              Act {activeRelativeLabel}
            </span>
            <span className="hidden sm:inline">
              Updated {updatedRelativeLabel}
              <span className="mx-2 text-foreground/35">|</span>
              Active {activeRelativeLabel}
            </span>
          </p>
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
      {activeTab === "news" ? (
        <section className="mt-4" role="tabpanel">
          {newsContent}
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
