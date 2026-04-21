"use client";

import { useEffect, useMemo, useState } from "react";

import type { StudyQueueItem } from "@/app/users/[nickname]/study-explorer/lib/studyExplorerTypes";
import type { RelatedReference } from "@/app/users/[nickname]/explorerTypes";
import { jlptLevelPillClass, shortSubjectTypeLabel, statusClass, statusShortLabel, subjectTypePillClass, typeGlyphBoxClass } from "@/app/users/[nickname]/level-explorer/lib/levelExplorerDisplay";
import { useGlyphFontPreference } from "@/lib/glyphFontPreference";
import { VIEW_GLYPH_EVENT, type ViewGlyphViewerPayload } from "@/lib/viewGlyphViewer";
import { parseWordExamples } from "@/app/users/[nickname]/jlpt-explorer/lib/jlptExplorerContentHelpers";

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

function toRelatedItems(items: RelatedReference[] | undefined): RelatedReference[] {
  if (!items || items.length === 0) {
    return [];
  }

  return items.filter((item) => item.label.trim().length > 0 && item.label.trim() !== "-");
}

export default function ViewGlyphModalHost() {
  const [items, setItems] = useState<StudyQueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [customTitle, setCustomTitle] = useState<string | undefined>(undefined);
  const { fontFamily, toggle } = useGlyphFontPreference();

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<ViewGlyphViewerPayload>).detail;
      if (!detail?.items || detail.items.length === 0) {
        return;
      }

      setItems(detail.items);
      setIndex(Math.max(0, Math.min(detail.startIndex ?? 0, detail.items.length - 1)));
      setCustomTitle(detail.title);
    };

    window.addEventListener(VIEW_GLYPH_EVENT, onOpen);
    return () => {
      window.removeEventListener(VIEW_GLYPH_EVENT, onOpen);
    };
  }, []);

  const item = items[index] ?? null;
  const closeModal = () => {
    setItems([]);
    setIndex(0);
    setCustomTitle(undefined);
  };

  const reading = useMemo(() => {
    if (!item) return "-";
    const primary = item.primaryReadings?.[0];
    if (primary && primary.trim().length > 0) return primary;
    const alt = item.readings?.[0];
    if (alt && alt.trim().length > 0) return alt;
    return "-";
  }, [item]);

  const meaning = useMemo(() => {
    if (!item) return "-";
    const primary = item.meanings?.[0];
    return primary && primary.trim().length > 0 ? primary : "-";
  }, [item]);

  const allReadings = useMemo(() => {
    if (!item) return [];
    return Array.from(
      new Set(
        [
          ...(item.primaryReadings ?? []),
          ...(item.readings ?? []),
          ...(item.jlptMeta?.onReadings ?? []),
          ...(item.jlptMeta?.kunReadings ?? []),
          ...(item.jlptMeta?.nanoriReadings ?? []),
        ].filter((value) => value.trim().length > 0),
      ),
    );
  }, [item]);

  const allMeanings = useMemo(() => {
    if (!item) return [];
    return Array.from(
      new Set(
        [
          ...(item.meanings ?? []),
          ...(item.jlptMeta?.meanings ?? []),
          ...(item.jlptMeta?.primaryMeaning ? [item.jlptMeta.primaryMeaning] : []),
        ].filter((value) => value.trim().length > 0),
      ),
    );
  }, [item]);

  const radicals = useMemo(() => toRelatedItems(item?.radicals as RelatedReference[] | undefined), [item]);
  const visuallySimilar = useMemo(() => toRelatedItems(item?.visuallySimilar as RelatedReference[] | undefined), [item]);
  const componentKanji = useMemo(() => toRelatedItems(item?.componentKanji as RelatedReference[] | undefined), [item]);
  const usedInVocabulary = useMemo(() => toRelatedItems(item?.usedInVocabulary as RelatedReference[] | undefined), [item]);
  const wordExamples = useMemo(() => parseWordExamples(item?.jlptMeta?.wordExamples), [item]);

  const openRelated = (related: RelatedReference, subjectType: "radical" | "kanji" | "vocabulary") => {
    if (!item) return;

    const label = firstNonEmpty([related.label]);
    const next: StudyQueueItem = {
      assignmentId: -1,
      queueType: "review",
      subjectId: related.subjectId,
      subjectType,
      wkLevel: related.wkLevel ?? item.wkLevel,
      characters: label,
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

    setItems([next]);
    setIndex(0);
  };

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
  }, [item, items.length]);

  if (!item) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] bg-[rgba(6,12,26,0.56)] p-3 backdrop-blur-[1px] sm:p-6">
      <div className="mx-auto flex h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_20px_65px_rgba(0,0,0,0.42)]">
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

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
          <div className={`rounded-2xl border p-4 ${typeGlyphBoxClass(item.subjectType)}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex flex-wrap items-center gap-1">
                <span className={subjectTypePillClass(item.subjectType)}>{shortSubjectTypeLabel(item.subjectType)}</span>
                {typeof item.wkLevel === "number" ? <span className="subject-pill border-line bg-surface text-foreground">L{item.wkLevel}</span> : null}
                {typeof item.jlptMeta?.schoolGrade === "number" ? <span className="subject-pill border-line bg-surface text-foreground">G{item.jlptMeta.schoolGrade}</span> : null}
                {item.jlptLevel ? <span className={jlptLevelPillClass()}>N{item.jlptLevel}</span> : null}
              </div>
              <button
                type="button"
                onClick={toggle}
                className="rounded-full border border-line bg-surface px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-foreground/80 hover:bg-surface-muted"
              >
                Font
              </button>
            </div>

            <p style={{ fontFamily }} className="mt-4 text-center text-[clamp(3rem,12vw,6.2rem)] font-black leading-none text-current">
              {item.characters}
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-muted px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Reading</p>
                <p className="mt-1 truncate text-xl font-black text-foreground/90">{reading}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface-muted px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Meaning</p>
                <p className="mt-1 truncate text-xl font-black text-foreground/90">{meaning}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(item.status)}`}>{statusShortLabel(item.status)}</span>
              <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-foreground">SRS {item.srsStage}</span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">All readings</p>
              <p className="mt-1 text-sm font-black text-foreground/95">{allReadings.length > 0 ? allReadings.join(" • ") : "-"}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">All meanings</p>
              <p className="mt-1 text-sm font-black text-foreground/95">{allMeanings.length > 0 ? allMeanings.join(" • ") : "-"}</p>
            </div>
          </div>

          {item.meaningExplanation ? (
            <div className="rounded-xl border border-line bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Meaning explanation</p>
              <p className="mt-1 text-sm font-semibold text-foreground/90">{item.meaningExplanation}</p>
            </div>
          ) : null}

          {item.readingExplanation ? (
            <div className="rounded-xl border border-line bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Reading explanation</p>
              <p className="mt-1 text-sm font-semibold text-foreground/90">{item.readingExplanation}</p>
            </div>
          ) : null}

          {radicals.length > 0 ? (
            <div className="rounded-xl border border-line bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Radicals</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {radicals.map((related) => (
                  <button
                    type="button"
                    key={`radical-${related.subjectId}-${related.label}`}
                    onClick={() => openRelated(related, "radical")}
                    className="inline-flex min-w-[4.5rem] cursor-pointer flex-col items-center rounded-xl border border-line bg-surface-muted px-3 py-2 text-center hover:bg-surface"
                  >
                    <span className="text-2xl font-black leading-none text-foreground">{related.label}</span>
                    {related.reading ? <span className="mt-1 text-xs font-semibold text-foreground/70">{related.reading}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {visuallySimilar.length > 0 ? (
            <div className="rounded-xl border border-line bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Visually similar</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {visuallySimilar.map((related) => (
                  <button
                    type="button"
                    key={`visually-similar-${related.subjectId}-${related.label}`}
                    onClick={() => openRelated(related, "kanji")}
                    className="inline-flex min-w-[4.5rem] cursor-pointer flex-col items-center rounded-xl border border-line bg-surface-muted px-3 py-2 text-center hover:bg-surface"
                  >
                    <span className="text-2xl font-black leading-none text-foreground">{related.label}</span>
                    {related.reading ? <span className="mt-1 text-xs font-semibold text-foreground/70">{related.reading}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {usedInVocabulary.length > 0 ? (
            <div className="rounded-xl border border-line bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">
                {item.subjectType === "radical" ? "Used in kanji" : "Used in vocabulary"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {usedInVocabulary.map((related) => (
                  <button
                    type="button"
                    key={`used-in-vocab-${related.subjectId}-${related.label}`}
                    onClick={() => openRelated(related, item.subjectType === "radical" ? "kanji" : "vocabulary")}
                    className="inline-flex min-w-[4.5rem] cursor-pointer flex-col items-center rounded-xl border border-line bg-surface-muted px-3 py-2 text-center hover:bg-surface"
                  >
                    <span className="text-2xl font-black leading-none text-foreground">{related.label}</span>
                    {related.reading ? <span className="mt-1 text-xs font-semibold text-foreground/70">{related.reading}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {componentKanji.length > 0 ? (
            <div className="rounded-xl border border-line bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Component kanji</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {componentKanji.map((related) => (
                  <button
                    type="button"
                    key={`component-kanji-${related.subjectId}-${related.label}`}
                    onClick={() => openRelated(related, "kanji")}
                    className="inline-flex min-w-[4.5rem] cursor-pointer flex-col items-center rounded-xl border border-line bg-surface-muted px-3 py-2 text-center hover:bg-surface"
                  >
                    <span className="text-2xl font-black leading-none text-foreground">{related.label}</span>
                    {related.reading ? <span className="mt-1 text-xs font-semibold text-foreground/70">{related.reading}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {item.jlptMeta ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">JLPT meanings</p>
                <p className="mt-1 text-sm font-black text-foreground/95">{item.jlptMeta.meanings.slice(0, 6).join(" • ") || "-"}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Stroke / Freq</p>
                <p className="mt-1 text-sm font-black text-foreground/95">{item.jlptMeta.strokeCount ?? "-"} / {item.jlptMeta.frequencyRank ?? "-"}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Grade / Heisig</p>
                <p className="mt-1 text-sm font-black text-foreground/95">{item.jlptMeta.schoolGrade ?? "-"} / {item.jlptMeta.heisigKeyword ?? "-"}</p>
              </div>
            </div>
          ) : null}

          {wordExamples.length > 0 ? (
            <div className="rounded-xl border border-line bg-surface px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Used in words</p>
              <ul className="mt-2 space-y-2">
                {wordExamples.slice(0, 8).map((example, exampleIndex) => (
                  <li key={`word-example-${example.written}-${example.pronounced}-${exampleIndex}`} className="rounded-lg border border-line bg-surface-muted px-3 py-2">
                    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          openRelated(
                            {
                              subjectId: -(exampleIndex + 1),
                              label: example.written || "-",
                              reading: example.pronounced || null,
                              meaning: example.gloss || null,
                            },
                            "vocabulary",
                          );
                        }}
                        className="cursor-pointer text-left text-2xl font-black leading-none text-foreground hover:opacity-85"
                      >
                        {example.written || "-"}
                      </button>
                      <p className="text-xl font-bold leading-none text-foreground/80">{example.pronounced || "-"}</p>
                    </div>
                    <p className="mt-1 text-sm text-foreground/85">{example.gloss || "-"}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
