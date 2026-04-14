import type { LevelItem, RelatedReference } from "../../explorerTypes";
import { pronunciationForReading, relatedReferenceCardClass } from "../lib/levelExplorerDisplay";

type RelatedEntry = {
  subjectId: number;
  label: string;
  wkLevel: number | null;
  reading: string | null;
  fallbackKey?: string;
};

export type VocabularyKanjiLink = {
  char: string;
  subjectId: number;
  reading: string;
  wkLevel: number | null;
};

function expandRelatedReferences(items: RelatedReference[]): RelatedEntry[] {
  return items.flatMap((item) => {
    const segments = item.label
      .split(/[、,]/)
      .map((segment) => segment.trim())
      .filter((segment) => Boolean(segment));

    if (segments.length <= 1) {
      return [
        {
          subjectId: item.subjectId,
          label: item.label,
          wkLevel: item.wkLevel ?? null,
          reading: item.reading ?? null,
        },
      ];
    }

    return segments.map((segment, index) => ({
      subjectId: item.subjectId,
      label: segment,
      wkLevel: item.wkLevel ?? null,
      reading: null,
      fallbackKey: `${item.subjectId}-${segment}-${index}`,
    }));
  });
}

function labelClass(label: string, size: "normal" | "large"): string {
  if (size === "normal") return "text-xl";

  const length = Array.from(label).length;
  if (length <= 2) return "text-4xl";
  if (length <= 4) return "text-3xl";
  return "text-2xl";
}

export function RelatedReferenceCards({
  items,
  large,
  showEnglish,
  subjectById,
  onJumpToRelatedSubject,
}: {
  items: RelatedReference[];
  large?: boolean;
  showEnglish: boolean;
  subjectById: Map<number, LevelItem>;
  onJumpToRelatedSubject: (subjectId: number, targetLevel?: number | null) => Promise<void>;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-foreground/60">-</p>;
  }

  const size = large ? "large" : "normal";
  const expandedItems = expandRelatedReferences(items);

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {expandedItems.map((entry, index) => {
        const linked = subjectById.get(entry.subjectId) ?? null;
        const isClickable = linked !== null || typeof entry.wkLevel === "number";
        const relationType = linked?.subjectType;
        const reading = typeof entry.reading === "string" && entry.reading.trim() ? entry.reading : null;
        const subtitle = (() => {
          if (!reading) return null;
          if (!showEnglish) return reading;

          const pronunciation = pronunciationForReading(reading);
          return pronunciation ? `${reading} / ${pronunciation}` : reading;
        })();
        const key = entry.fallbackKey ?? `${entry.subjectId}-${entry.label}-${index}`;

        if (!isClickable) {
          return (
            <span
              key={key}
              className={`${relatedReferenceCardClass(relationType, false, size)} inline-flex flex-col items-center`}
            >
              <span className={`${labelClass(entry.label, size)} font-black leading-none`}>{entry.label}</span>
              {subtitle ? (
                <span className="mt-1 text-center text-sm font-semibold leading-none text-foreground/70">
                  {subtitle}
                </span>
              ) : null}
            </span>
          );
        }

        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              void onJumpToRelatedSubject(entry.subjectId, entry.wkLevel ?? linked?.wkLevel ?? null);
            }}
            className={`${relatedReferenceCardClass(relationType, true, size)} inline-flex flex-col items-center`}
          >
            <span className={`${labelClass(entry.label, size)} font-black leading-none`}>{entry.label}</span>
            {subtitle ? (
              <span className="mt-1 text-center text-sm font-semibold leading-none text-foreground/70">
                {subtitle}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function VocabularyKanjiCards({
  links,
  showEnglish,
  selectedSubjectId,
  onJumpToKanji,
}: {
  links: VocabularyKanjiLink[];
  showEnglish: boolean;
  selectedSubjectId: number;
  onJumpToKanji: (subjectId: number, wkLevel: number | null) => Promise<void>;
}) {
  if (links.length === 0) {
    return <p className="mt-2 text-foreground/60">-</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap justify-center gap-2">
      {links.map((item) => {
        const subtitle = (() => {
          if (!showEnglish) return item.reading;
          const pronunciation = pronunciationForReading(item.reading);
          return pronunciation ? `${item.reading} / ${pronunciation}` : item.reading;
        })();

        return (
          <button
            key={`${selectedSubjectId}-${item.subjectId}`}
            type="button"
            onClick={() => {
              void onJumpToKanji(item.subjectId, item.wkLevel);
            }}
            className="inline-flex cursor-pointer flex-col items-center rounded-xl border border-kanji/50 bg-kanji/10 px-4 py-3 text-center text-kanji transition hover:bg-kanji/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            <span className="text-4xl font-black leading-none">{item.char}</span>
            {subtitle ? (
              <span className="mt-1 w-full text-center text-sm font-semibold leading-none text-foreground/70">
                {subtitle}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
