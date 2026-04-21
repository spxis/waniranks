"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { LevelItem, RelatedReference } from "@/app/users/[nickname]/explorerTypes";
import LevelExplorerDetailSection from "@/app/users/[nickname]/level-explorer/components/LevelExplorerDetailSection";
import type { VocabularyKanjiLink } from "@/app/users/[nickname]/level-explorer/components/LevelExplorerReferenceCards";
import { stripHtml } from "@/app/users/[nickname]/level-explorer/lib/levelExplorerDisplay";
import { hasRenderableRelatedItems } from "@/app/users/[nickname]/study-explorer/components/StudyReviewModalHelpers";
import type { StudyQueueItem } from "@/app/users/[nickname]/study-explorer/lib/studyExplorerTypes";
import { VIEW_GLYPH_EVENT, type ViewGlyphViewerPayload } from "@/lib/viewGlyphViewer";

function viewerTitle(item: StudyQueueItem): string {
  if (item.subjectType === "kanji") return "View Kanji";
  if (item.subjectType === "radical") return "View Radical";
  return "View Vocabulary";
}

function firstNonEmpty(values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "-";
}

export default function ViewGlyphModalHost() {
  const [items, setItems] = useState<StudyQueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [accountId, setAccountId] = useState("");
  const [showEnglish, setShowEnglish] = useState(true);
  const [customTitle, setCustomTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<ViewGlyphViewerPayload>).detail;
      if (!detail?.items || detail.items.length === 0) {
        return;
      }

      setItems(detail.items);
      setIndex(Math.max(0, Math.min(detail.startIndex ?? 0, detail.items.length - 1)));
      setAccountId(detail.accountId ?? "");
      setCustomTitle(detail.title);
    };

    window.addEventListener(VIEW_GLYPH_EVENT, onOpen);
    return () => {
      window.removeEventListener(VIEW_GLYPH_EVENT, onOpen);
    };
  }, []);

  const item = items[index] ?? null;

  const closeModal = useCallback(() => {
    setItems([]);
    setIndex(0);
    setAccountId("");
    setCustomTitle(undefined);
  }, []);

  const subjectById = useMemo(() => {
    const map = new Map<number, LevelItem>();
    for (const entry of items) {
      map.set(entry.subjectId, entry);
    }
    return map;
  }, [items]);

  const createSyntheticItem = useCallback(
    (related: RelatedReference, subjectType: "radical" | "kanji" | "vocabulary"): StudyQueueItem | null => {
      if (!item) return null;

      return {
        assignmentId: -1,
        queueType: "review",
        subjectId: related.subjectId,
        subjectType,
        wkLevel: related.wkLevel ?? item.wkLevel,
        characters: firstNonEmpty([related.label]),
        meanings: [firstNonEmpty([related.meaning, "-"])],
        readings: related.reading ? [related.reading] : [],
        primaryReadings: related.reading ? [related.reading] : [],
        radicals: [],
        visuallySimilar: [],
        usedInVocabulary: [],
        componentKanji: [],
        meaningExplanation: undefined,
        readingExplanation: undefined,
        jlptLevel: item.jlptLevel ?? null,
        jlptMeta: null,
        srsStage: item.srsStage,
        status: item.status,
        startedAt: null,
        passedAt: null,
        availableAt: null,
      };
    },
    [item],
  );

  const openBySubject = useCallback(
    (subjectId: number, fallbackType: "radical" | "kanji" | "vocabulary") => {
      const existingIndex = items.findIndex((entry) => entry.subjectId === subjectId);
      if (existingIndex >= 0) {
        setIndex(existingIndex);
        return;
      }

      if (!item) {
        return;
      }

      const allRelated: Array<{ ref: RelatedReference; type: "radical" | "kanji" | "vocabulary" }> = [
        ...((item.radicals as RelatedReference[] | undefined) ?? []).map((ref) => ({ ref, type: "radical" as const })),
        ...((item.visuallySimilar as RelatedReference[] | undefined) ?? []).map((ref) => ({ ref, type: "kanji" as const })),
        ...((item.componentKanji as RelatedReference[] | undefined) ?? []).map((ref) => ({ ref, type: "kanji" as const })),
        ...((item.usedInVocabulary as RelatedReference[] | undefined) ?? []).map((ref) => ({
          ref,
          type: item.subjectType === "radical" ? ("kanji" as const) : ("vocabulary" as const),
        })),
      ];

      const found = allRelated.find((entry) => entry.ref.subjectId === subjectId);
      const synthetic = createSyntheticItem(found?.ref ?? { subjectId, label: "-" }, found?.type ?? fallbackType);
      if (!synthetic) {
        return;
      }

      setItems([synthetic]);
      setIndex(0);
    },
    [createSyntheticItem, item, items],
  );

  useEffect(() => {
    if (!item) {
      return;
    }

    const onKeyDownCapture = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((prev) => Math.min(items.length - 1, prev + 1));
        return;
      }

      event.preventDefault();
    };

    const onKeyUpCapture = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      event.preventDefault();
    };

    const { overflow, overscrollBehavior } = document.body.style;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";

    window.addEventListener("keydown", onKeyDownCapture, true);
    window.addEventListener("keyup", onKeyUpCapture, true);

    return () => {
      window.removeEventListener("keydown", onKeyDownCapture, true);
      window.removeEventListener("keyup", onKeyUpCapture, true);
      document.body.style.overflow = overflow;
      document.body.style.overscrollBehavior = overscrollBehavior;
    };
  }, [closeModal, item, items.length]);

  if (!item) {
    return null;
  }

  const selectedMeaningExplanation = stripHtml(item.meaningExplanation) || "-";
  const selectedReadingExplanationRaw = stripHtml(item.readingExplanation);
  const showReadingExplanation = selectedReadingExplanationRaw.length > 0;
  const hasPrimaryRelatedPanel = hasRenderableRelatedItems(
    item.subjectType === "vocabulary"
      ? (item.componentKanji as RelatedReference[] | undefined)
      : (item.radicals as RelatedReference[] | undefined),
  );
  const hasVisuallySimilarPanel = hasRenderableRelatedItems(item.visuallySimilar as RelatedReference[] | undefined);
  const hasUsedInVocabularyPanel = hasRenderableRelatedItems(item.usedInVocabulary as RelatedReference[] | undefined);

  const vocabularyKanjiLinks: VocabularyKanjiLink[] =
    item.subjectType === "vocabulary"
      ? ((item.componentKanji as RelatedReference[] | undefined) ?? [])
          .filter((entry) => entry.label.trim().length > 0 && entry.label.trim() !== "-")
          .map((entry) => ({
            char: entry.label,
            subjectId: entry.subjectId,
            reading: entry.reading ?? "-",
            wkLevel: entry.wkLevel ?? null,
          }))
      : [];

  return (
    <div className="fixed inset-0 z-[90] bg-[rgba(6,12,26,0.56)] p-3 backdrop-blur-[1px] sm:p-6">
      <div className="mx-auto flex h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_20px_65px_rgba(0,0,0,0.42)]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-line bg-surface-muted px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
          >
            Close
          </button>
          <p className="truncate text-center text-xs font-black uppercase tracking-[0.1em] text-foreground/80 sm:text-sm">
            {customTitle ?? viewerTitle(item)}
          </p>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
              disabled={index <= 0}
              className="rounded-full border border-line bg-surface px-2 py-1 text-[11px] font-black uppercase text-foreground disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setIndex((prev) => Math.min(items.length - 1, prev + 1))}
              disabled={index >= items.length - 1}
              className="rounded-full border border-line bg-surface px-2 py-1 text-[11px] font-black uppercase text-foreground disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <LevelExplorerDetailSection
            accountId={accountId}
            selectedItem={item}
            showEnglish={showEnglish}
            canToggleEnglish
            onToggleShowEnglish={() => setShowEnglish((prev) => !prev)}
            hideTimeStats={false}
            studyMode={false}
            selectedMeaningExplanation={selectedMeaningExplanation}
            selectedReadingExplanationRaw={selectedReadingExplanationRaw}
            showReadingExplanation={showReadingExplanation}
            hasPrimaryRelatedPanel={hasPrimaryRelatedPanel}
            hasVisuallySimilarPanel={hasVisuallySimilarPanel}
            hasUsedInVocabularyPanel={hasUsedInVocabularyPanel}
            vocabularyKanjiLinks={vocabularyKanjiLinks}
            subjectById={subjectById}
            onJumpToRelatedSubject={async (subjectId) => {
              const fallback = item.subjectType === "radical" ? "kanji" : "vocabulary";
              openBySubject(subjectId, fallback);
            }}
            onJumpToKanji={async (subjectId) => {
              openBySubject(subjectId, "kanji");
            }}
          />
        </div>
      </div>
    </div>
  );
}
