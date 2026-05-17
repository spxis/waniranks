import type { HistorySrsBucket } from "@/app/shared/studyHistoryTypes";
import { SRS_BUCKETS } from "@/lib/domainConstants";

type SrsBucketUiMeta = {
  shortLabel: string;
  titleLabel: string;
  badgeClass: string;
};

const SRS_BUCKET_UI_META: Record<HistorySrsBucket, SrsBucketUiMeta> = {
  [SRS_BUCKETS.apprentice]: {
    shortLabel: "APPR",
    titleLabel: "Apprentice",
    badgeClass: "border-amber-300 text-amber-700 bg-amber-50",
  },
  [SRS_BUCKETS.guru]: {
    shortLabel: "GURU",
    titleLabel: "Guru",
    badgeClass: "border-violet-300 text-violet-700 bg-violet-50",
  },
  [SRS_BUCKETS.master]: {
    shortLabel: "MASTER",
    titleLabel: "Master",
    badgeClass: "border-sky-300 text-sky-700 bg-sky-50",
  },
  [SRS_BUCKETS.enlightened]: {
    shortLabel: "ENL",
    titleLabel: "Enlightened",
    badgeClass: "border-emerald-300 text-emerald-700 bg-emerald-50",
  },
  [SRS_BUCKETS.burned]: {
    shortLabel: "BURN",
    titleLabel: "Burned",
    badgeClass: "border-slate-300 text-slate-700 bg-slate-100",
  },
  [SRS_BUCKETS.locked]: {
    shortLabel: "LOCK",
    titleLabel: "Locked",
    badgeClass: "border-gray-300 text-gray-600 bg-gray-100",
  },
  [SRS_BUCKETS.unknown]: {
    shortLabel: "UNK",
    titleLabel: "Unknown",
    badgeClass: "border-gray-300 text-gray-500 bg-white",
  },
};

export function srsBucketLabel(value: HistorySrsBucket): string {
  return SRS_BUCKET_UI_META[value].shortLabel;
}

export function srsBucketBadgeClass(value: HistorySrsBucket): string {
  return SRS_BUCKET_UI_META[value].badgeClass;
}

export function titleCaseSrsBucket(value: HistorySrsBucket): string {
  return SRS_BUCKET_UI_META[value].titleLabel;
}
