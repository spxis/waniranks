import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { toHiragana, toKatakana } from "wanakana";

import type {
  ReviewOutcome,
  StudyQueueItem,
  SubmitFeedback,
  SubmitInFlight,
} from "../lib/studyExplorerTypes";
import {
  formatRelativeFromNow,
  glyphTextSizeClass,
  shortSubjectTypeLabel,
  statusClass,
  statusShortLabel,
  subjectTypePillClass,
  typeGlyphBoxClass,
} from "../../level-explorer/lib/levelExplorerDisplay";
import LevelExplorerReviewStatsCard from "../../level-explorer/components/LevelExplorerReviewStatsCard";
import { parseWordExamples } from "../../jlpt-explorer/lib/jlptExplorerContentHelpers";

type RelatedReference = {
  subjectId: number;
  label: string;
  wkLevel?: number | null;
  reading?: string | null;
  meaning?: string | null;
};

type Props = {
  accountId: string;
  studyMode: boolean;
  selectedItem: StudyQueueItem | null;
  selectedIndex: number;
  filteredTotal: number;
  prevLabel: string | null;
  nextLabel: string | null;
  isAnswerRevealed: boolean;
  isSubmittingSelected: boolean;
  submitInFlight: SubmitInFlight | null;
  submitFeedback: SubmitFeedback | null;
  reviewOutcomeByAssignmentId: Record<number, ReviewOutcome>;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onRestartFromBeginning: (() => void) | null;
  onReveal: (assignmentId: number) => void;
  onSubmit: (assignmentId: number, result: "correct" | "wrong") => void;
};

function relatedTileLabelClass(label: string): string {
  const length = Array.from(label).length;
  if (length <= 2) return "text-4xl";
  if (length <= 4) return "text-3xl";
  return "text-xl";
}

function hasRenderableRelatedItems(items: RelatedReference[] | undefined): boolean {
  if (!items || items.length === 0) {
    return false;
  }

  return items.some((item) =>
    item.label
      .split(/[、,]/)
      .map((part) => part.trim())
      .some((part) => Boolean(part) && part !== "-"),
  );
}

