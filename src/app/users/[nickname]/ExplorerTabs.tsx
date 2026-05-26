"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

import JlptExplorer from "./jlpt-explorer/components/JlptExplorer";
import LevelExplorer from "./level-explorer/components/LevelExplorer";
import StudyExplorer from "./study-explorer/components/StudyExplorer";
import type { JlptItem, Snapshot, SrsFilter, UserKanjiItem } from "./explorerTypes";
import type { StudySrsFilter, StudySrsStageFilter, StudyTypeFilter } from "./study-explorer/lib/studyExplorerTypes";
import { QUEUE_TYPES, type QueueType } from "@/lib/domainConstants";

type Props = {
  accountId: string;
  maxLevel: number;
  accountPendingReviews: number;
  levelItemCountsByLevel: Record<number, number>;
  initialTab?: "study" | "level" | "jlpt";
  initialQueueMode?: QueueType | null;
  initialStudyMode?: boolean | null;
  initialSnapshot: Snapshot;
  initialSrsFilter: SrsFilter;
  jlptItems: JlptItem[];
  userKanjiItems: UserKanjiItem[];
  initialStudyFilters?: {
    viewedLevel: number | null;
    typeFilter: StudyTypeFilter;
    srsFilter: StudySrsFilter;
    srsStageFilter: StudySrsStageFilter | null;
    recentOnly: boolean;
    showLocked: boolean;
  };
};

