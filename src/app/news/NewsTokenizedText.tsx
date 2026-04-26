"use client";

import { useEffect, useMemo, useState } from "react";

import {
  availabilityForRun,
  openNewsGlyphCandidates,
  prefetchNewsGlyphCandidates,
} from "./newsGlyphRunner";
import {
  NEWS_KANJI_HISTORY_EVENT,
  readNewsKanjiHistory,
} from "./newsKanjiHistory";
import {
  buildCandidatesFromSelectedText,
  buildLookupCandidates,
} from "./newsLookupCandidates";
import { tokenizeJapanese } from "./newsTokenize";

type Props = {
  text: string;
  emphasizeKanji: boolean;
};

const pageSessionSeenGlyphs = new Set<string>();

export default function NewsTokenizedText({ text, emphasizeKanji }: Props) {
  const segments = tokenizeJapanese(text);
  const [dynamicAvailability, setDynamicAvailability] = useState<
    Record<string, "unknown" | "known" | "missing">
  >({});
  const [loadingRun, setLoadingRun] = useState<string | null>(null);
  const [seenRuns, setSeenRuns] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const next = collectSeenGlyphs();
    for (const token of pageSessionSeenGlyphs) {
      next.add(token);
    }
    setSeenRuns(next);
  }, []);

  useEffect(() => {
    const refresh = () => {
      const next = collectSeenGlyphs();
      for (const token of pageSessionSeenGlyphs) {
        next.add(token);
      }
      setSeenRuns(next);
    };
    window.addEventListener(NEWS_KANJI_HISTORY_EVENT, refresh);
    return () => {
      window.removeEventListener(NEWS_KANJI_HISTORY_EVENT, refresh);
    };
  }, []);

  const availabilityByRun = useMemo<Record<string, "unknown" | "known" | "missing">>(() => {
    const map = new Map<string, "unknown" | "known" | "missing">();
    for (const segment of segments) {
      if (segment.kind !== "kanji") {
        continue;
      }
      if (!map.has(segment.text)) {
        map.set(segment.text, availabilityForRun(segment.text));
      }
    }
    return Object.fromEntries(map.entries());
  }, [segments]);

  if (segments.length === 0) {
    return <>{text}</>;
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind !== "kanji") {
          return <span key={index}>{segment.text}</span>;
        }
        const candidates = buildLookupCandidates(segments, index);
        const primaryRun = candidates[0] ?? segment.text;
        const availability = dynamicAvailability[segment.text] ?? availabilityByRun[segment.text] ?? "unknown";
        const isLoading = loadingRun === segment.text;
        const sizeClass = emphasizeKanji ? "text-[1.2em] leading-none" : "";
        const seenClass = seenRuns.has(segment.text) ? "text-accent/80" : "";
        const missingClass =
          availability === "missing"
            ? "text-hot/80 decoration-hot/70 decoration-wavy underline"
            : "";
        const tryOpen = () => {
          const selectionText = typeof window !== "undefined" ? window.getSelection()?.toString().trim() ?? "" : "";
          if (isLoading) {
            return;
          }
          const selectionCandidates = selectionText
            ? buildCandidatesFromSelectedText(selectionText)
            : [];
          const lookupCandidates =
            selectionCandidates.length > 0
              ? [...selectionCandidates, ...candidates]
              : candidates;
          const lookupPrimary = lookupCandidates[0] ?? primaryRun;

          setLoadingRun(segment.text);
          void openNewsGlyphCandidates(lookupCandidates)
            .then((opened) => {
              if (!opened) {
                void prefetchNewsGlyphCandidates(lookupCandidates).then((next) => {
                  setDynamicAvailability((prev) => ({ ...prev, [segment.text]: next }));
                });
                return;
              }

              const clickedChars = extractKanjiTokens(lookupPrimary);
              setSeenRuns((prev) => {
                const next = new Set(prev);
                next.add(lookupPrimary);
                pageSessionSeenGlyphs.add(lookupPrimary);
                for (const token of clickedChars) {
                  next.add(token);
                  pageSessionSeenGlyphs.add(token);
                }
                return next;
              });
            })
            .finally(() => {
              setLoadingRun((prev) => (prev === segment.text ? null : prev));
            });
        };

        return (
          <span
            key={index}
            tabIndex={isLoading ? -1 : 0}
            aria-disabled={isLoading}
            aria-label={`Look up ${segment.text}`}
            onClick={() => {
              tryOpen();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                tryOpen();
              }
            }}
            onMouseEnter={() => {
              if (availability !== "unknown" || isLoading) {
                return;
              }
              void prefetchNewsGlyphCandidates(candidates).then((next) => {
                setDynamicAvailability((prev) => ({ ...prev, [segment.text]: next }));
              });
            }}
            onFocus={() => {
              if (availability !== "unknown" || isLoading) {
                return;
              }
              void prefetchNewsGlyphCandidates(candidates).then((next) => {
                setDynamicAvailability((prev) => ({ ...prev, [segment.text]: next }));
              });
            }}
            className={`group relative inline cursor-pointer select-text align-baseline text-foreground outline-none transition hover:text-accent focus-visible:text-accent ${isLoading ? "cursor-wait opacity-80" : ""} ${sizeClass} ${seenClass} ${missingClass}`.trim()}
            title={
              isLoading
                ? `Looking up ${segment.text}...`
                : availability === "missing"
                ? `${segment.text} is not in your WaniKani data`
                : `Look up ${segment.text}`
            }
          >
            <span className="rounded-sm group-hover:bg-accent/10 group-focus-visible:bg-accent/10">
              {segment.text}
            </span>
            {isLoading ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-2 -top-1 h-3 w-3 animate-spin rounded-full border-2 border-accent/35 border-t-accent"
              />
            ) : null}
          </span>
        );
      })}
    </>
  );
}

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
function collectSeenGlyphs(): Set<string> {
  const seen = new Set<string>();
  for (const entry of readNewsKanjiHistory()) {
    const run = entry.run.trim();
    if (!run) {
      continue;
    }
    seen.add(run);
    for (const token of extractKanjiTokens(run)) {
      seen.add(token);
    }
  }
  return seen;
}

function extractKanjiTokens(value: string): string[] {
  return Array.from(value).filter((char) => KANJI_REGEX.test(char));
}

