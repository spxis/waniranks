"use client";

import { useMemo, useState } from "react";

import {
  availabilityForRun,
  openNewsGlyphRun,
  prefetchNewsGlyphRun,
} from "./newsGlyphRunner";
import { tokenizeJapanese } from "./newsTokenize";

type Props = {
  text: string;
  emphasizeKanji: boolean;
};

export default function NewsTokenizedText({ text, emphasizeKanji }: Props) {
  const segments = tokenizeJapanese(text);
  const [dynamicAvailability, setDynamicAvailability] = useState<
    Record<string, "unknown" | "known" | "missing">
  >({});
  const [loadingRun, setLoadingRun] = useState<string | null>(null);

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
        const availability = dynamicAvailability[segment.text] ?? availabilityByRun[segment.text] ?? "unknown";
        const isLoading = loadingRun === segment.text;
        const sizeClass = emphasizeKanji ? "text-[1.2em] leading-none" : "";
        const missingClass =
          availability === "missing"
            ? "text-hot/80 decoration-hot/70 decoration-wavy underline"
            : "";
        return (
          <button
            key={index}
            type="button"
            disabled={isLoading}
            onClick={() => {
              if (isLoading) {
                return;
              }
              setLoadingRun(segment.text);
              void openNewsGlyphRun(segment.text).finally(() => {
                setLoadingRun((prev) => (prev === segment.text ? null : prev));
              });
            }}
            onMouseEnter={() => {
              if (availability !== "unknown" || isLoading) {
                return;
              }
              void prefetchNewsGlyphRun(segment.text).then((next) => {
                setDynamicAvailability((prev) => ({ ...prev, [segment.text]: next }));
              });
            }}
            onFocus={() => {
              if (availability !== "unknown" || isLoading) {
                return;
              }
              void prefetchNewsGlyphRun(segment.text).then((next) => {
                setDynamicAvailability((prev) => ({ ...prev, [segment.text]: next }));
              });
            }}
            className={`group relative inline select-none align-baseline border-0 bg-transparent p-0 text-foreground outline-none transition hover:text-accent focus:outline-none focus-visible:outline-none disabled:cursor-wait disabled:opacity-80 ${sizeClass} ${missingClass}`.trim()}
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
          </button>
        );
      })}
    </>
  );
}
