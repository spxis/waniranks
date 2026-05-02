import { newsGlyphButtonClass } from "./newsGlyphBoxStyle";
import { openNewsGlyphRun } from "./newsGlyphRunner";
import type {
  AllCountFilter,
  AllCoverageFilter,
  EntrySortMode,
  KanjiEntry,
} from "./NewsKanjiOverviewPanel.types";

const japaneseCollator = new Intl.Collator("ja");

export function SegmentButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] transition",
        selected
          ? "bg-accent text-white shadow-sm"
          : "text-foreground/70 hover:bg-surface hover:text-foreground",
      ].join(" ")}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

export function sortGroupsForDisplay(
  groups: Array<{ label: string; entries: KanjiEntry[] }>,
  mode: EntrySortMode,
): Array<{ label: string; entries: KanjiEntry[] }> {
  if (mode === "article") {
    return groups;
  }

  return groups.map((group) => ({
    ...group,
    entries: sortEntries(group.entries, mode),
  }));
}

function sortEntries(entries: KanjiEntry[], mode: EntrySortMode): KanjiEntry[] {
  const sorted = [...entries];

  if (mode === "count") {
    return sorted.sort((a, b) => {
      if (a.occurrenceCount !== b.occurrenceCount) {
        return b.occurrenceCount - a.occurrenceCount;
      }
      return japaneseCollator.compare(a.char, b.char);
    });
  }

  return sorted.sort((a, b) => japaneseCollator.compare(a.char, b.char));
}

export function GroupColumn({
  title,
  groups,
  emptyMessage,
}: {
  title: string;
  groups: Array<{ label: string; entries: KanjiEntry[] }>;
  emptyMessage?: string;
}) {
  const totalEntries = groups.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <article className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-foreground/70">{title}</p>
      {totalEntries === 0 ? (
        <div className="mt-2 rounded-lg border border-dashed border-line bg-surface-muted/70 px-3 py-3 text-xs font-semibold text-foreground/65">
          {emptyMessage ?? "No kanji found for this view."}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {groups.map((group) => (
            <div key={group.label} className="rounded-lg border border-line/70 bg-surface-muted/60 p-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">
                {group.label} ({group.entries.length})
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {group.entries.map((entry) => (
                  <div key={`${group.label}-${entry.char}`} className="relative inline-flex">
                    {entry.occurrenceCount > 1 ? (
                      <span className="pointer-events-none absolute right-0 top-0 z-10 min-w-4 -translate-y-1/3 translate-x-1/3 rounded-full border border-line bg-surface px-1 py-0.5 text-center text-[9px] font-bold leading-none text-foreground/75 shadow-sm">
                        {entry.occurrenceCount}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        void openNewsGlyphRun(entry.char);
                      }}
                      className={newsGlyphButtonClass({
                        type: "kanji",
                        clickable: true,
                      })}
                      title={`Look up ${entry.char}`}
                    >
                      {entry.char}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function buildGroups(
  entries: KanjiEntry[],
  labelOf: (entry: KanjiEntry) => string,
): Array<{ label: string; entries: KanjiEntry[] }> {
  const grouped = new Map<string, KanjiEntry[]>();

  for (const entry of entries) {
    const label = labelOf(entry);
    const existingEntries = grouped.get(label) ?? [];
    existingEntries.push(entry);
    grouped.set(label, existingEntries);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => compareLabels(a[0], b[0]))
    .map(([label, groupedEntries]) => ({ label, entries: groupedEntries }));
}

function compareLabels(a: string, b: string): number {
  const rank = (value: string) => {
    if (value === "Loading") {
      return Number.NEGATIVE_INFINITY;
    }

    if (value === "Unknown") {
      return Number.POSITIVE_INFINITY;
    }

    const numeric = Number(value.replace(/[^0-9]/g, ""));
    if (Number.isFinite(numeric)) {
      if (value.startsWith("N")) {
        return -numeric;
      }
      return numeric;
    }

    return Number.POSITIVE_INFINITY - 1;
  };

  return rank(a) - rank(b);
}

export function matchesAllFilters(
  entry: KanjiEntry,
  countFilter: AllCountFilter,
  coverageFilter: AllCoverageFilter,
): boolean {
  if (!matchesCountFilter(entry.occurrenceCount, countFilter)) {
    return false;
  }

  if (!matchesCoverageFilter(entry, coverageFilter)) {
    return false;
  }

  return true;
}

export function matchesCountFilter(count: number, filter: AllCountFilter): boolean {
  if (filter === "2+") {
    return count >= 2;
  }
  if (filter === "5+") {
    return count >= 5;
  }
  if (filter === "10+") {
    return count >= 10;
  }
  if (filter === "25+") {
    return count >= 25;
  }
  if (filter === "50+") {
    return count >= 50;
  }
  return true;
}

function matchesCoverageFilter(entry: KanjiEntry, filter: AllCoverageFilter): boolean {
  if (filter === "wk-known") {
    return entry.wkLevel !== null;
  }

  if (filter === "wk-unknown") {
    return entry.wkLevel === null;
  }

  if (filter === "no-level-data") {
    return entry.wkLevel === null && entry.jlptLevel === null && entry.schoolGrade === null;
  }

  return true;
}
