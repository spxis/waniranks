import type { StudyCounts, StudyQueueItem } from "./studyExplorerTypes";

export function sameAssignmentList(a: StudyQueueItem[], b: StudyQueueItem[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index]?.assignmentId !== b[index]?.assignmentId) {
      return false;
    }
  }

  return true;
}

export function sameCounts(a: StudyCounts | null | undefined, b: StudyCounts | null | undefined): boolean {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return a.all === b.all && a.reviews === b.reviews && a.lessons === b.lessons;
}

export function sameTypeCounts(
  a: { all: number; radical: number; kanji: number; vocabulary: number } | undefined,
  b: { all: number; radical: number; kanji: number; vocabulary: number } | undefined,
): boolean {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return (
    a.all === b.all &&
    a.radical === b.radical &&
    a.kanji === b.kanji &&
    a.vocabulary === b.vocabulary
  );
}

export function sameLevelCounts(a: Record<number, number> | undefined, b: Record<number, number> | undefined): boolean {
  const aEntries = Object.entries(a ?? {});
  const bEntries = Object.entries(b ?? {});

  if (aEntries.length !== bEntries.length) {
    return false;
  }

  const bMap = new Map(bEntries);
  for (const [key, value] of aEntries) {
    if (Number(bMap.get(key)) !== Number(value)) {
      return false;
    }
  }

  return true;
}

export function sameTypeCountsByLevel(
  a: Record<number, { all: number; radical: number; kanji: number; vocabulary: number }> | undefined,
  b: Record<number, { all: number; radical: number; kanji: number; vocabulary: number }> | undefined,
): boolean {
  const aEntries = Object.entries(a ?? {});
  const bEntries = Object.entries(b ?? {});

  if (aEntries.length !== bEntries.length) {
    return false;
  }

  const bMap = new Map(bEntries);
  for (const [key, value] of aEntries) {
    const other = bMap.get(key);
    if (!other || !sameTypeCounts(value, other)) {
      return false;
    }
  }

  return true;
}
