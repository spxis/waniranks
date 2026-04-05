"use client";

import { useEffect, useState } from "react";

import ExplorerSearchBar from "./ExplorerSearchBar";
import JlptExplorer from "./JlptExplorer";
import LevelExplorer from "./LevelExplorer";

type LevelItem = {
  subjectId: number;
  subjectType?: "kanji" | "radical" | "vocabulary";
  wkLevel?: number;
  characters: string;
  meanings: string[];
  readings?: string[];
  primaryReadings?: string[];
  radicals?: Array<{
    subjectId: number;
    label: string;
    wkLevel?: number | null;
    reading?: string | null;
  }>;
  visuallySimilar?: Array<{
    subjectId: number;
    label: string;
    wkLevel?: number | null;
    reading?: string | null;
  }>;
  usedInVocabulary?: Array<{
    subjectId: number;
    label: string;
    wkLevel?: number | null;
    reading?: string | null;
  }>;
  componentKanji?: Array<{
    subjectId: number;
    label: string;
    wkLevel?: number | null;
    reading?: string | null;
  }>;
  meaningExplanation?: string;
  readingExplanation?: string;
  jlptLevel?: number | null;
  srsStage: number;
  status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
  startedAt?: string | null;
  passedAt?: string | null;
  availableAt: string | null;
};

type Snapshot = {
  level: number;
  kanjiTotal: number;
  kanjiLearned: number;
  kanjiGuruPlus: number;
  kanjiLocked: number;
  estimatedHoursRemaining: number | null;
  items: LevelItem[];
  syncedAt?: string;
};

type JlptItem = {
  kanji: string;
  nLevel: number;
  strokeCount: number | null;
  primaryMeaning: string | null;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  nanoriReadings: string[];
};

type SrsFilter = "all" | "apprentice" | "guru" | "master" | "enlightened" | "burned" | "locked";

type Props = {
  accountId: string;
  maxLevel: number;
  initialSnapshot: Snapshot;
  initialSrsFilter: SrsFilter;
  jlptItems: JlptItem[];
  userKanjiItems: Array<{
    subjectId?: number;
    characters: string;
    meanings?: string[];
    primaryReadings?: string[];
    readings?: string[];
    meaningExplanation?: string;
    readingExplanation?: string;
    startedAt?: string | null;
    passedAt?: string | null;
    availableAt?: string | null;
    status?: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
    srsStage?: number;
    wkLevel?: number | null;
  }>;
};

export default function ExplorerTabs({
  accountId,
  maxLevel,
  initialSnapshot,
  initialSrsFilter,
  jlptItems,
  userKanjiItems,
}: Props) {
  const [activeTab, setActiveTab] = useState<"level" | "jlpt">("level");
  const [showEnglish, setShowEnglish] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const query = (params.get("findLevel") ?? params.get("findJlpt") ?? "").trim();
    if (!query) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("wr:explorer-search", {
        detail: { query, scope: activeTab },
      }),
    );
  }, [activeTab]);

  function tabClass(tab: "level" | "jlpt"): string {
    const active = activeTab === tab;
    return active
      ? "rounded-full border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white"
      : "rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted";
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
            aria-selected={activeTab === "jlpt"}
            className={tabClass("jlpt")}
            onClick={() => setActiveTab("jlpt")}
          >
            JLPT Explorer
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ExplorerSearchBar scope={activeTab} />
          <button
            type="button"
            onClick={() => setShowEnglish((prev) => !prev)}
            className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.1em] text-foreground transition hover:bg-surface-muted"
          >
            {showEnglish ? "Hide English" : "Show English"}
          </button>
        </div>
      </div>

      <div className={activeTab === "level" ? "block" : "hidden"}>
        <LevelExplorer
          accountId={accountId}
          maxLevel={maxLevel}
          initialSnapshot={initialSnapshot}
          initialSrsFilter={initialSrsFilter}
          showEnglish={showEnglish}
        />
      </div>

      <div className={activeTab === "jlpt" ? "block" : "hidden"}>
        <JlptExplorer
          items={jlptItems}
          showEnglish={showEnglish}
          userKanjiItems={userKanjiItems}
        />
      </div>
    </section>
  );
}
