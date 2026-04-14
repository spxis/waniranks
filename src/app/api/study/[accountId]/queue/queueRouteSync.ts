import {
  getCachedStudyQueueSyncState,
  setCachedStudyQueueSyncState,
} from "@/lib/studyQueueCache";
import { fetchAllCollectionPages } from "@/lib/wanikani/http";

import {
  ASSIGNMENT_CHUNK_SIZE,
  ASSIGNMENT_FULL_RESYNC_MS,
  SUBJECT_CACHE_TTL_MS,
  buildImmediateAssignmentsPath,
  modePathParam,
  toAssignmentRows,
  trimSubjectCache,
  type AssignmentRow,
  type CachedSubjectRow,
  type QueueMode,
  type QueueSyncState,
  type SubjectData,
} from "./queueRouteUtils";

async function fetchEligibleAssignmentIds(
  token: string,
  mode: QueueMode,
  assignmentIds: number[],
): Promise<Set<number>> {
  const output = new Set<number>();

  for (let i = 0; i < assignmentIds.length; i += ASSIGNMENT_CHUNK_SIZE) {
    const chunk = assignmentIds.slice(i, i + ASSIGNMENT_CHUNK_SIZE).join(",");
    if (!chunk) {
      continue;
    }

    const collection = await fetchAllCollectionPages(
      `/assignments?ids=${chunk}&${modePathParam(mode)}`,
      token,
    );

    for (const row of collection.data) {
      output.add(row.id);
    }
  }

  return output;
}

export async function hydrateQueueSyncState(
  accountId: string,
  mode: QueueMode,
  token: string,
): Promise<QueueSyncState> {
  const nowMs = Date.now();
  const cachedState = getCachedStudyQueueSyncState(accountId, mode);
  const assignmentById = new Map<number, AssignmentRow>();
  const subjectById = new Map<number, CachedSubjectRow>();

  if (cachedState) {
    for (const [id, row] of cachedState.assignmentById.entries()) {
      assignmentById.set(id, row as AssignmentRow);
    }

    for (const [id, row] of cachedState.subjectById.entries()) {
      subjectById.set(id, row as CachedSubjectRow);
    }
  }

  let assignmentCheckpoint = cachedState?.assignmentCheckpoint ?? null;
  const shouldFullResync =
    !cachedState ||
    !assignmentCheckpoint ||
    nowMs - cachedState.lastFullSyncAtMs > ASSIGNMENT_FULL_RESYNC_MS;
  let lastFullSyncAtMs = cachedState?.lastFullSyncAtMs ?? 0;

  if (shouldFullResync) {
    assignmentById.clear();
    const fullCollection = await fetchAllCollectionPages(buildImmediateAssignmentsPath(mode), token);
    for (const row of toAssignmentRows(fullCollection)) {
      assignmentById.set(row.id, row);
    }

    assignmentCheckpoint = fullCollection.data_updated_at ?? assignmentCheckpoint;
    lastFullSyncAtMs = nowMs;
  } else if (assignmentCheckpoint) {
    const updates = await fetchAllCollectionPages(
      `/assignments?updated_after=${encodeURIComponent(assignmentCheckpoint)}`,
      token,
    );
    const updatedRows = toAssignmentRows(updates);

    if (updatedRows.length > 0) {
      const eligibleUpdatedIds = await fetchEligibleAssignmentIds(
        token,
        mode,
        updatedRows.map((row) => row.id),
      );

      for (const row of updatedRows) {
        if (eligibleUpdatedIds.has(row.id)) {
          assignmentById.set(row.id, row);
        } else {
          assignmentById.delete(row.id);
        }
      }
    }

    assignmentCheckpoint = updates.data_updated_at ?? assignmentCheckpoint;
  }

  const queueSubjectIds = new Set<number>();
  for (const row of assignmentById.values()) {
    queueSubjectIds.add(row.data.subject_id);
  }

  const staleOrMissingSubjectIds = Array.from(queueSubjectIds).filter((subjectId) => {
    const existing = subjectById.get(subjectId);
    if (!existing) {
      return true;
    }

    return nowMs - existing.fetchedAtMs > SUBJECT_CACHE_TTL_MS;
  });

  for (let i = 0; i < staleOrMissingSubjectIds.length; i += ASSIGNMENT_CHUNK_SIZE) {
    const chunk = staleOrMissingSubjectIds.slice(i, i + ASSIGNMENT_CHUNK_SIZE).join(",");
    if (!chunk) {
      continue;
    }

    const subjectCollection = await fetchAllCollectionPages(`/subjects?ids=${chunk}`, token);
    for (const row of subjectCollection.data) {
      subjectById.set(row.id, {
        object: row.object ?? "subject",
        data: row.data as SubjectData,
        fetchedAtMs: nowMs,
      });
    }
  }

  trimSubjectCache(subjectById, queueSubjectIds);

  setCachedStudyQueueSyncState(accountId, mode, {
    assignmentById: assignmentById as Map<number, unknown>,
    subjectById: subjectById as Map<number, unknown>,
    assignmentCheckpoint,
    lastFullSyncAtMs,
  });

  return {
    assignmentById,
    subjectById,
  };
}
