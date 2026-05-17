import type {
  AssignmentCacheRow,
  GuruedItemSummary,
  HttpCacheEntry,
  HttpCacheState,
  WaniKaniCollectionResponse,
  WaniKaniResponseHeaders,
} from "./types";
import { SUBJECT_STATUSES, SUBJECT_TYPES, type SubjectStatus } from "@/lib/domainConstants";

export function srsLabel(stage: number, locked: boolean):
  SubjectStatus {
  if (locked) {
    return SUBJECT_STATUSES.locked;
  }

  if (stage >= 9) {
    return SUBJECT_STATUSES.burned;
  }

  if (stage >= 8) {
    return SUBJECT_STATUSES.enlightened;
  }

  if (stage >= 7) {
    return SUBJECT_STATUSES.master;
  }

  if (stage >= 5) {
    return SUBJECT_STATUSES.guru;
  }

  return SUBJECT_STATUSES.apprentice;
}

export function toDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeAssignmentType(input: string): "radical" | "kanji" | "vocabulary" | null {
  if (input === SUBJECT_TYPES.radical || input === SUBJECT_TYPES.kanji) {
    return input;
  }

  if (input === SUBJECT_TYPES.vocabulary || input === "kana_vocabulary") {
    return SUBJECT_TYPES.vocabulary;
  }

  return null;
}

export function parseGuruedItemSummary(input: unknown): GuruedItemSummary | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const row = input as Record<string, unknown>;
  const subjectId = typeof row.subjectId === "number" ? row.subjectId : null;
  const label = typeof row.label === "string" ? row.label : null;
  const reading = typeof row.reading === "string" ? row.reading : null;
  const passedAt = typeof row.passedAt === "string" ? row.passedAt : null;

  if (!subjectId || !label || !passedAt) {
    return null;
  }

  return { subjectId, label, reading, passedAt };
}

export function parseHttpCacheState(input: unknown): HttpCacheState {
  if (!input || typeof input !== "object") {
    return {};
  }

  const record = input as Record<string, unknown>;
  const keys: Array<keyof HttpCacheState> = ["user", "reviewStats", "burnedAssignments"];
  const output: HttpCacheState = {};

  for (const key of keys) {
    const entry = record[key];
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const row = entry as Record<string, unknown>;
    const etag = typeof row.etag === "string" ? row.etag : null;
    const lastModified = typeof row.lastModified === "string" ? row.lastModified : null;
    output[key] = { etag, lastModified };
  }

  return output;
}

export function maxDate(input: Array<Date | null>): Date | null {
  const values = input
    .filter((item): item is Date => item !== null)
    .map((item) => item.getTime());

  if (values.length === 0) {
    return null;
  }

  return new Date(Math.max(...values));
}

export function reviewsCheckpointDate(collection: WaniKaniCollectionResponse): Date | null {
  const collectionUpdatedAt = toDate(collection.data_updated_at);
  const rowUpdatedAt = maxDate(collection.data.map((row) => toDate(row.data_updated_at)));
  return maxDate([collectionUpdatedAt, rowUpdatedAt]);
}

export function mergeHttpCacheEntry(
  previous: HttpCacheEntry | undefined,
  headers: WaniKaniResponseHeaders,
): HttpCacheEntry {
  return {
    etag: headers.etag ?? previous?.etag ?? null,
    lastModified: headers.lastModified ?? previous?.lastModified ?? null,
  };
}

export function parseAssignmentCacheRows(input: unknown): AssignmentCacheRow[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: typeof item.id === "number" ? item.id : -1,
        object: typeof item.object === "string" ? item.object : undefined,
        data_updated_at:
          typeof item.data_updated_at === "string" ? item.data_updated_at : undefined,
        data:
          item.data && typeof item.data === "object"
            ? (item.data as Record<string, unknown>)
            : {},
      };
    })
    .filter((row) => row.id >= 0);
}

export function maxAssignmentUpdatedAt(rows: AssignmentCacheRow[]): Date | null {
  const timestamps = rows
    .map((row) => toDate(row.data_updated_at))
    .filter((value): value is Date => value !== null)
    .map((value) => value.getTime());

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
}

export function mergeAssignmentRows(
  existingRows: AssignmentCacheRow[],
  updates: AssignmentCacheRow[],
): AssignmentCacheRow[] {
  const byId = new Map<number, AssignmentCacheRow>();

  for (const row of existingRows) {
    byId.set(row.id, row);
  }

  for (const row of updates) {
    byId.set(row.id, row);
  }

  return Array.from(byId.values());
}
