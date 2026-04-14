"use client";

import { useEffect, useState } from "react";

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
  const countsStorageKey = `wr:study-queue-counts:${accountId}`;
  const [studyMode, setStudyMode] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("wr:study-mode") === "1";
  });
  const [activeTab, setActiveTab] = useState<"study" | "level" | "jlpt">(() => {
    if (typeof window === "undefined") {
      return "study";
    }

    const raw = new URLSearchParams(window.location.search).get("tab");
    if (raw === "jlpt") return "jlpt";
    if (raw === "level") return "level";
    return "study";
  });
  const [showEnglish, setShowEnglish] = useState(false);
  const [studyCounts, setStudyCounts] = useState<{ reviews: number; lessons: number } | null>(null);
  const [queueMode, setQueueMode] = useState<"review" | "lesson">(() => {
    if (typeof window === "undefined") {
      return "review";
    }

    return window.localStorage.getItem(`wr:study-queue-mode:${accountId}`) === "lesson"
      ? "lesson"
      : "review";
  });

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
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem("wr:study-mode", studyMode ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [studyMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(`wr:study-queue-mode:${accountId}`, queueMode);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [accountId, queueMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const raw = params.get("tab");
    const tabInUrl = raw === "jlpt" ? "jlpt" : raw === "level" ? "level" : "study";
    if (tabInUrl !== activeTab) {
      params.set("tab", activeTab);
      const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState(null, "", next);
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onPopState = () => {
      const raw = new URLSearchParams(window.location.search).get("tab");
      setActiveTab(raw === "jlpt" ? "jlpt" : raw === "level" ? "level" : "study");
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
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
  }, [activeTab]);

  function tabClass(tab: "study" | "level" | "jlpt"): string {
    const active = activeTab === tab;
    return active
      ? "rounded-full border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white"
      : "rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted";
  }

  function queueModeButtonClass(mode: "review" | "lesson", activeMode: "review" | "lesson"): string {
    const active = mode === activeMode;
    if (!active) {
      return "inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted";
    }

    return mode === "review"
      ? "inline-flex h-10 items-center justify-center rounded-full border border-amber-500 bg-amber-500 px-4 text-xs font-bold uppercase tracking-[0.1em] text-white"
      : "inline-flex h-10 items-center justify-center rounded-full border border-sky-500 bg-sky-500 px-4 text-xs font-bold uppercase tracking-[0.1em] text-white";
  }

  return (
    <section className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Explorer tabs">
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
            aria-selected={activeTab === "study"}
            className={tabClass("study")}
            onClick={() => setActiveTab("study")}
          >
            Study
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
            <>
              <button
                type="button"
                onClick={() => setQueueMode("review")}
                className={queueModeButtonClass("review", queueMode)}
              >
                Reviews ({typeof studyCounts?.reviews === "number" ? studyCounts.reviews : "..."})
              </button>
              <button
                type="button"
                onClick={() => setQueueMode("lesson")}
                className={queueModeButtonClass("lesson", queueMode)}
              >
                Lessons ({typeof studyCounts?.lessons === "number" ? studyCounts.lessons : "..."})
              </button>
            </>
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
          studyMode={studyMode}
          userKanjiItems={userKanjiItems}
        />
      </div>
    </section>
  );
}
