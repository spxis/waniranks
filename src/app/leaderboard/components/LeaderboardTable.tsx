"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import LeaderboardDesktop from "./LeaderboardDesktop";
import LeaderboardMobile from "./LeaderboardMobile";
import type { LeaderboardRow, LeaderboardTab, SortKey, SortState } from "../lib/leaderboardTypes";
import { ALL_TABS, TAB_CONFIG } from "../lib/leaderboardTypes";
import {
  isLeaderboardTab,
  isSortDirection,
  isSortKey,
  kanjiCountFromRow,
  learnedKanjiFromRow,
  learnedPercent,
  learnedRadicalsFromRow,
  learnedVocabularyFromRow,
  nextDirection,
  stageCountForSubject,
  subjectLastGuruedAtFromRow,
  subjectTypeForTab,
  tabClass,
} from "../lib/leaderboardUtils";

type Props = {
  rows: LeaderboardRow[];
  canViewAllUserPages: boolean;
  viewerWkUsername: string | null;
};

export default function LeaderboardTable({
  rows,
  canViewAllUserPages,
  viewerWkUsername,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>(() => {
    if (typeof window === "undefined") {
      return "overall";
    }

    const params = new URLSearchParams(window.location.search);
    const tabFromQuery = params.get("tab");
    if (isLeaderboardTab(tabFromQuery)) {
      return tabFromQuery;
    }

    try {
      const tabFromStorage = window.localStorage.getItem("wr:leaderboard:active-tab");
      if (isLeaderboardTab(tabFromStorage)) {
        return tabFromStorage;
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }

    return "overall";
  });

  const [sortByTab, setSortByTab] = useState<Record<LeaderboardTab, SortState>>(() => {
    const defaults: Record<LeaderboardTab, SortState> = {
      overall: TAB_CONFIG.overall.defaultSort,
      radicals: TAB_CONFIG.radicals.defaultSort,
      kanji: TAB_CONFIG.kanji.defaultSort,
      vocabulary: TAB_CONFIG.vocabulary.defaultSort,
    };

    if (typeof window === "undefined") {
      return defaults;
    }

    let output = { ...defaults };

    try {
      const stored = window.localStorage.getItem("wr:leaderboard:sort-by-tab");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Record<LeaderboardTab, SortState>>;
        for (const tab of ALL_TABS) {
          const candidate = parsed?.[tab];
          if (!candidate || !isSortKey(candidate.key) || !isSortDirection(candidate.direction)) {
            continue;
          }

          output[tab] = { key: candidate.key, direction: candidate.direction };
        }
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }

    const params = new URLSearchParams(window.location.search);
    const tabFromQuery = params.get("tab");
    const sortFromQuery = params.get("sort");
    const dirFromQuery = params.get("dir");

    if (isLeaderboardTab(tabFromQuery) && isSortKey(sortFromQuery) && isSortDirection(dirFromQuery)) {
      output = {
        ...output,
        [tabFromQuery]: {
          key: sortFromQuery,
          direction: dirFromQuery,
        },
      };
    }

    return output;
  });

  const expandedStorageKey = "wr:leaderboard:expanded-rows";
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }

    try {
      const stored = window.localStorage.getItem(expandedStorageKey);
      if (!stored) {
        return new Set();
      }

      const parsed = JSON.parse(stored) as string[];
      return Array.isArray(parsed) ? new Set(parsed) : new Set();
    } catch {
      return new Set();
    }
  });

  const [showItemSpreadPanel, setShowItemSpreadPanel] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    try {
      return window.localStorage.getItem("wr:leaderboard:item-spread-open") !== "0";
    } catch {
      return true;
    }
  });

  const [showLevelProgressPanel, setShowLevelProgressPanel] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    try {
      return window.localStorage.getItem("wr:leaderboard:level-progress-open") !== "0";
    } catch {
      return true;
    }
  });

  const validRowIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows]);
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [refreshingRowIds, setRefreshingRowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadAdminStatus() {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const data = (await response.json()) as { authorized?: boolean };
        setAdminAuthorized(Boolean(data.authorized));
      } catch {
        setAdminAuthorized(false);
      }
    }

    loadAdminStatus().catch(() => {
      setAdminAuthorized(false);
    });
  }, []);
  const filteredExpanded = useMemo(
    () => new Set(Array.from(expanded).filter((id) => validRowIds.has(id))),
    [expanded, validRowIds],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(expandedStorageKey, JSON.stringify(Array.from(filteredExpanded)));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [expandedStorageKey, filteredExpanded]);

  useEffect(() => {
    try {
      window.localStorage.setItem("wr:leaderboard:active-tab", activeTab);
      window.localStorage.setItem("wr:leaderboard:sort-by-tab", JSON.stringify(sortByTab));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }

    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    params.set("sort", sortByTab[activeTab].key);
    params.set("dir", sortByTab[activeTab].direction);
    const hash = window.location.hash || "";
    const next = `${window.location.pathname}?${params.toString()}${hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, [activeTab, sortByTab]);

  const persistPanelState = (key: string, value: boolean, setter: (next: boolean) => void) => {
    setter(value);
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(Array.from(prev).filter((rowId) => validRowIds.has(rowId)));
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      try {
        window.localStorage.setItem(expandedStorageKey, JSON.stringify(Array.from(next)));
      } catch {
        // Ignore storage errors in restricted browsing modes.
      }

      return next;
    });
  };

  const activeSort = sortByTab[activeTab];

  const sortedRows = useMemo(() => {
    const rowsCopy = [...rows];

    const getSortValue = (row: LeaderboardRow, key: SortKey): number | string => {
      const radicalsLearned = learnedRadicalsFromRow(row);
      const kanjiLearned = learnedKanjiFromRow(row);
      const vocabularyLearned = learnedVocabularyFromRow(row);
      const kanjiTotal = kanjiCountFromRow(row);
      const activeSubjectType = subjectTypeForTab(activeTab);

      if (key === "nickname") return row.nickname.toLowerCase();
      if (key === "wkLevel") return row.wkLevel;
      if (key === "reviewCount") return row.reviewCount;
      if (key === "score") return row.score;
      if (key === "lastActivityAt") return row.lastActivityAt ? new Date(row.lastActivityAt).getTime() : 0;
      if (key === "radicalLearned") return radicalsLearned;
      if (key === "radicalTotal") return row.radicalCount;
      if (key === "radicalPercent") return learnedPercent(radicalsLearned, row.radicalCount);
      if (key === "kanjiLearned") return kanjiLearned;
      if (key === "kanjiTotal") return kanjiTotal;
      if (key === "kanjiPercent") return learnedPercent(kanjiLearned, kanjiTotal);
      if (key === "vocabularyLearned") return vocabularyLearned;
      if (key === "vocabularyTotal") return row.vocabularyCount;
      if (key === "subjectApprentice") return activeSubjectType ? stageCountForSubject(row, activeSubjectType, "apprentice") : 0;
      if (key === "subjectGuru") return activeSubjectType ? stageCountForSubject(row, activeSubjectType, "guru") : 0;
      if (key === "subjectMaster") return activeSubjectType ? stageCountForSubject(row, activeSubjectType, "master") : 0;
      if (key === "subjectEnlightened") return activeSubjectType ? stageCountForSubject(row, activeSubjectType, "enlightened") : 0;
      if (key === "subjectBurned") return activeSubjectType ? stageCountForSubject(row, activeSubjectType, "burned") : 0;
      if (key === "subjectLastGuruedAt") {
        if (!activeSubjectType) return 0;
        const value = subjectLastGuruedAtFromRow(row, activeSubjectType);
        return value ? new Date(value).getTime() : 0;
      }
      return learnedPercent(vocabularyLearned, row.vocabularyCount);
    };

    rowsCopy.sort((a, b) => {
      const aValue = getSortValue(a, activeSort.key);
      const bValue = getSortValue(b, activeSort.key);
      let base = 0;

      if (typeof aValue === "string" && typeof bValue === "string") {
        base = aValue.localeCompare(bValue);
      } else {
        base = Number(aValue) - Number(bValue);
      }

      if (base === 0) {
        base = b.score - a.score;
      }

      return activeSort.direction === "desc" ? -base : base;
    });

    return rowsCopy;
  }, [rows, activeSort, activeTab]);

  const allRowIds = sortedRows.map((row) => row.id);
  const allExpanded = allRowIds.length > 0 && allRowIds.every((id) => filteredExpanded.has(id));

  const expandAllRows = () => {
    const next = new Set(allRowIds);
    setExpanded(next);
    try {
      window.localStorage.setItem(expandedStorageKey, JSON.stringify(Array.from(next)));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  };

  const collapseAllRows = () => {
    setExpanded(new Set());
    try {
      window.localStorage.setItem(expandedStorageKey, JSON.stringify([]));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  };

  const toggleAllRows = () => {
    if (allExpanded) {
      collapseAllRows();
      return;
    }

    expandAllRows();
  };

  const requestSort = (key: SortKey) => {
    setSortByTab((prev) => ({
      ...prev,
      [activeTab]: {
        key,
        direction: nextDirection(prev[activeTab], key),
      },
    }));
  };

  const refreshUser = async (id: string) => {
    setRefreshingRowIds((prev) => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/accounts/${id}/refresh`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Refresh failed");
      }
      router.refresh();
    } catch {
      // Keep UI stable even if one manual refresh fails.
    } finally {
      setRefreshingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4 sm:px-6">
        {(Object.entries(TAB_CONFIG) as Array<[LeaderboardTab, { label: string }]>).map(([key, tab]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${tabClass(activeTab, key)}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 px-4 sm:px-6">
        <button
          type="button"
          onClick={toggleAllRows}
          disabled={sortedRows.length === 0}
          className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {allExpanded ? "Collapse All" : "Expand All"}
        </button>
      </div>

      <LeaderboardDesktop
        activeTab={activeTab}
        activeSort={activeSort}
        sortedRows={sortedRows}
        canViewAllUserPages={canViewAllUserPages}
        viewerWkUsername={viewerWkUsername}
        filteredExpanded={filteredExpanded}
        showItemSpreadPanel={showItemSpreadPanel}
        showLevelProgressPanel={showLevelProgressPanel}
        onRequestSort={requestSort}
        onToggleRow={toggle}
        canRefreshAdmin={adminAuthorized}
        refreshingRowIds={refreshingRowIds}
        onRefreshUser={refreshUser}
        onToggleItemSpreadPanel={() =>
          persistPanelState("wr:leaderboard:item-spread-open", !showItemSpreadPanel, setShowItemSpreadPanel)
        }
        onToggleLevelProgressPanel={() =>
          persistPanelState("wr:leaderboard:level-progress-open", !showLevelProgressPanel, setShowLevelProgressPanel)
        }
      />

      <LeaderboardMobile
        activeTab={activeTab}
        sortedRows={sortedRows}
        canViewAllUserPages={canViewAllUserPages}
        viewerWkUsername={viewerWkUsername}
        filteredExpanded={filteredExpanded}
        onToggleRow={toggle}
        canRefreshAdmin={adminAuthorized}
        refreshingRowIds={refreshingRowIds}
        onRefreshUser={refreshUser}
      />
    </div>
  );
}
