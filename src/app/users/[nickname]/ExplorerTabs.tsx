"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

import JlptExplorer from "./jlpt-explorer/components/JlptExplorer";
import LevelExplorer from "./level-explorer/components/LevelExplorer";
import StudyExplorer from "./study-explorer/components/StudyExplorer";
import type { JlptItem, Snapshot, SrsFilter, UserKanjiItem } from "./explorerTypes";

type Props = {
  accountId: string;
  maxLevel: number;
  accountPendingReviews: number;
  initialSnapshot: Snapshot;
  initialSrsFilter: SrsFilter;
  jlptItems: JlptItem[];
  userKanjiItems: UserKanjiItem[];
};

export default function ExplorerTabs({
  accountId,
  maxLevel,
  accountPendingReviews,
  initialSnapshot,
  initialSrsFilter,
  jlptItems,
  userKanjiItems,
}: Props) {
  const previousPageKeyRef = useRef<string | null>(null);
  const countsStorageKey = `wr:study-queue-counts:${accountId}`;
  const showEnglishStorageKey = `wr:explorer-show-english:${accountId}`;
  const [isHydrated, setIsHydrated] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<string>("learn");
  const [studyMode, setStudyMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"study" | "level" | "jlpt">("study");
  const [showEnglish, setShowEnglish] = useState(false);
  const [studyCounts, setStudyCounts] = useState<{ reviews: number; lessons: number } | null>(null);
  const [queueMode, setQueueMode] = useState<"review" | "lesson">("review");
  const [initialViewerMode, setInitialViewerMode] = useState<"detail" | "flash" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const rawTab = params.get("tab");
    const tab = rawTab === "jlpt" ? "jlpt" : rawTab === "level" ? "level" : "study";
    setActiveTab(tab);

    const urlMode = params.get("mode");
    if (urlMode === "review" || urlMode === "lesson") {
      setQueueMode(urlMode);
    } else {
      setQueueMode(
        window.localStorage.getItem(`wr:study-queue-mode:${accountId}`) === "lesson"
          ? "lesson"
          : "review",
      );
    }

    setStudyMode(window.localStorage.getItem("wr:study-mode") === "1");
    setShowEnglish(window.localStorage.getItem(showEnglishStorageKey) === "1");

    const viewer = params.get("viewer");
    setInitialViewerMode(viewer === "detail" || viewer === "flash" ? viewer : null);
    setIsHydrated(true);
  }, [accountId, showEnglishStorageKey]);

  const { data: fetchedStudyCounts } = useSWR<{ reviews: number; lessons: number }>(
    `/api/study/${accountId}/counts`,
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      const payload = (await response.json()) as { reviews?: number; lessons?: number; error?: string };
      if (!response.ok || typeof payload.reviews !== "number" || typeof payload.lessons !== "number") {
        throw new Error(payload.error ?? "Could not load study counts.");
      }

      return { reviews: payload.reviews, lessons: payload.lessons };
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 30_000,
    },
  );

  useEffect(() => {
    if (!fetchedStudyCounts) {
      return;
    }

    setStudyCounts(fetchedStudyCounts);
    try {
      window.localStorage.setItem(
        countsStorageKey,
        JSON.stringify({
          reviews: fetchedStudyCounts.reviews,
          lessons: fetchedStudyCounts.lessons,
          all: fetchedStudyCounts.reviews + fetchedStudyCounts.lessons,
        }),
      );
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [countsStorageKey, fetchedStudyCounts]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const readCounts = () => {
      const raw = window.localStorage.getItem(countsStorageKey);
      if (!raw) {
        return;
      }

      try {
        const parsed = JSON.parse(raw) as { reviews?: number; lessons?: number };
        if (typeof parsed.reviews === "number" && typeof parsed.lessons === "number") {
          setStudyCounts({ reviews: parsed.reviews, lessons: parsed.lessons });
        }
      } catch {
        // Ignore malformed cache values.
      }
    };

    const onStudyCountsUpdated = (event: Event) => {
      const custom = event as CustomEvent<{ accountId?: string; reviews?: number; lessons?: number }>;
      if (custom.detail?.accountId !== accountId) {
        return;
      }

      if (typeof custom.detail?.reviews === "number" && typeof custom.detail?.lessons === "number") {
        setStudyCounts({ reviews: custom.detail.reviews, lessons: custom.detail.lessons });
        return;
      }

      readCounts();
    };

    readCounts();
    window.addEventListener("wr:study-counts-updated", onStudyCountsUpdated as EventListener);
    window.addEventListener("focus", readCounts);

    return () => {
      window.removeEventListener("wr:study-counts-updated", onStudyCountsUpdated as EventListener);
      window.removeEventListener("focus", readCounts);
    };
  }, [accountId, countsStorageKey]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem("wr:study-mode", studyMode ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [isHydrated, studyMode]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(`wr:study-queue-mode:${accountId}`, queueMode);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [accountId, isHydrated, queueMode]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const raw = params.get("tab");
    const tabInUrl = raw === "jlpt" ? "jlpt" : raw === "level" ? "level" : "study";
    let changed = false;
    if (tabInUrl !== activeTab) {
      params.set("tab", activeTab);
      changed = true;
    }
    const modeInUrl = params.get("mode");
    if (modeInUrl !== queueMode) {
      params.set("mode", queueMode);
      changed = true;
    }
    if (changed) {
      const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState(null, "", next);
    }
  }, [activeTab, isHydrated, queueMode]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    const pageKey = activeTab === "study" ? `${activeTab}:${queueMode}` : activeTab;
    if (previousPageKeyRef.current === null) {
      previousPageKeyRef.current = pageKey;
      return;
    }

    if (previousPageKeyRef.current !== pageKey) {
      window.dispatchEvent(
        new CustomEvent("wr:explorer-page-change", {
          detail: { activeTab, queueMode },
        }),
      );
      previousPageKeyRef.current = pageKey;
    }
  }, [activeTab, isHydrated, queueMode]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(showEnglishStorageKey, showEnglish ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [isHydrated, showEnglish, showEnglishStorageKey]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveTab(params.get("tab") === "jlpt" ? "jlpt" : params.get("tab") === "level" ? "level" : "study");
      const urlMode = params.get("mode");
      if (urlMode === "review" || urlMode === "lesson") setQueueMode(urlMode);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const query = (params.get("findLevel") ?? params.get("findJlpt") ?? params.get("findStudy") ?? "").trim();
    if (!query) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("wr:explorer-search", {
        detail: { query, scope: activeTab },
      }),
    );
  }, [activeTab, isHydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDashboardTabChange = (event: Event) => {
      const custom = event as CustomEvent<{ tab?: string }>;
      setDashboardTab(custom.detail?.tab ?? "learn");
    };
    window.addEventListener("wr:dashboard-tab-change", onDashboardTabChange as EventListener);
    return () => {
      window.removeEventListener("wr:dashboard-tab-change", onDashboardTabChange as EventListener);
    };
  }, []);

  if (dashboardTab !== "learn") return null;

  function tabClass(tab: "study" | "level" | "jlpt"): string {
    const active = activeTab === tab;
    return active
      ? "inline-flex h-8 items-center justify-center rounded-full border border-accent bg-accent px-4 text-xs font-bold uppercase tracking-[0.1em] text-white"
      : "inline-flex h-8 items-center justify-center rounded-full px-4 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted";
  }

  function queueModeSegmentClass(mode: "review" | "lesson", activeMode: "review" | "lesson"): string {
    const active = mode === activeMode;
    if (!active) {
      return "inline-flex h-8 items-center justify-center rounded-full px-4 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted";
    }

    return mode === "review"
      ? "inline-flex h-8 items-center justify-center rounded-full border border-amber-500 bg-amber-500 px-4 text-xs font-bold uppercase tracking-[0.1em] text-white"
      : "inline-flex h-8 items-center justify-center rounded-full border border-sky-500 bg-sky-500 px-4 text-xs font-bold uppercase tracking-[0.1em] text-white";
  }

  return (
    <section className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <div
          className="inline-flex flex-wrap items-center rounded-full border border-line bg-surface p-1"
          role="tablist"
          aria-label="Explorer tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "study"}
            className={tabClass("study")}
            onClick={() => setActiveTab("study")}
          >
            Study
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "level"}
            className={tabClass("level")}
            onClick={() => setActiveTab("level")}
          >
            WaniKani Explorer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "jlpt"}
            className={tabClass("jlpt")}
            onClick={() => setActiveTab("jlpt")}
          >
            JLPT Explorer
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          {activeTab === "study" ? (
            <div
              className="inline-flex items-center rounded-full border border-line bg-surface p-1"
              role="tablist"
              aria-label="Study queue mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={queueMode === "review"}
                onClick={() => setQueueMode("review")}
                className={queueModeSegmentClass("review", queueMode)}
              >
                Reviews ({typeof studyCounts?.reviews === "number" ? studyCounts.reviews : "..."})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={queueMode === "lesson"}
                onClick={() => setQueueMode("lesson")}
                className={queueModeSegmentClass("lesson", queueMode)}
              >
                Lessons ({typeof studyCounts?.lessons === "number" ? studyCounts.lessons : "..."})
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setStudyMode((prev) => !prev)}
            className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-xs font-bold uppercase tracking-[0.1em] transition ${
              studyMode
                ? "border-hot bg-hot text-white"
                : "border-line bg-surface text-foreground hover:bg-surface-muted"
            }`}
          >
            Study Mode {studyMode ? "On" : "Off"}
          </button>
        </div>
      </div>

      <div className={activeTab === "study" ? "block" : "hidden"}>
        <StudyExplorer
          accountId={accountId}
          maxLevel={maxLevel}
          initialViewerMode={initialViewerMode}
          showEnglish={showEnglish}
          onToggleShowEnglish={() => setShowEnglish((prev) => !prev)}
          canToggleEnglish={!studyMode}
          studyMode={studyMode}
          queueMode={queueMode}
        />
      </div>

      <div className={activeTab === "level" ? "block" : "hidden"}>
        <LevelExplorer
          accountId={accountId}
          maxLevel={maxLevel}
          accountPendingReviews={accountPendingReviews}
          initialSnapshot={initialSnapshot}
          initialSrsFilter={initialSrsFilter}
          showEnglish={showEnglish}
          canToggleEnglish={!studyMode}
          onToggleShowEnglish={() => setShowEnglish((prev) => !prev)}
          studyMode={studyMode}
        />
      </div>

      <div className={activeTab === "jlpt" ? "block" : "hidden"}>
        <JlptExplorer
          accountId={accountId}
          isActive={activeTab === "jlpt"}
          items={jlptItems}
          showEnglish={showEnglish}
          canToggleEnglish={!studyMode}
          onToggleShowEnglish={() => setShowEnglish((prev) => !prev)}
          studyMode={studyMode}
          userKanjiItems={userKanjiItems}
        />
      </div>
    </section>
  );
}
