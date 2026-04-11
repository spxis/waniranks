import { Fragment } from "react";
import { toRomaji } from "wanakana";

import type { LevelItem } from "../../explorerTypes";
import type { TypeFilter } from "./levelExplorerState";

export function statusClass(status: LevelItem["status"]): string {
  switch (status) {
    case "locked":
      return "bg-surface-muted text-foreground/70";
    case "apprentice":
      return "bg-pink-100 text-pink-700";
    case "guru":
      return "bg-violet-100 text-violet-700";
    case "master":
      return "bg-sky-100 text-sky-700";
    case "enlightened":
      return "bg-amber-100 text-amber-700";
    case "burned":
      return "bg-surface-muted text-foreground/80";
  }
}

export function statusShortLabel(status: LevelItem["status"]): string {
  switch (status) {
    case "apprentice":
      return "APPR";
    case "enlightened":
      return "ENLIGHT";
    default:
      return status.toUpperCase();
  }
}

export function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

export function formatDate(input: string | null | undefined): string {
  if (!input) {
    return "-";
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

type NextReviewBadge = {
  label: string;
  className: string;
};

export function formatNextReviewBadge(input: string | null | undefined): NextReviewBadge | null {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const deltaMs = parsed.getTime() - Date.now();
  const absMs = Math.abs(deltaMs);

  if (deltaMs <= 0) {
    if (absMs < 15 * 60 * 1000) {
      return {
        label: "Late now",
        className: "border-orange-300 bg-orange-50 text-orange-700",
      };
    }

    if (absMs < 24 * 60 * 60 * 1000) {
      const hours = Math.max(1, Math.round(absMs / (60 * 60 * 1000)));
      return {
        label: `Late ${hours}h`,
        className: "border-orange-300 bg-orange-50 text-orange-700",
      };
    }

    const days = Math.max(1, Math.round(absMs / (24 * 60 * 60 * 1000)));
    return {
      label: `Late ${days}d`,
      className: "border-red-300 bg-red-50 text-red-700",
    };
  }

  if (absMs < 15 * 60 * 1000) {
    return {
      label: "Due soon",
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  }

  if (absMs < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(absMs / (60 * 1000)));
    return {
      label: `In ${minutes}m`,
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  }

  if (absMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(absMs / (60 * 60 * 1000)));
    return {
      label: `In ${hours}h`,
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  }

  const days = Math.max(1, Math.round(absMs / (24 * 60 * 60 * 1000)));
  return {
    label: `In ${days}d`,
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
  };
}

export function stripHtml(input: string | undefined): string {
  if (!input) {
    return "";
  }

  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function primaryReadingForDisplay(item: LevelItem): string | null {
  const reading = (item.primaryReadings ?? [])[0] ?? null;
  if (reading) {
    return reading;
  }

  if (item.subjectType === "radical") {
    return null;
  }

  return "-";
}

export function glyphSubtitleForDisplay(item: LevelItem): string | null {
  if (item.subjectType === "radical") {
    return item.meanings[0] ?? null;
  }

  return primaryReadingForDisplay(item);
}

export function englishSubtitleForDisplay(item: LevelItem): string | null {
  if (item.subjectType === "radical") {
    return item.meanings[0] ?? null;
  }

  const reading = primaryReadingForDisplay(item);
  if (!reading) {
    return null;
  }

  const pronunciation = pronunciationForReading(reading);
  return pronunciation ? `${reading} / ${pronunciation}` : reading;
}

export function titleForDisplay(item: LevelItem, showEnglish: boolean): string {
  if (showEnglish) {
    return item.meanings.join(", ") || "-";
  }

  const subtitle = glyphSubtitleForDisplay(item);
  if (subtitle && subtitle !== "-") {
    return subtitle;
  }

  return item.characters || "-";
}

export function glyphHasReading(item: LevelItem): boolean {
  return Boolean(glyphSubtitleForDisplay(item));
}

export function pronunciationForReading(reading: string | null | undefined): string | null {
  if (!reading) {
    return null;
  }

  const trimmed = reading.trim();
  if (!trimmed || trimmed === "-") {
    return null;
  }

  const romaji = toRomaji(trimmed, { upcaseKatakana: false }).trim();
  if (!romaji || romaji === trimmed) {
    return null;
  }

  return romaji;
}

export function ReadingWithPronunciation({
  reading,
  className,
}: {
  reading: string;
  className?: string;
}) {
  const pronunciation = pronunciationForReading(reading);

  if (!pronunciation) {
    return <span className={className}>{reading}</span>;
  }

  return (
    <span
      className={className}
      title={`Pronunciation: ${pronunciation}`}
      aria-label={`${reading} pronunciation ${pronunciation}`}
    >
      {reading}
    </span>
  );
}

export function ReadingListWithPronunciation({
  readings,
  mode = "tooltip",
}: {
  readings: string[];
  mode?: "tooltip" | "inline" | "plain";
}) {
  if (readings.length === 0) {
    return <span>-</span>;
  }

  if (mode === "plain") {
    return <>{readings.join(", ")}</>;
  }

  if (mode === "inline") {
    return (
      <>
        {readings.map((reading, index) => {
          const pronunciation = pronunciationForReading(reading);
          const label = pronunciation ? `${reading} / ${pronunciation}` : reading;

          return (
            <Fragment key={`${reading}-${index}`}>
              {index > 0 ? ", " : null}
              <span>{label}</span>
            </Fragment>
          );
        })}
      </>
    );
  }

  return (
    <>
      {readings.map((reading, index) => (
        <Fragment key={`${reading}-${index}`}>
          {index > 0 ? ", " : null}
          <ReadingWithPronunciation reading={reading} />
        </Fragment>
      ))}
    </>
  );
}

export function secondaryReadingsForDisplay(item: LevelItem): string[] {
  const primary = new Set((item.primaryReadings ?? []).map((reading) => reading.trim()));
  const allReadings = (item.readings ?? [])
    .map((reading) => reading.trim())
    .filter((reading) => Boolean(reading));

  const seen = new Set<string>();
  const secondary: string[] = [];

  for (const reading of allReadings) {
    if (primary.has(reading) || seen.has(reading)) {
      continue;
    }

    seen.add(reading);
    secondary.push(reading);
  }

  return secondary;
}

export function badgeClass(active: boolean): string {
  return active
    ? "border-accent bg-accent text-white"
    : "border-line bg-surface text-foreground hover:bg-surface-muted";
}

export function disabledBadgeClass(): string {
  return "cursor-not-allowed border-line bg-surface-muted text-foreground/45";
}

export function typeBadgeClass(type: TypeFilter, active: boolean, disabled: boolean): string {
  if (disabled) {
    return disabledBadgeClass();
  }

  if (type === "radical") {
    return active
      ? "border-radical bg-radical text-white"
      : "border-radical/50 bg-radical/10 text-radical hover:bg-radical/20";
  }

  if (type === "kanji") {
    return active
      ? "border-kanji bg-kanji text-white"
      : "border-kanji/50 bg-kanji/10 text-kanji hover:bg-kanji/20";
  }

  if (type === "vocabulary") {
    return active
      ? "border-vocabulary bg-vocabulary text-white"
      : "border-vocabulary/50 bg-vocabulary/10 text-vocabulary hover:bg-vocabulary/20";
  }

  return badgeClass(active);
}

export function subjectTypePillClass(type: LevelItem["subjectType"]): string {
  if (type === "radical") {
    return "subject-pill subject-pill--radical";
  }

  if (type === "kanji") {
    return "subject-pill subject-pill--kanji";
  }

  if (type === "vocabulary") {
    return "subject-pill subject-pill--vocabulary";
  }

  return "subject-pill";
}

export function typeCardClass(type: LevelItem["subjectType"], selected: boolean): string {
  const selectedRing = selected ? "ring-2 ring-accent" : "";
  if (type === "radical") {
    return `border-radical/50 bg-surface text-foreground ${selectedRing}`;
  }
  if (type === "kanji") {
    return `border-kanji/50 bg-surface text-foreground ${selectedRing}`;
  }
  if (type === "vocabulary") {
    return `border-vocabulary/50 bg-surface text-foreground ${selectedRing}`;
  }
  return `border-line bg-surface text-foreground ${selectedRing}`;
}

export function lockedCardStateClass(item: LevelItem): string {
  if (item.status !== "locked" && item.srsStage > 0) {
    return "";
  }

  return "bg-surface-muted/90 text-foreground/60";
}

export function typeGlyphBoxClass(type: LevelItem["subjectType"]): string {
  if (type === "radical") {
    return "border-radical/50 bg-radical/15 text-radical";
  }
  if (type === "kanji") {
    return "border-kanji/50 bg-kanji/15 text-kanji";
  }
  if (type === "vocabulary") {
    return "border-vocabulary/50 bg-vocabulary/15 text-vocabulary";
  }
  return "border-line bg-surface text-foreground";
}

export function glyphTextSizeClass(characters: string): string {
  const length = Array.from(characters).length;
  if (length >= 5) {
    return "text-4xl";
  }
  if (length >= 3) {
    return "text-5xl";
  }
  return "text-6xl";
}

export function relatedReferenceCardClass(
  type: LevelItem["subjectType"],
  isClickable: boolean,
  size: "normal" | "large",
): string {
  const base =
    "rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70";
  const sizeClass = size === "large" ? "px-4 py-3" : "px-3 py-2";

  if (type === "radical") {
    return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-radical/50 bg-radical/10 text-radical hover:bg-radical/20" : "border-radical/30 bg-radical/5 text-radical/80"}`;
  }

  if (type === "kanji") {
    return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-kanji/50 bg-kanji/10 text-kanji hover:bg-kanji/20" : "border-kanji/30 bg-kanji/5 text-kanji/80"}`;
  }

  if (type === "vocabulary") {
    return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-vocabulary/50 bg-vocabulary/10 text-vocabulary hover:bg-vocabulary/20" : "border-vocabulary/30 bg-vocabulary/5 text-vocabulary/80"}`;
  }

  return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-line bg-surface text-foreground hover:bg-surface-muted" : "border-line bg-surface-muted text-foreground/60"}`;
}
