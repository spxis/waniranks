"use client";

import { useEffect, useMemo, useState } from "react";

import {
  availabilityForRun,
  openNewsGlyphCandidates,
  openNewsGlyphRun,
  prefetchNewsGlyphCandidates,
  prefetchNewsGlyphRun,
} from "./newsGlyphRunner";
import {
  NEWS_KANJI_HISTORY_EVENT,
  readNewsKanjiHistory,
} from "./newsKanjiHistory";
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
        const isLoading = loadingRun === primaryRun;
        const sizeClass = emphasizeKanji ? "text-[1.2em] leading-none" : "";
        const seenClass = seenRuns.has(segment.text) ? "text-accent/80" : "";
        const missingClass =
          availability === "missing"
            ? "text-hot/80 decoration-hot/70 decoration-wavy underline"
            : "";
        const tryOpen = () => {
          const selection = typeof window !== "undefined" ? window.getSelection()?.toString().trim() ?? "" : "";
          if (selection.length > 0 || isLoading) {
            return;
          }
          setLoadingRun(primaryRun);
          void openNewsGlyphCandidates(candidates)
            .then((opened) => {
              if (!opened) {
                return;
              }

              const clickedChars = extractKanjiTokens(primaryRun);
              setSeenRuns((prev) => {
                const next = new Set(prev);
                next.add(primaryRun);
                pageSessionSeenGlyphs.add(primaryRun);
                for (const token of clickedChars) {
                  next.add(token);
                  pageSessionSeenGlyphs.add(token);
                }
                return next;
              });
            })
            .finally(() => {
              setLoadingRun((prev) => (prev === primaryRun ? null : prev));
            });
        };

        return (
          <span
            key={index}
            tabIndex={isLoading ? -1 : 0}
            aria-disabled={isLoading}
            aria-label={`Look up ${segment.text}`}
            onClick={tryOpen}
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
const KANA_REGEX = /[\u3040-\u309F\u30A0-\u30FFー]/;

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

function buildLookupCandidates(segments: Array<{ kind: "kanji" | "other"; text: string }>, index: number): string[] {
  const run = segments[index]?.text ?? "";
  if (!run) {
    return [];
  }

  const prevKana = trailingKana(segments[index - 1]?.kind === "other" ? segments[index - 1].text : "", 2);
  const nextKana = leadingKana(segments[index + 1]?.kind === "other" ? segments[index + 1].text : "", 3);
  const suffixVariants = kanaPrefixVariants(nextKana);

  const out: string[] = [];
  for (const suffix of suffixVariants) {
    out.push(`${prevKana}${run}${suffix}`);
    out.push(`${run}${suffix}`);
  }
  out.push(`${prevKana}${run}`);
  out.push(run);

  const normalized = Array.from(new Set(out.map((value) => value.trim()).filter((value) => value.length > 0)));
  return expandDictionaryCandidates(normalized);
}

function kanaPrefixVariants(nextKana: string): string[] {
  const chars = Array.from(nextKana);
  if (chars.length === 0) {
    return [""];
  }

  const out: string[] = [];
  for (let length = chars.length; length >= 1; length -= 1) {
    out.push(chars.slice(0, length).join(""));
  }
  out.push("");
  return out;
}

function expandDictionaryCandidates(base: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of base) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }

    for (const derived of recoverDictionaryForms(value)) {
      if (seen.has(derived)) {
        continue;
      }
      seen.add(derived);
      out.push(derived);
    }
  }

  return out;
}

function recoverDictionaryForms(value: string): string[] {
  const out: string[] = [];
  const endings = ["たり", "た", "て", "ない", "ます", "ません", "れば", "よう", "ろ"];

  for (const ending of endings) {
    if (!value.endsWith(ending) || value.length <= ending.length) {
      continue;
    }
    const stem = value.slice(0, -ending.length);
    if (looksIchidanStem(stem)) {
      out.push(`${stem}る`);
    }
  }

  if (looksIchidanStem(value)) {
    out.push(`${value}る`);
  }

  return out;
}

function looksIchidanStem(value: string): boolean {
  if (!value || !KANJI_REGEX.test(value)) {
    return false;
  }

  const chars = Array.from(value);
  const last = chars[chars.length - 1] ?? "";
  if (!last || !KANA_REGEX.test(last)) {
    return false;
  }

  return /[いきぎしじちぢにひびぴみりえけげせぜてでねへべぺめれ]/.test(last);
}

function leadingKana(text: string, maxChars: number): string {
  const chars = Array.from(text);
  const out: string[] = [];
  for (const char of chars) {
    if (!KANA_REGEX.test(char)) {
      break;
    }
    out.push(char);
    if (out.length >= maxChars) {
      break;
    }
  }
  return out.join("");
}

function trailingKana(text: string, maxChars: number): string {
  const chars = Array.from(text);
  const out: string[] = [];
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const char = chars[i];
    if (!KANA_REGEX.test(char)) {
      break;
    }
    out.push(char);
    if (out.length >= maxChars) {
      break;
    }
  }
  return out.reverse().join("");
}
