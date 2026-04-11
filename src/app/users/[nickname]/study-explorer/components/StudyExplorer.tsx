"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";

import type { LevelItem, SrsFilter } from "../../explorerTypes";
import LevelExplorerDetailSection from "../../level-explorer/components/LevelExplorerDetailSection";
import {
  formatNextReviewBadge,
  formatNumber,
  glyphSubtitleForDisplay,
  glyphTextSizeClass,
  statusClass,
  subjectTypePillClass,
  titleForDisplay,
  typeCardClass,
  typeGlyphBoxClass,
} from "../../level-explorer/lib/levelExplorerDisplay";

type StudyQueueItem = LevelItem & {
  assignmentId: number;
  queueType: "review" | "lesson";
};

type QueueResponse = {
  items: StudyQueueItem[];
  counts: {
    all: number;
    reviews: number;
    lessons: number;
  };
};

type Props = {
  accountId: string;
  maxLevel: number;
  showEnglish: boolean;
  studyMode: boolean;
};

const fetcher = async (url: string): Promise<QueueResponse> => {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json()) as QueueResponse & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Could not fetch study queue.");
  }
  return data;
};

function badgeClass(active: boolean): string {
  return active
    ? "border-accent bg-accent text-white"
    : "border-line bg-surface text-foreground hover:bg-surface-muted";
}

