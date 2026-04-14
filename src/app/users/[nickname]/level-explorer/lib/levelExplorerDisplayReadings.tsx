import { Fragment } from "react";
import { toRomaji } from "wanakana";

import type { LevelItem } from "../../explorerTypes";

export function stripHtml(input: string | undefined): string {
  if (!input) {
    return "";
  }
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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
