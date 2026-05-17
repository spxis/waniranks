import { fetchAllCollectionPages, fetchWaniKani } from "@/lib/wanikani/http";
import type { WaniKaniCollectionResponse } from "@/lib/wanikani/types";
import { SUBJECT_TYPES, type SubjectType } from "@/lib/domainConstants";

export type AssignmentData = {
  subject_id: number;
  subject_type: string;
  srs_stage: number;
  unlocked_at: string | null;
  started_at: string | null;
  passed_at: string | null;
  available_at: string | null;
};

export type SubjectData = {
  level?: number;
  characters?: string | null;
  slug?: string | null;
  component_subject_ids?: number[];
  amalgamation_subject_ids?: number[];
  visually_similar_subject_ids?: number[];
  meanings?: Array<{ meaning: string; primary?: boolean }>;
  auxiliary_meanings?: Array<{ meaning: string; type?: string }>;
  readings?: Array<{ reading: string; primary?: boolean; accepted_answer?: boolean }>;
  meaning_mnemonic?: string;
  reading_mnemonic?: string;
};

export type QueueMode = "review" | "lesson";

export type AssignmentRow = {
  id: number;
  data: AssignmentData;
};

export type CachedSubjectRow = {
  object: string;
  data: SubjectData;
  fetchedAtMs: number;
};

export type QueueSyncState = {
  assignmentById: Map<number, AssignmentRow>;
  subjectById: Map<number, CachedSubjectRow>;
};

export const ASSIGNMENT_FULL_RESYNC_MS = 10 * 60_000;
export const SUBJECT_CACHE_TTL_MS = 24 * 60 * 60_000;
export const ASSIGNMENT_CHUNK_SIZE = 200;
export const SUBJECT_CACHE_MAX_ENTRIES = 2_500;

export function normalizeSubjectType(input: string): SubjectType {
  if (input === SUBJECT_TYPES.radical || input === SUBJECT_TYPES.kanji) {
    return input;
  }

  return SUBJECT_TYPES.vocabulary;
}

export function modePathParam(mode: QueueMode): string {
  return mode === "review"
    ? "immediately_available_for_review=true"
    : "srs_stages=0";
}

export async function hydrateMissingSubjects(
  token: string,
  subjectById: Map<number, { object: string; data: SubjectData }>,
  subjectIds: number[],
): Promise<void> {
  const missingIds = subjectIds.filter((subjectId) => !subjectById.has(subjectId));

  for (let i = 0; i < missingIds.length; i += ASSIGNMENT_CHUNK_SIZE) {
    const chunkIds = missingIds.slice(i, i + ASSIGNMENT_CHUNK_SIZE);
    if (chunkIds.length === 0) {
      continue;
    }

    const collection = await fetchAllCollectionPages(`/subjects?ids=${chunkIds.join(",")}`, token);
    for (const row of collection.data) {
      subjectById.set(row.id, {
        object: row.object ?? "subject",
        data: row.data as SubjectData,
      });
    }
  }
}

export function buildImmediateAssignmentsPath(mode: QueueMode): string {
  return `/assignments?${modePathParam(mode)}`;
}

export function toAssignmentRows(collection: WaniKaniCollectionResponse): AssignmentRow[] {
  return collection.data.map((row) => ({
    id: row.id,
    data: row.data as AssignmentData,
  }));
}

export function trimSubjectCache(input: Map<number, CachedSubjectRow>, activeSubjectIds: Set<number>): void {
  for (const subjectId of input.keys()) {
    if (!activeSubjectIds.has(subjectId)) {
      input.delete(subjectId);
    }
  }

  if (input.size <= SUBJECT_CACHE_MAX_ENTRIES) {
    return;
  }

  const sorted = Array.from(input.entries()).sort((a, b) => a[1].fetchedAtMs - b[1].fetchedAtMs);
  const toRemove = sorted.slice(0, Math.max(0, sorted.length - SUBJECT_CACHE_MAX_ENTRIES));
  for (const [subjectId] of toRemove) {
    input.delete(subjectId);
  }
}

export function queueRowsFromState(
  state: QueueSyncState,
  queueType: "review" | "lesson",
): Array<{ assignmentId: number; data: AssignmentData; queueType: "review" | "lesson" }> {
  const rows: Array<{ assignmentId: number; data: AssignmentData; queueType: "review" | "lesson" }> = [];

  for (const assignment of state.assignmentById.values()) {
    // "Lessons" in this UI means unstarted lessons. Once started, they should
    // move out of the lesson queue (even if WK still reports srs_stage=0).
    if (queueType === "lesson" && assignment.data.started_at) {
      continue;
    }

    rows.push({
      assignmentId: assignment.id,
      data: assignment.data,
      queueType,
    });
  }

  return rows;
}

export async function fetchAssignmentCount(path: string, token: string): Promise<number> {
  const response = await fetchWaniKani<WaniKaniCollectionResponse>(path, token);
  return response.data?.total_count ?? 0;
}