export default function ExplorerTabs({
  accountId,
  maxLevel,
  accountPendingReviews,
  levelItemCountsByLevel,
  initialQueueMode = null,
  initialStudyMode = null,
  initialSnapshot,
  initialSrsFilter,
  jlptItems,
  userKanjiItems,
  initialStudyFilters,
  initialTab = "study",
}: Props) {
  const previousPageKeyRef = useRef<string | null>(null);
  const countsStorageKey = `wr:study-queue-counts:${accountId}`;
  const showEnglishStorageKey = `wr:explorer-show-english:${accountId}`;
  const isHydrated = typeof window !== "undefined";
  const [dashboardTab, setDashboardTab] = useState<string>("learn");
  const [studyMode, setStudyMode] = useState(() => (typeof initialStudyMode === "boolean" ? initialStudyMode : true));
  const [activeTab, setActiveTab] = useState<"study" | "level" | "jlpt">(initialTab);
  const [showEnglish, setShowEnglish] = useState(false);
  const [studyCounts, setStudyCounts] = useState<{ reviews: number; lessons: number } | null>(null);
  const [queueMode, setQueueMode] = useState<QueueType>(
    initialQueueMode === QUEUE_TYPES.review || initialQueueMode === QUEUE_TYPES.lesson
      ? initialQueueMode
      : QUEUE_TYPES.review,
  );
  const [initialViewerMode, setInitialViewerMode] = useState<"detail" | "flash" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get("tab") === "jlpt" ? "jlpt" : params.get("tab") === "level" ? "level" : "study";
      setActiveTab(urlTab);

      const urlMode = params.get("mode");
      if (urlMode === QUEUE_TYPES.review || urlMode === QUEUE_TYPES.lesson) {
        setQueueMode(urlMode);
      } else if (initialQueueMode !== QUEUE_TYPES.review && initialQueueMode !== QUEUE_TYPES.lesson) {
        setQueueMode(window.localStorage.getItem(`wr:study-queue-mode:${accountId}`) === QUEUE_TYPES.lesson
          ? QUEUE_TYPES.lesson
          : QUEUE_TYPES.review);
      }

      const urlStudyMode = params.get("studyMode");
      if (urlStudyMode === "on" || urlStudyMode === "1") {
        setStudyMode(true);
      } else if (urlStudyMode === "off" || urlStudyMode === "0") {
        setStudyMode(false);
      } else if (typeof initialStudyMode !== "boolean") {
        const storedStudyMode = window.localStorage.getItem("wr:study-mode");
        if (storedStudyMode !== null) {
          setStudyMode(storedStudyMode === "1");
        }
      }

      setShowEnglish(window.localStorage.getItem(showEnglishStorageKey) === "1");

      const viewer = params.get("viewer");
      setInitialViewerMode(viewer === "detail" || viewer === "flash" ? viewer : null);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [accountId, initialQueueMode, initialStudyMode, showEnglishStorageKey]);

  useSWR<{ reviews: number; lessons: number }>(
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
      onSuccess: (nextCounts) => {
        setStudyCounts((prev) => {
          if (prev && prev.reviews === nextCounts.reviews && prev.lessons === nextCounts.lessons) {
            return prev;
          }
          return nextCounts;
        });
        try {
          window.localStorage.setItem(
            countsStorageKey,
            JSON.stringify({
              reviews: nextCounts.reviews,
              lessons: nextCounts.lessons,
              all: nextCounts.reviews + nextCounts.lessons,
            }),
          );
        } catch {
          // Ignore storage errors in restricted browsing modes.
        }
      },
    },
  );

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
          const nextReviews = parsed.reviews;
          const nextLessons = parsed.lessons;
          setStudyCounts((prev) => {
            if (prev && prev.reviews === nextReviews && prev.lessons === nextLessons) {
              return prev;
            }
            return { reviews: nextReviews, lessons: nextLessons };
          });
        }
      } catch {
        // Ignore malformed cache values.
      }
    };

    readCounts();
    window.addEventListener("focus", readCounts);

    return () => {
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
    const studyModeInUrl = params.get("studyMode");
    const nextStudyMode = studyMode ? "on" : "off";
    if (studyModeInUrl !== nextStudyMode) {
      params.set("studyMode", nextStudyMode);
      changed = true;
    }
    if (changed) {
      const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState(null, "", next);
    }
  }, [activeTab, isHydrated, queueMode, studyMode]);

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
      if (urlMode === QUEUE_TYPES.review || urlMode === QUEUE_TYPES.lesson) setQueueMode(urlMode);
      const urlStudyMode = params.get("studyMode");
      if (urlStudyMode === "on" || urlStudyMode === "1") {
        setStudyMode(true);
      } else if (urlStudyMode === "off" || urlStudyMode === "0") {
        setStudyMode(false);
      }
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

  function queueModeSegmentClass(mode: QueueType, activeMode: QueueType): string {
    const active = mode === activeMode;
    if (!active) {
      return "inline-flex h-8 items-center justify-center rounded-full px-4 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted";
    }

    return mode === QUEUE_TYPES.review
      ? "inline-flex h-8 items-center justify-center rounded-full border border-amber-500 bg-amber-500 px-4 text-xs font-bold uppercase tracking-[0.1em] text-white"
      : "inline-flex h-8 items-center justify-center rounded-full border border-sky-500 bg-sky-500 px-4 text-xs font-bold uppercase tracking-[0.1em] text-white";
  }

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface-muted p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <div
          className="inline-flex w-full flex-nowrap items-center gap-0 overflow-x-auto rounded-full border border-line bg-surface p-1 pr-2"
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
            <span className="sm:hidden">WK Explorer</span>
            <span className="hidden sm:inline">WaniKani Explorer</span>
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
        <div className="w-full overflow-x-auto md:overflow-visible">
          <div className="flex min-w-max items-center gap-2 pr-1 md:ml-auto md:min-w-0 md:justify-end">
            {activeTab === "study" ? (
              <div
                className="inline-flex shrink-0 items-center rounded-full border border-line bg-surface p-1"
                role="tablist"
                aria-label="Study queue mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={queueMode === QUEUE_TYPES.review}
                  onClick={() => setQueueMode(QUEUE_TYPES.review)}
                  className={queueModeSegmentClass(QUEUE_TYPES.review, queueMode)}
                >
                  Reviews <span className="ml-0 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({typeof studyCounts?.reviews === "number" ? studyCounts.reviews : "..."})</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={queueMode === QUEUE_TYPES.lesson}
                  onClick={() => setQueueMode(QUEUE_TYPES.lesson)}
                  className={queueModeSegmentClass(QUEUE_TYPES.lesson, queueMode)}
                >
                  Lessons <span className="ml-0 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({typeof studyCounts?.lessons === "number" ? studyCounts.lessons : "..."})</span>
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setStudyMode((prev) => !prev)}
              className={`inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-4 text-xs font-bold uppercase tracking-widest transition ${
                studyMode
                  ? "border-hot bg-hot text-white"
                  : "border-line bg-surface text-foreground hover:bg-surface-muted"
              }`}
            >
              {`Study Mode ${studyMode ? "On" : "Off"}`}
            </button>
          </div>
        </div>
      </div>

      <div className={activeTab === "study" ? "block" : "hidden"}>
        <StudyExplorer
          accountId={accountId}
          maxLevel={maxLevel}
          initialViewerMode={initialViewerMode}
          initialFilters={initialStudyFilters}
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
          isActive={activeTab === "level"}
          maxLevel={maxLevel}
          accountPendingReviews={accountPendingReviews}
          levelItemCountsByLevel={levelItemCountsByLevel}
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
