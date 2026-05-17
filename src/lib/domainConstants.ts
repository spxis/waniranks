export const SUBJECT_TYPES = {
  radical: "radical",
  kanji: "kanji",
  vocabulary: "vocabulary",
} as const;

export type SubjectType = (typeof SUBJECT_TYPES)[keyof typeof SUBJECT_TYPES];

export const WK_STATUSES = {
  locked: "locked",
  apprentice: "apprentice",
  guru: "guru",
  master: "master",
  enlightened: "enlightened",
  burned: "burned",
} as const;

export type WkStatus = (typeof WK_STATUSES)[keyof typeof WK_STATUSES];

export const SRS_BUCKETS = {
  unknown: "unknown",
  locked: WK_STATUSES.locked,
  apprentice: WK_STATUSES.apprentice,
  guru: WK_STATUSES.guru,
  master: WK_STATUSES.master,
  enlightened: WK_STATUSES.enlightened,
  burned: WK_STATUSES.burned,
} as const;

export type SrsBucket = (typeof SRS_BUCKETS)[keyof typeof SRS_BUCKETS];

export const LEARNED_SRS_GROUPS = [
  WK_STATUSES.apprentice,
  WK_STATUSES.guru,
  WK_STATUSES.master,
  WK_STATUSES.enlightened,
  WK_STATUSES.burned,
] as const;

export type LearnedSrsGroup = (typeof LEARNED_SRS_GROUPS)[number];

export const LEARNED_SRS_GROUP_LABELS = [
  { key: WK_STATUSES.apprentice, label: "Apprentice", shortLabel: "Appr" },
  { key: WK_STATUSES.guru, label: "Guru", shortLabel: "Guru" },
  { key: WK_STATUSES.master, label: "Master", shortLabel: "Mstr" },
  { key: WK_STATUSES.enlightened, label: "Enlightened", shortLabel: "Enl" },
  { key: WK_STATUSES.burned, label: "Burned", shortLabel: "Burn" },
] as const;

export const SRS_PROGRESS_STATUSES = [
  ...LEARNED_SRS_GROUPS,
  WK_STATUSES.locked,
] as const;

export type SrsProgressStatus = (typeof SRS_PROGRESS_STATUSES)[number];

export const SUBJECT_TYPE_VALUES: SubjectType[] = [
  SUBJECT_TYPES.radical,
  SUBJECT_TYPES.kanji,
  SUBJECT_TYPES.vocabulary,
];

export const WK_STATUS_VALUES: WkStatus[] = [
  WK_STATUSES.locked,
  WK_STATUSES.apprentice,
  WK_STATUSES.guru,
  WK_STATUSES.master,
  WK_STATUSES.enlightened,
  WK_STATUSES.burned,
];

export function isSubjectType(value: string | null | undefined): value is SubjectType {
  return value === SUBJECT_TYPES.radical || value === SUBJECT_TYPES.kanji || value === SUBJECT_TYPES.vocabulary;
}

export function isWkStatus(value: string | null | undefined): value is WkStatus {
  return (
    value === WK_STATUSES.locked ||
    value === WK_STATUSES.apprentice ||
    value === WK_STATUSES.guru ||
    value === WK_STATUSES.master ||
    value === WK_STATUSES.enlightened ||
    value === WK_STATUSES.burned
  );
}

export function isLearnedSrsGroup(value: string | null | undefined): value is LearnedSrsGroup {
  return (
    value === WK_STATUSES.apprentice ||
    value === WK_STATUSES.guru ||
    value === WK_STATUSES.master ||
    value === WK_STATUSES.enlightened ||
    value === WK_STATUSES.burned
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
