import type { JSX } from "react";
import { toRomaji } from "wanakana";

import type { RelatedReference } from "./StudyReviewModal.types";

import { formatRelativeFromNow } from "../../level-explorer/lib/levelExplorerDisplay";

export function relatedTileLabelClass(label: string): string {
  const length = Array.from(label).length;
  if (length <= 2) return "text-4xl";
  if (length <= 4) return "text-3xl";
  return "text-xl";
}

export function hasRenderableRelatedItems(items: RelatedReference[] | undefined): boolean {
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

export function relatedTiles(items: RelatedReference[] | undefined): JSX.Element {
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

export function relatedTilesClickable(
  items: RelatedReference[] | undefined,
  onSelect: (item: { subjectId: number; label: string; reading?: string | null }) => void,
): JSX.Element {
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

      return [{ subjectId: item.subjectId, label: normalizedLabel, reading: item.reading?.trim() || null, key: `${item.subjectId}-${normalizedLabel}` }];
    }

    return parts.map((part, index) => ({
      subjectId: item.subjectId,
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
        <button
          type="button"
          key={entry.key}
          onClick={() => onSelect(entry)}
          className="inline-flex min-w-[4.5rem] cursor-pointer flex-col items-center rounded-xl border border-line bg-surface px-3 py-2 text-center transition-colors hover:bg-surface-muted"
        >
          <span className={`font-black leading-none text-foreground ${relatedTileLabelClass(entry.label)}`}>
            {entry.label}
          </span>
          {entry.reading ? (
            <span className="mt-1 text-xs font-semibold leading-none text-foreground/70">{entry.reading}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function metricCard(label: string, value: string): JSX.Element {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">{label}</p>
      <p className="mt-1 text-sm font-black text-foreground/95">{value}</p>
    </div>
  );
}

export function readingCard(label: string, value: JSX.Element): JSX.Element {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">{label}</p>
      <p className="mt-1 text-2xl font-black leading-tight text-foreground/95">{value}</p>
    </div>
  );
}

function splitReadingSegments(reading: string): string[] {
  const segments = reading
    .split(/[.・]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length > 0) {
    return segments;
  }

  const trimmed = reading.trim();
  return trimmed ? [trimmed] : [reading];
}

function renderSegmentedReading(reading: string): JSX.Element {
  const segments = splitReadingSegments(reading);

  if (segments.length <= 1) {
    return <>{segments[0] ?? reading}</>;
  }

  return (
      <span className="inline-flex flex-wrap items-baseline gap-1 align-baseline">
      {segments.map((segment, index) => (
        <span
          key={`${segment}-${index}`}
            className="inline-flex items-center rounded-[0.35rem] border border-line/50 px-1.5 leading-[1.05] align-baseline"
        >
          {segment}
        </span>
      ))}
    </span>
  );
}

function pronunciationForReading(reading: string): string | null {
  const trimmed = reading.trim();
  if (!trimmed || trimmed === "-") {
    return null;
  }

  const normalized = trimmed.replace(/[.・]/g, "");
  const romaji = toRomaji(normalized, { upcaseKatakana: false }).trim();
  if (!romaji || romaji === normalized) {
    return null;
  }

  return romaji;
}

export function readingWithPronunciation(reading: string, showPronunciation: boolean): JSX.Element {
  if (!showPronunciation) {
    return renderSegmentedReading(reading);
  }

  const pronunciation = pronunciationForReading(reading);
  return (
      <span className="inline-flex items-baseline gap-1 align-baseline">
      {renderSegmentedReading(reading)}
      {pronunciation ? <span className="text-base font-semibold text-foreground/70">/ {pronunciation}</span> : null}
    </span>
  );
}

export function readingsWithPronunciationList(value: string, showPronunciation: boolean): JSX.Element {
  if (!value || value === "-") {
    return <>{value}</>;
  }

  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {index > 0 ? <span className="text-foreground/65">, </span> : null}
          {readingWithPronunciation(part, showPronunciation)}
        </span>
      ))}
    </>
  );
}

export function readingDualScriptCard(label: string, hiraganaValue: JSX.Element, katakanaValue: JSX.Element): JSX.Element {
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

export function formatTimestampWithRelative(value: string | null | undefined): string {
  const absolute = formatTimestamp(value);
  if (absolute === "-") {
    return "-";
  }

  const relative = formatRelativeFromNow(value);
  return relative ? `${absolute} (${relative})` : absolute;
}