function relatedTiles(items: RelatedReference[] | undefined): JSX.Element {
  if (!items || items.length === 0) {
    return <p className="mt-1 text-sm font-semibold text-foreground/70">-</p>;
  }

  const expanded = items.flatMap((item) => {
    const parts = item.label
      .split(/[、,]/)
      .map((part) => part.trim())
      .filter((part) => Boolean(part) && part !== "-");

    if (parts.length <= 1) {
      const normalizedLabel = item.label.trim();
      if (!normalizedLabel || normalizedLabel === "-") {
        return [];
      }

      return [{ label: normalizedLabel, reading: item.reading?.trim() || null, key: `${item.subjectId}-${normalizedLabel}` }];
    }

    return parts.map((part, index) => ({
      label: part,
      reading: null,
      key: `${item.subjectId}-${part}-${index}`,
    }));
  });

  if (expanded.length === 0) {
    return <p className="mt-1 text-sm font-semibold text-foreground/70">-</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {expanded.map((entry) => (
        <span
          key={entry.key}
          className="inline-flex min-w-[4.5rem] flex-col items-center rounded-xl border border-line bg-surface px-3 py-2 text-center"
        >
          <span className={`font-black leading-none text-foreground ${relatedTileLabelClass(entry.label)}`}>
            {entry.label}
          </span>
          {entry.reading ? (
            <span className="mt-1 text-xs font-semibold leading-none text-foreground/70">{entry.reading}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function metricCard(label: string, value: string): JSX.Element {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">{label}</p>
      <p className="mt-1 text-sm font-black text-foreground/95">{value}</p>
    </div>
  );
}

function readingCard(label: string, value: string): JSX.Element {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">{label}</p>
      <p className="mt-1 text-2xl font-black leading-tight text-foreground/95">{value}</p>
    </div>
  );
}

function readingDualScriptCard(label: string, hiraganaValue: string, katakanaValue: string): JSX.Element {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-2xl font-black leading-tight text-foreground/95">{hiraganaValue}</p>
        <p className="text-right text-2xl font-black leading-tight text-foreground/95">{katakanaValue}</p>
      </div>
    </div>
  );
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
}

function formatTimestampWithRelative(value: string | null | undefined): string {
  const absolute = formatTimestamp(value);
  if (absolute === "-") {
    return "-";
  }

  const relative = formatRelativeFromNow(value);
  return relative ? `${absolute} (${relative})` : absolute;
}

export default function StudyReviewModal({
  accountId,
  studyMode,
  selectedItem,
  selectedIndex,
  filteredTotal,
  prevLabel,
  nextLabel,
  isAnswerRevealed,
  isSubmittingSelected,
  submitInFlight,
  submitFeedback,
  reviewOutcomeByAssignmentId,
  onClose,
  onPrev,
  onNext,
  onRestartFromBeginning,
  onReveal,
  onSubmit,
}: Props) {
  const usedInWordsStorageKey = "wr:study-modal:used-in-words-collapsed";
  const usedKanjiStorageKey = "wr:study-modal:used-kanji-collapsed";
  const viewerModeStorageKey = "wr:study-modal:viewer-mode";
  const [usedInWordsCollapsed, setUsedInWordsCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      return window.localStorage.getItem(usedInWordsStorageKey) === "1";
    } catch {
      return false;
    }
  });
  const [usedKanjiCollapsed, setUsedKanjiCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      return window.localStorage.getItem(usedKanjiStorageKey) === "1";
    } catch {
      return false;
    }
  });
  const [viewerMode, setViewerMode] = useState<"detail" | "flash">(() => {
    if (typeof window === "undefined") {
      return "detail";
    }

    try {
      const raw = window.localStorage.getItem(viewerModeStorageKey);
      return raw === "flash" ? "flash" : "detail";
    } catch {
      return "detail";
    }
  });
  const [flashRevealKey, setFlashRevealKey] = useState<string | null>(null);
  const [flashCycleDoneKey, setFlashCycleDoneKey] = useState<string | null>(null);
  const flashTouchStartRef = useRef<{ x: number; y: number; ts: number } | null>(null);
  const currentFlashKey = `${viewerMode}:${selectedItem?.assignmentId ?? "none"}`;
  const flashRevealed = flashRevealKey === currentFlashKey;
  const currentFlashCycleKey = `${viewerMode}:${selectedItem?.assignmentId ?? "none"}:${selectedIndex}:${filteredTotal}`;
  const flashCycleDone = flashCycleDoneKey === currentFlashCycleKey;
  const canUseFlashCycleNext = !studyMode && viewerMode === "flash" && filteredTotal > 0;
  const displayIndex = filteredTotal > 0 ? Math.min(selectedIndex + 1, filteredTotal) : 0;
  const displayTotal = filteredTotal;

  const goPrev = useCallback(() => {
    if (!onPrev) {
      return;
    }

    setFlashCycleDoneKey(null);
    onPrev();
  }, [onPrev]);

  const goNextItem = useCallback(() => {
    if (!onNext) {
      return;
    }

    setFlashCycleDoneKey(null);
    onNext();
  }, [onNext]);

  const advanceFlashOrNext = useCallback(() => {
    if (onNext) {
      goNextItem();
      return;
    }

    if (!canUseFlashCycleNext) {
      return;
    }

    if (!flashCycleDone) {
      setFlashCycleDoneKey(currentFlashCycleKey);
      return;
    }

    setFlashCycleDoneKey(null);
    onRestartFromBeginning?.();
  }, [
    canUseFlashCycleNext,
    currentFlashCycleKey,
    flashCycleDone,
    goNextItem,
    onNext,
    onRestartFromBeginning,
  ]);

  const handleFlashTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    flashTouchStartRef.current = { x: touch.clientX, y: touch.clientY, ts: Date.now() };
  }, []);

  const handleFlashTouchEnd = useCallback((event: React.TouchEvent) => {
    const start = flashTouchStartRef.current;
    flashTouchStartRef.current = null;
    if (!start) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const dt = Date.now() - start.ts;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const isHorizontalSwipe = absDx >= 56 && absDx > absDy * 1.25 && dt <= 750;
    const isVerticalSwipe = absDy >= 56 && absDy > absDx * 1.25 && dt <= 750;

    if (isHorizontalSwipe) {
      if (dx < 0) {
        advanceFlashOrNext();
        return;
      }

      goPrev();
      return;
    }

    if (!isVerticalSwipe) {
      return;
    }

    if (dy < 0 && !flashCycleDone && !flashRevealed) {
      setFlashRevealKey(currentFlashKey);
    }
  }, [advanceFlashOrNext, currentFlashKey, flashCycleDone, flashRevealed, goPrev]);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    const { overflow, overscrollBehavior } = document.body.style;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";

    return () => {
      document.body.style.overflow = overflow;
      document.body.style.overscrollBehavior = overscrollBehavior;
    };
  }, [selectedItem]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedItem) {
        return;
      }

      const requiresReveal = studyMode && selectedItem.queueType === "review";
      const key = event.key;
      const lowerKey = key.toLowerCase();

      if (!studyMode && viewerMode === "flash" && !flashRevealed && key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        setFlashRevealKey(currentFlashKey);
        return;
      }

      if (
        key === "Escape" ||
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === " " ||
        key === "Enter" ||
        lowerKey === "a" ||
        lowerKey === "w" ||
        lowerKey === "s" ||
        lowerKey === "d" ||
        lowerKey === "j" ||
        lowerKey === "k" ||
        key === "1" ||
        key === "2"
      ) {
        event.preventDefault();
      }

      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowLeft" && onPrev) {
        goPrev();
        return;
      }

      if ((event.key === "a" || event.key === "A") && onPrev) {
        goPrev();
        return;
      }

      if (event.key === "ArrowRight" && (onNext || canUseFlashCycleNext)) {
        advanceFlashOrNext();
        return;
      }

      if (event.key === "ArrowUp" && onPrev) {
        goPrev();
        return;
      }

      if (event.key === "ArrowDown" && (onNext || canUseFlashCycleNext)) {
        advanceFlashOrNext();
        return;
      }

      if ((event.key === "d" || event.key === "D") && (onNext || canUseFlashCycleNext)) {
        advanceFlashOrNext();
        return;
      }

      if ((event.key === "w" || event.key === "W") && onPrev) {
        goPrev();
        return;
      }

      if ((event.key === "s" || event.key === "S") && onNext) {
        goNextItem();
        return;
      }

      if (event.key === "Enter" && event.shiftKey && onPrev) {
        goPrev();
        return;
      }

      if (event.key === "Enter" && (onNext || canUseFlashCycleNext)) {
        advanceFlashOrNext();
        return;
      }

      if (event.key === " ") {
        if (!studyMode && viewerMode === "flash" && !flashRevealed && !event.shiftKey) {
          setFlashRevealKey(currentFlashKey);
          return;
        }

        if (requiresReveal && !isAnswerRevealed && selectedItem.queueType === "review") {
          onReveal(selectedItem.assignmentId);
          return;
        }

        if (event.shiftKey && onPrev) {
          goPrev();
          return;
        }

        if (onNext || canUseFlashCycleNext) {
          advanceFlashOrNext();
          return;
        }
      }

      if ((event.key === "1" || event.key === "2" || event.key === "j" || event.key === "J" || event.key === "k" || event.key === "K") && selectedItem.queueType === "review") {
        if (!studyMode) {
          return;
        }

        const canSubmit = !requiresReveal || isAnswerRevealed;
        if (!canSubmit) {
          return;
        }

        const lower = event.key.toLowerCase();
        const isWrong = event.key === "1" || lower === "j";
        onSubmit(selectedItem.assignmentId, isWrong ? "wrong" : "correct");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isAnswerRevealed,
    goNextItem,
    goPrev,
    onClose,
    onNext,
    onRestartFromBeginning,
    onPrev,
    onReveal,
    onSubmit,
    viewerMode,
    flashRevealed,
    flashCycleDone,
    canUseFlashCycleNext,
    advanceFlashOrNext,
    currentFlashKey,
    currentFlashCycleKey,
    selectedItem,
    selectedIndex,
    studyMode,
    filteredTotal,
  ]);

  if (!selectedItem) {
    return null;
  }

  let correct = 0;
  let skipped = 0;
  let wrong = 0;
  for (const outcome of Object.values(reviewOutcomeByAssignmentId)) {
    if (outcome === "correct") correct += 1;
    else if (outcome === "wrong") wrong += 1;
    else if (outcome === "skipped") skipped += 1;
  }

  const allMeanings = Array.from(
    new Set([
      ...selectedItem.meanings,
      ...(selectedItem.jlptMeta?.meanings ?? []),
      ...(selectedItem.jlptMeta?.primaryMeaning ? [selectedItem.jlptMeta.primaryMeaning] : []),
    ].filter((value) => value.trim().length > 0)),
  );

  const primaryReadings = selectedItem.primaryReadings ?? [];
  const secondaryReadings = (selectedItem.readings ?? []).filter((reading) => !primaryReadings.includes(reading));
  const requiresReveal = studyMode && selectedItem.queueType === "review";
  const detailsRevealed = !requiresReveal || isAnswerRevealed;
  const useStudyFlashLayout = studyMode && selectedItem.queueType === "review";
  const hasRadicals = hasRenderableRelatedItems(selectedItem.radicals as RelatedReference[] | undefined);
  const hasVisuallySimilar = hasRenderableRelatedItems(
    selectedItem.visuallySimilar as RelatedReference[] | undefined,
  );
  const hasUsedInVocabulary = hasRenderableRelatedItems(
    selectedItem.usedInVocabulary as RelatedReference[] | undefined,
  );
  const hasComponentKanji = hasRenderableRelatedItems(
    selectedItem.componentKanji as RelatedReference[] | undefined,
  );
  const jlptOnReadings = selectedItem.jlptMeta?.onReadings ?? [];
  const jlptKunReadings = selectedItem.jlptMeta?.kunReadings ?? [];

  const primaryReadingHiraganaCandidate =
    primaryReadings.find((reading) => reading.trim().length > 0) ??
    (jlptOnReadings[0] ? toHiragana(jlptOnReadings[0]) : null);
  const matchedPrimaryOn =
    primaryReadingHiraganaCandidate
      ? (jlptOnReadings.find((reading) => toHiragana(reading) === primaryReadingHiraganaCandidate) ??
        toKatakana(primaryReadingHiraganaCandidate))
      : null;

  const primaryReadingHiragana = primaryReadingHiraganaCandidate ?? "-";
  const primaryReadingKatakana = matchedPrimaryOn ?? "-";

  const remainingOnReadings = jlptOnReadings.filter((reading) => reading !== matchedPrimaryOn);
  const secondaryReadingParts = Array.from(
    new Set([
      ...remainingOnReadings,
      ...jlptKunReadings,
      ...(jlptOnReadings.length === 0 && jlptKunReadings.length === 0 ? secondaryReadings : []),
    ].filter((reading) => reading.trim().length > 0)),
  );
  const secondaryReadingValue = secondaryReadingParts.length > 0 ? secondaryReadingParts.join(", ") : "-";
  const wordExamples = parseWordExamples(selectedItem.jlptMeta?.wordExamples);
  const usedKanjiItems = (selectedItem.componentKanji as RelatedReference[] | undefined)?.filter(
    (item) => item.label.trim().length > 0 && item.label.trim() !== "-",
  ) ?? [];
  const jlptGradeLabel =
    typeof selectedItem.jlptMeta?.schoolGrade === "number"
      ? `Grade ${selectedItem.jlptMeta.schoolGrade}`
      : "-";

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(8,16,36,0.72)] p-3 backdrop-blur-[2px] sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[1.8rem] border border-line bg-surface shadow-[0_26px_75px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-2 border-b border-line bg-surface-muted px-4 py-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:px-6">
          <button type="button" onClick={onClose} className="self-start rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted sm:justify-self-start">Back To List</button>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-self-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/70 sm:text-xs">#{displayIndex} of {displayTotal}</p>
            {!studyMode ? (
              <div className="inline-flex items-center rounded-full border border-line bg-surface p-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewerMode("detail");
                    try {
                      window.localStorage.setItem(viewerModeStorageKey, "detail");
                    } catch {
                      // Ignore storage issues in restricted modes.
                    }
                  }}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                    viewerMode === "detail"
                      ? "bg-accent text-white"
                      : "text-foreground hover:bg-surface-muted"
                  }`}
                >
                  Detail
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewerMode("flash");
                    try {
                      window.localStorage.setItem(viewerModeStorageKey, "flash");
                    } catch {
                      // Ignore storage issues in restricted modes.
                    }
                  }}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                    viewerMode === "flash"
                      ? "bg-accent text-white"
                      : "text-foreground hover:bg-surface-muted"
                  }`}
                >
                  Flash
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 sm:justify-self-end">
            <button
              type="button"
              onClick={() => {
                goPrev();
              }}
              disabled={!onPrev || !prevLabel}
              className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev {prevLabel ?? "-"}
            </button>
            <button
              type="button"
              onClick={() => {
                advanceFlashOrNext();
              }}
              disabled={!(onNext || canUseFlashCycleNext)}
              className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {!onNext && canUseFlashCycleNext
                ? flashCycleDone
                  ? "Restart"
                  : "Next"
                : `Next ${nextLabel ?? "-"}`}
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {isSubmittingSelected ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface/80 backdrop-blur-[1px]">
              <div className="inline-flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                {submitInFlight ? `Submitting ${submitInFlight.result.toUpperCase()} for ${submitInFlight.itemLabel}...` : "Submitting..."}
              </div>
            </div>
          ) : null}

          <section className="rounded-2xl border-2 border-accent/35 bg-surface p-4 sm:p-5">
            {!studyMode && viewerMode === "flash" ? (
              flashCycleDone ? (
                <button
                  type="button"
                  onClick={advanceFlashOrNext}
                  onTouchStart={handleFlashTouchStart}
                  onTouchEnd={handleFlashTouchEnd}
                  className="flex min-h-[68vh] w-full select-none flex-col items-center justify-center rounded-2xl border border-line bg-surface-muted px-6 py-8 text-center hover:bg-surface"
                >
                  <p className="text-2xl font-black uppercase tracking-[0.12em] text-foreground/80 sm:text-3xl">
                    Cards Are Done
                  </p>
                  <p className="mt-3 text-sm font-bold uppercase tracking-[0.1em] text-foreground/60 sm:text-base">
                    Click Or Press Next Again To Restart
                  </p>
                </button>
              ) : (
                <div className="grid min-h-[68vh] gap-3 lg:grid-cols-2 lg:items-stretch">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      advanceFlashOrNext();
                    }}
                    onTouchStart={handleFlashTouchStart}
                    onTouchEnd={handleFlashTouchEnd}
                    className={`flex min-h-[20rem] select-none items-center justify-center rounded-2xl border p-6 ${typeGlyphBoxClass(
                      selectedItem.subjectType,
                    )}`}
                  >
                    <p className="text-center text-[clamp(5rem,14vw,11rem)] font-black leading-none text-current">
                      {selectedItem.characters}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!flashRevealed) {
                        setFlashRevealKey(currentFlashKey);
                      }
                    }}
                    onTouchStart={handleFlashTouchStart}
                    onTouchEnd={handleFlashTouchEnd}
                    className="flex min-h-[20rem] w-full select-none flex-col justify-center rounded-2xl border border-line bg-surface px-6 py-6 text-left hover:bg-surface-muted lg:h-full lg:min-h-0"
                  >
                    {!flashRevealed ? (
                      <div className="mx-auto text-center">
                        <p className="text-base font-black uppercase tracking-[0.12em] text-foreground/70">
                          Tap / Click To Reveal
                        </p>
                        <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground/55">
                          Enter Or Space
                        </p>
                      </div>
                    ) : (
                      <div className="grid h-full gap-4 lg:grid-rows-2">
                        <div className="rounded-xl border border-line bg-surface-muted px-4 py-4">
                          <p className="text-xs font-bold uppercase tracking-[0.1em] text-foreground/65">Reading</p>
                          <p className="mt-2 text-5xl font-black leading-tight text-foreground">
                            {primaryReadingHiragana === "-" && secondaryReadingValue !== "-"
                              ? secondaryReadingValue
                              : primaryReadingHiragana}
                          </p>
                          {primaryReadingKatakana !== "-" ? (
                            <p className="mt-2 text-4xl font-black leading-tight text-foreground/75">
                              {primaryReadingKatakana}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-xl border border-line bg-surface-muted px-4 py-4">
                          <p className="text-xs font-bold uppercase tracking-[0.1em] text-foreground/65">Meaning</p>
                          <p className="mt-2 text-4xl font-black leading-tight text-foreground">
                            {allMeanings[0] ?? selectedItem.characters}
                          </p>
                          {allMeanings.length > 1 ? (
                            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-foreground/70">
                              {allMeanings.slice(1).join(" • ")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              )
            ) : useStudyFlashLayout ? (
              <div className="grid min-h-[68vh] gap-3 lg:grid-cols-2 lg:items-stretch">
                <div className="flex min-h-[20rem] flex-col lg:h-full lg:min-h-0">
                  {!isAnswerRevealed ? (
                    <>
                    <div
                      className={`relative flex min-h-[20rem] flex-1 select-none items-center justify-center rounded-2xl border p-6 lg:h-full ${typeGlyphBoxClass(
                        selectedItem.subjectType,
                      )}`}
                    >
                      <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1">
                        <span className={subjectTypePillClass(selectedItem.subjectType)}>{shortSubjectTypeLabel(selectedItem.subjectType)}</span>
                        {typeof selectedItem.wkLevel === "number" ? <span className="subject-pill border-line bg-surface text-foreground">L{selectedItem.wkLevel}</span> : null}
                        {selectedItem.jlptLevel ? <span className="subject-pill border-line bg-surface text-foreground">N{selectedItem.jlptLevel}</span> : null}
                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(selectedItem.status)}`}>
                          {statusShortLabel(selectedItem.status)} · SRS {selectedItem.srsStage}
                        </span>
                      </div>

                      <p className="text-center text-[clamp(5rem,14vw,11rem)] font-black leading-none text-current">
                        {selectedItem.characters}
                      </p>
                    </div>
                    </>
                  ) : (
                    <>
                      <div
                        className={`relative flex min-h-[14rem] items-center justify-center rounded-2xl border p-6 ${typeGlyphBoxClass(
                          selectedItem.subjectType,
                        )}`}
                      >
                        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1">
                          <span className={subjectTypePillClass(selectedItem.subjectType)}>{shortSubjectTypeLabel(selectedItem.subjectType)}</span>
                          {typeof selectedItem.wkLevel === "number" ? <span className="subject-pill border-line bg-surface text-foreground">L{selectedItem.wkLevel}</span> : null}
                          {selectedItem.jlptLevel ? <span className="subject-pill border-line bg-surface text-foreground">N{selectedItem.jlptLevel}</span> : null}
                          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(selectedItem.status)}`}>
                            {statusShortLabel(selectedItem.status)} · SRS {selectedItem.srsStage}
                          </span>
                        </div>

                        <p className="text-center text-[clamp(4rem,12vw,8rem)] font-black leading-none text-current">
                          {selectedItem.characters}
                        </p>
                      </div>

                      <div className="mt-3 grid flex-1 gap-3 lg:grid-rows-2">
                      <div className="rounded-xl border border-line bg-surface-muted px-4 py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-foreground/65">Reading</p>
                        <p className="mt-2 text-5xl font-black leading-tight text-foreground">
                          {primaryReadingHiragana === "-" && secondaryReadingValue !== "-"
                            ? secondaryReadingValue
                            : primaryReadingHiragana}
                        </p>
                        {primaryReadingKatakana !== "-" ? (
                          <p className="mt-2 text-4xl font-black leading-tight text-foreground/75">
                            {primaryReadingKatakana}
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-xl border border-line bg-surface-muted px-4 py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-foreground/65">Meaning</p>
                        <p className="mt-2 text-4xl font-black leading-tight text-foreground">
                          {allMeanings[0] ?? selectedItem.characters}
                        </p>
                        {allMeanings.length > 1 ? (
                          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-foreground/70">
                            {allMeanings.slice(1).join(" • ")}
                          </p>
                        ) : null}
                      </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid min-h-[20rem] grid-rows-2 gap-3 lg:h-full lg:min-h-0">
                  {!isAnswerRevealed ? (
                    <button
                      type="button"
                      onClick={() => onReveal(selectedItem.assignmentId)}
                      className="row-span-2 h-full w-full rounded-2xl border border-line bg-surface-muted px-6 py-6 text-center hover:bg-surface"
                    >
                      <div>
                        <p className="text-base font-black uppercase tracking-[0.12em] text-foreground/70">Show Answer</p>
                        <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground/55">Space To Reveal</p>
                      </div>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSubmit(selectedItem.assignmentId, "wrong")}
                        aria-keyshortcuts="1"
                        title="Wrong (Key: 1)"
                        className="h-full w-full rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm font-black uppercase tracking-[0.1em] text-red-800"
                      >
                        Wrong
                      </button>
                      <button
                        type="button"
                        onClick={() => onSubmit(selectedItem.assignmentId, "correct")}
                        aria-keyshortcuts="2"
                        title="Correct (Key: 2)"
                        className="h-full w-full rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-4 text-sm font-black uppercase tracking-[0.1em] text-emerald-800"
                      >
                        Correct
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : requiresReveal && !isAnswerRevealed ? (
              <div className="grid min-h-[68vh] gap-3 lg:grid-cols-2 lg:items-stretch">
                <div
                  className={`flex min-h-[20rem] items-center justify-center rounded-2xl border p-6 ${typeGlyphBoxClass(
                    selectedItem.subjectType,
                  )}`}
                >
                  <p className="text-center text-[clamp(5rem,14vw,11rem)] font-black leading-none text-current">
                    {selectedItem.characters}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onReveal(selectedItem.assignmentId)}
                  className="flex min-h-[20rem] w-full flex-col justify-center rounded-2xl border border-line bg-surface px-6 py-6 text-left hover:bg-surface-muted lg:h-full lg:min-h-0"
                >
                  <div className="mx-auto text-center">
                    <p className="text-base font-black uppercase tracking-[0.12em] text-foreground/70">
                      Show Answer
                    </p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground/55">
                      Space To Reveal
                    </p>
                  </div>
                </button>
              </div>
            ) : (
            <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
              <div
                className={`inline-flex min-h-[5.75rem] min-w-[5.75rem] items-center justify-center rounded-2xl border px-4 py-3 ${typeGlyphBoxClass(
                  selectedItem.subjectType,
                )}`}
              >
                <p className={`text-center font-black leading-none ${glyphTextSizeClass(selectedItem.characters)}`}>
                  {selectedItem.characters}
                </p>
              </div>

              <div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-3xl font-black text-foreground">
                      {detailsRevealed ? (allMeanings[0] ?? selectedItem.characters) : "???"}
                    </p>
                    {detailsRevealed && allMeanings.length > 1 ? (
                      <p className="mt-1 hidden text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65 sm:block">
                        Alt meanings: {allMeanings.slice(1).join(" • ")}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-nowrap justify-self-end gap-1">
                    <span className={subjectTypePillClass(selectedItem.subjectType)}>{shortSubjectTypeLabel(selectedItem.subjectType)}</span>
                    {typeof selectedItem.wkLevel === "number" ? <span className="subject-pill border-line bg-surface text-foreground">L{selectedItem.wkLevel}</span> : null}
                    {selectedItem.jlptLevel ? <span className="subject-pill border-line bg-surface text-foreground">N{selectedItem.jlptLevel}</span> : null}
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(selectedItem.status)}`}>
                      {statusShortLabel(selectedItem.status)} · SRS {selectedItem.srsStage}
                    </span>
                  </div>
                </div>

                {detailsRevealed && allMeanings.length > 1 ? (
                  <div className="mt-2 rounded-xl border border-line bg-surface px-3 py-2 sm:hidden">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">
                      Alt meanings
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/80">
                      {allMeanings.slice(1).join(" • ")}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            )}

            {(!studyMode && viewerMode === "flash") || useStudyFlashLayout ? null : detailsRevealed ? (
              <>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {readingDualScriptCard("Primary readings", primaryReadingHiragana, primaryReadingKatakana)}
                  {readingCard("Secondary readings", secondaryReadingValue)}
                </div>

                <div className="mt-2 grid gap-2 lg:grid-cols-3">
                  {metricCard("Started", formatTimestampWithRelative(selectedItem.startedAt))}
                  {metricCard("Next review", formatTimestampWithRelative(selectedItem.availableAt))}
                  {metricCard("Passed", formatTimestampWithRelative(selectedItem.passedAt))}
                </div>

                {hasRadicals || hasVisuallySimilar || hasUsedInVocabulary ? (
                  <div className="mt-2 space-y-2">
                    {hasRadicals || hasVisuallySimilar ? (
                      <div
                        className={`grid gap-2 ${
                          hasRadicals && hasVisuallySimilar ? "lg:grid-cols-2" : "lg:grid-cols-1"
                        }`}
                      >
                        {hasRadicals ? (
                          <div className="rounded-xl border border-line bg-surface px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Radicals</p>
                            {relatedTiles(selectedItem.radicals as RelatedReference[] | undefined)}
                          </div>
                        ) : null}
                        {hasVisuallySimilar ? (
                          <div className="rounded-xl border border-line bg-surface px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Visually similar</p>
                            {relatedTiles(selectedItem.visuallySimilar as RelatedReference[] | undefined)}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {hasUsedInVocabulary ? (
                      <div className="rounded-xl border border-line bg-surface px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Used in vocabulary</p>
                        {relatedTiles(selectedItem.usedInVocabulary as RelatedReference[] | undefined)}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {hasComponentKanji ? (
                  <div className="mt-2">
                    <div className="rounded-xl border border-line bg-surface px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Component kanji</p>
                      {relatedTiles(selectedItem.componentKanji as RelatedReference[] | undefined)}
                    </div>
                  </div>
                ) : null}

                {selectedItem.subjectType === "vocabulary" && usedKanjiItems.length > 0 ? (
                  <div className="mt-2">
                    <div className="rounded-xl border border-line bg-surface px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Used kanji</p>
                        <button
                          type="button"
                          onClick={() => {
                            setUsedKanjiCollapsed((prev) => {
                              const next = !prev;
                              try {
                                window.localStorage.setItem(usedKanjiStorageKey, next ? "1" : "0");
                              } catch {
                                // Ignore storage issues in restricted modes.
                              }
                              return next;
                            });
                          }}
                          className="rounded-full border border-line bg-surface-muted px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface"
                        >
                          {usedKanjiCollapsed ? "Expand" : "Collapse"}
                        </button>
                      </div>
                      {!usedKanjiCollapsed ? (
                        <ul className="mt-2 space-y-2 text-foreground/90">
                          {usedKanjiItems.map((item, index) => (
                            <li
                              key={`${selectedItem.subjectId}-${item.subjectId}-${item.label}-${index}`}
                              className="rounded-lg border border-line bg-surface-muted px-3 py-2"
                            >
                              <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                                <p className={`font-black leading-none text-foreground ${relatedTileLabelClass(item.label)}`}>
                                  {item.label}
                                </p>
                                <p className="text-2xl font-bold leading-none text-foreground/80">
                                  {item.reading || "-"}
                                </p>
                              </div>
                              <p className="mt-1 text-sm text-foreground/85">{item.meaning || "-"}</p>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {selectedItem.jlptMeta ? (
                  <div className="mt-2 grid gap-2 lg:grid-cols-3">
                    {metricCard("JLPT meanings", selectedItem.jlptMeta.meanings.slice(0, 6).join(" • ") || "-")}
                    {metricCard("Stroke/Freq", `${selectedItem.jlptMeta.strokeCount ?? "-"} / ${selectedItem.jlptMeta.frequencyRank ?? "-"}`)}
                    {metricCard("Grade/Heisig", `${jlptGradeLabel} / ${selectedItem.jlptMeta.heisigKeyword ?? "-"}`)}
                  </div>
                ) : null}

                {wordExamples.length > 0 ? (
                  <div className="mt-2 rounded-xl border border-line bg-surface px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Used in words</p>
                      <button
                        type="button"
                        onClick={() => {
                          setUsedInWordsCollapsed((prev) => {
                            const next = !prev;
                            try {
                              window.localStorage.setItem(usedInWordsStorageKey, next ? "1" : "0");
                            } catch {
                              // Ignore storage issues in restricted modes.
                            }
                            return next;
                          });
                        }}
                        className="rounded-full border border-line bg-surface-muted px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface"
                      >
                        {usedInWordsCollapsed ? "Expand" : "Collapse"}
                      </button>
                    </div>
                    {!usedInWordsCollapsed ? (
                      <ul className="mt-2 space-y-2 text-foreground/90">
                        {wordExamples.map((example, index) => (
                          <li
                            key={`${selectedItem.subjectId}-${example.written}-${example.pronounced}-${index}`}
                            className="rounded-lg border border-line bg-surface-muted px-3 py-2"
                          >
                            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                              <p className={`font-black leading-none text-foreground ${relatedTileLabelClass(example.written || "-")}`}>
                                {example.written || "-"}
                              </p>
                              <p className="text-2xl font-bold leading-none text-foreground/80">
                                {example.pronounced || "-"}
                              </p>
                            </div>
                            <p className="mt-1 text-sm text-foreground/85">{example.gloss || "-"}</p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-2">
                  <LevelExplorerReviewStatsCard
                    accountId={accountId}
                    subjectId={selectedItem.subjectId}
                    currentSrsStage={selectedItem.srsStage}
                    startedAt={selectedItem.startedAt}
                  />
                </div>
              </>
            ) : null}
          </section>

          {selectedItem.queueType === "review" && studyMode && (!requiresReveal || isAnswerRevealed) && !useStudyFlashLayout ? (
            <div className="mt-auto grid w-full grid-cols-2 gap-2 pt-3">
              <button
                type="button"
                onClick={() => onSubmit(selectedItem.assignmentId, "wrong")}
                aria-keyshortcuts="1"
                title="Wrong (Key: 1)"
                className="min-h-[4.25rem] w-full rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm font-black uppercase tracking-[0.1em] text-red-800"
              >
                Wrong
              </button>
              <button
                type="button"
                onClick={() => onSubmit(selectedItem.assignmentId, "correct")}
                aria-keyshortcuts="2"
                title="Correct (Key: 2)"
                className="min-h-[4.25rem] w-full rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-4 text-sm font-black uppercase tracking-[0.1em] text-emerald-800"
              >
                Correct
              </button>
            </div>
          ) : null}

          {studyMode ? (
            <div className="mt-2 grid w-full grid-cols-3 gap-2">
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-2 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-700/80">Wrong</p><p className="mt-1 text-2xl font-black leading-none text-red-800">{wrong}</p></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700/80">Skipped</p><p className="mt-1 text-2xl font-black leading-none text-amber-800">{skipped}</p></div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700/80">Correct</p><p className="mt-1 text-2xl font-black leading-none text-emerald-800">{correct}</p></div>
            </div>
          ) : null}

          {submitFeedback ? (
            <p className={`mt-3 rounded-xl border px-4 py-3 text-sm font-black uppercase tracking-[0.08em] ${submitFeedback.kind === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}`}>
              {submitFeedback.message}
            </p>
          ) : null}

        </div>

        <div className="border-t border-line/70 bg-surface px-4 py-3 sm:px-6">
          <p className="rounded-xl border border-line/70 bg-surface-muted px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/65 sm:text-[11px]">
            {studyMode
              ? "Keys: Esc close • A/W/↑ prev • D/S/↓ next • Enter next • Shift+Enter prev • Space next • Shift+Space prev • Space reveal (study) • 1/J wrong • 2/K correct"
              : viewerMode === "flash"
                ? "Keys: Esc close • A/W/↑ prev • D/S/↓ next • Enter/Space reveal • Enter next (revealed) • Shift+Enter prev • Shift+Space prev • Swipe ←/→ nav • Swipe ↑ reveal"
                : "Keys: Esc close • A/W/↑ prev • D/S/↓ next • Enter next • Shift+Enter prev • Space next • Shift+Space prev"}
          </p>
        </div>
      </div>
    </div>
  );
}
