export const SUBJECT_TYPES = {
  radical: "radical",
  kanji: "kanji",
  vocabulary: "vocabulary",
} as const;

export type SubjectType = (typeof SUBJECT_TYPES)[keyof typeof SUBJECT_TYPES];

export const SUBJECT_STATUSES = {
  locked: "locked",
  apprentice: "apprentice",
  guru: "guru",
  master: "master",
  enlightened: "enlightened",
  burned: "burned",
} as const;

export type SubjectStatus = (typeof SUBJECT_STATUSES)[keyof typeof SUBJECT_STATUSES];

export const SRS_BUCKETS = {
  unknown: "unknown",
  locked: SUBJECT_STATUSES.locked,
  apprentice: SUBJECT_STATUSES.apprentice,
  guru: SUBJECT_STATUSES.guru,
  master: SUBJECT_STATUSES.master,
  enlightened: SUBJECT_STATUSES.enlightened,
  burned: SUBJECT_STATUSES.burned,
} as const;

export type SrsBucket = (typeof SRS_BUCKETS)[keyof typeof SRS_BUCKETS];

export const SUBJECT_TYPE_VALUES: SubjectType[] = [
  SUBJECT_TYPES.radical,
  SUBJECT_TYPES.kanji,
  SUBJECT_TYPES.vocabulary,
];

export const SUBJECT_STATUS_VALUES: SubjectStatus[] = [
  SUBJECT_STATUSES.locked,
  SUBJECT_STATUSES.apprentice,
  SUBJECT_STATUSES.guru,
  SUBJECT_STATUSES.master,
  SUBJECT_STATUSES.enlightened,
  SUBJECT_STATUSES.burned,
];

export function isSubjectType(value: string | null | undefined): value is SubjectType {
  return value === SUBJECT_TYPES.radical || value === SUBJECT_TYPES.kanji || value === SUBJECT_TYPES.vocabulary;
}

export function isSubjectStatus(value: string | null | undefined): value is SubjectStatus {
  return (
    value === SUBJECT_STATUSES.locked ||
    value === SUBJECT_STATUSES.apprentice ||
    value === SUBJECT_STATUSES.guru ||
    value === SUBJECT_STATUSES.master ||
    value === SUBJECT_STATUSES.enlightened ||
    value === SUBJECT_STATUSES.burned
  );
}

export function srsBucketFromStage(stage: number | null): SrsBucket {
  if (!Number.isInteger(stage) || stage === null) {
    return SRS_BUCKETS.unknown;
  }

  if (stage <= 0) {
    return SRS_BUCKETS.locked;
  }
  if (stage <= 4) {
    return SRS_BUCKETS.apprentice;
  }
  if (stage <= 6) {
    return SRS_BUCKETS.guru;
  }
  if (stage === 7) {
    return SRS_BUCKETS.master;
  }
  if (stage === 8) {
    return SRS_BUCKETS.enlightened;
  }
  if (stage >= 9) {
    return SRS_BUCKETS.burned;
  }

  return SRS_BUCKETS.unknown;
}