export default function StudyExplorer({ accountId, maxLevel, showEnglish, studyMode }: Props) {
  const { data, error, mutate, isLoading } = useSWR(`/api/study/${accountId}/queue`, fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const levelOptions = useMemo(
    () => Array.from({ length: Math.max(1, maxLevel) }, (_, index) => index + 1),
    [maxLevel],
  );
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(() => new Set(levelOptions));
  const [queueFilter, setQueueFilter] = useState<"all" | "review" | "lesson">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "radical" | "kanji" | "vocabulary">("all");
  const [srsFilter, setSrsFilter] = useState<SrsFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submittingByAssignmentId, setSubmittingByAssignmentId] = useState<Set<number>>(new Set());

  const counts = data?.counts ?? { all: 0, reviews: 0, lessons: 0 };

  const allLevelsSelected = selectedLevels.size === levelOptions.length;

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((item) => {
      if (!allLevelsSelected) {
        const itemLevel = item.wkLevel;
        if (typeof itemLevel !== "number" || !selectedLevels.has(itemLevel)) {
          return false;
        }
      }

      if (queueFilter !== "all" && item.queueType !== queueFilter) {
        return false;
      }

      if (typeFilter !== "all" && item.subjectType !== typeFilter) {
        return false;
      }

      if (srsFilter !== "all" && item.status !== srsFilter) {
        return false;
      }

      return true;
    });
  }, [allLevelsSelected, data?.items, queueFilter, selectedLevels, srsFilter, typeFilter]);

  const selectedItem = filteredItems.find((item) => item.subjectId === selectedId) ?? null;
  const selectedMeaningExplanation = selectedItem?.meaningExplanation ?? "-";
  const selectedReadingExplanationRaw = selectedItem?.readingExplanation ?? "";
  const showReadingExplanation = selectedReadingExplanationRaw.trim().length > 0;

  async function submitReview(assignmentId: number, result: "correct" | "wrong") {
    setSubmittingByAssignmentId((prev) => new Set(prev).add(assignmentId));

    try {
      const response = await fetch(`/api/study/${accountId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, result }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not submit review.");
      }

      await mutate();
      window.dispatchEvent(new CustomEvent("wr:user-refreshed", { detail: { accountId } }));
    } catch (submitError) {
      console.error(submitError);
    } finally {
      setSubmittingByAssignmentId((prev) => {
        const next = new Set(prev);
        next.delete(assignmentId);
        return next;
      });
    }
  }

  function toggleLevel(level: number) {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        if (next.size === 1) {
          return next;
        }
        next.delete(level);
        return next;
      }

      next.add(level);
      return next;
    });
  }

  function selectAllLevels() {
    setSelectedLevels(new Set(levelOptions));
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
      <header className="border-b border-line bg-surface-muted px-5 py-4">
        <h2 className="text-xl font-black text-foreground">Study</h2>
        <p className="text-xs uppercase tracking-[0.08em] text-foreground/70">
          Reviews due now and available lessons across all levels
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={selectAllLevels} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(allLevelsSelected)}`}>
            All Levels
          </button>
          {levelOptions.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(selectedLevels.has(level))}`}
            >
              L{level}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setQueueFilter("all")} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(queueFilter === "all")}`}>
            All ({formatNumber(counts.all)})
          </button>
          <button type="button" onClick={() => setQueueFilter("review")} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(queueFilter === "review")}`}>
            Reviews ({formatNumber(counts.reviews)})
          </button>
          <button type="button" onClick={() => setQueueFilter("lesson")} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(queueFilter === "lesson")}`}>
            Lessons ({formatNumber(counts.lessons)})
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {(["all", "radical", "kanji", "vocabulary"] as const).map((type) => (
            <button key={type} type="button" onClick={() => setTypeFilter(type)} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(typeFilter === type)}`}>
              {type}
            </button>
          ))}
          {(["all", "apprentice", "guru", "master", "enlightened", "burned", "locked"] as const).map((status) => (
            <button key={status} type="button" onClick={() => setSrsFilter(status)} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(srsFilter === status)}`}>
              {status}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? <p className="px-5 py-4 text-sm text-foreground/70">Loading study queue...</p> : null}
      {error ? <p className="px-5 py-4 text-sm text-red-700">{error.message}</p> : null}

      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredItems.map((item) => (
            <button
              key={`${item.queueType}-${item.subjectId}`}
              type="button"
              onClick={() => setSelectedId((prev) => (prev === item.subjectId ? null : item.subjectId))}
              className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${typeCardClass(
                item.subjectType,
                selectedItem?.subjectId === item.subjectId,
              )}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-semibold text-foreground/45">#{item.subjectId}</span>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <span className={subjectTypePillClass(item.subjectType)}>{item.subjectType}</span>
                  {typeof item.wkLevel === "number" ? (
                    <span className="subject-pill border-line bg-surface text-foreground">WK{item.wkLevel}</span>
                  ) : null}
                  <span className="subject-pill border-line bg-surface text-foreground">{item.queueType}</span>
                </div>
              </div>
              <p className="mt-2 text-xl font-black leading-tight text-foreground">
                {studyMode
                  ? item.subjectType === "kanji"
                    ? "Kanji"
                    : item.subjectType === "radical"
                      ? "Radical"
                      : "Vocabulary"
                  : titleForDisplay(item, showEnglish)}
              </p>
              <div className={`mt-3 rounded-xl border ${typeGlyphBoxClass(item.subjectType)} px-3 py-2`}>
                <p className={`${glyphTextSizeClass(item.characters)} text-center font-black leading-none`}>{item.characters}</p>
                {!studyMode && glyphSubtitleForDisplay(item) ? (
                  <p className="mt-1 text-center text-sm font-semibold text-foreground/70">{glyphSubtitleForDisplay(item)}</p>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-3 items-center gap-2">
                <span className={`justify-self-start rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(item.status)}`}>
                  {item.status}
                </span>
                {item.queueType === "review" ? (
                  (() => {
                    const badge = formatNextReviewBadge(item.availableAt);
                    if (!badge) return <span />;
                    return <span className={`justify-self-center rounded-full border px-3 py-1 text-xs font-bold uppercase ${badge.className}`}>{badge.label}</span>;
                  })()
                ) : (
                  <span />
                )}
                <span className="justify-self-end rounded-full border border-line bg-surface px-2 py-1 text-xs font-bold text-foreground">
                  SRS {item.srsStage}
                </span>
              </div>
            </button>
          ))}
        </div>

        {selectedItem ? (
          <div className="mt-4 space-y-3">
            <LevelExplorerDetailSection
              selectedItem={selectedItem}
              showEnglish={showEnglish}
              studyMode={studyMode}
              selectedMeaningExplanation={selectedMeaningExplanation}
              selectedReadingExplanationRaw={selectedReadingExplanationRaw}
              showReadingExplanation={showReadingExplanation}
              hasPrimaryRelatedPanel={false}
              hasVisuallySimilarPanel={false}
              hasUsedInVocabularyPanel={false}
              vocabularyKanjiLinks={[]}
              subjectById={new Map()}
              onJumpToRelatedSubject={async () => {}}
              onJumpToKanji={async () => {}}
            />
            {selectedItem.queueType === "review" ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => submitReview(selectedItem.assignmentId, "correct")}
                  disabled={submittingByAssignmentId.has(selectedItem.assignmentId)}
                  className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Correct
                </button>
                <button
                  type="button"
                  onClick={() => submitReview(selectedItem.assignmentId, "wrong")}
                  disabled={submittingByAssignmentId.has(selectedItem.assignmentId)}
                  className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Wrong
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
