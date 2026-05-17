import type { HistorySrsBucket } from "@/app/shared/studyHistoryTypes";
import {
  SRS_BUCKETS,
  SRS_BUCKET_SHORT_LABELS,
  SRS_BUCKET_TITLE_LABELS,
} from "@/lib/domainConstants";

type SrsBucketUiMeta = {
  shortLabel: string;
  badgeClass: string;
};

const SRS_BUCKET_UI_META: Record<HistorySrsBucket, SrsBucketUiMeta> = {
  [SRS_BUCKETS.apprentice]: {
    shortLabel: SRS_BUCKET_SHORT_LABELS[SRS_BUCKETS.apprentice],
    badgeClass: "border-amber-300 text-amber-700 bg-amber-50",
  },
  [SRS_BUCKETS.guru]: {
    shortLabel: SRS_BUCKET_SHORT_LABELS[SRS_BUCKETS.guru],
    badgeClass: "border-violet-300 text-violet-700 bg-violet-50",
  },
  [SRS_BUCKETS.master]: {
    shortLabel: SRS_BUCKET_SHORT_LABELS[SRS_BUCKETS.master],
    badgeClass: "border-sky-300 text-sky-700 bg-sky-50",
  },
  [SRS_BUCKETS.enlightened]: {
    shortLabel: SRS_BUCKET_SHORT_LABELS[SRS_BUCKETS.enlightened],
    badgeClass: "border-emerald-300 text-emerald-700 bg-emerald-50",
  },
  [SRS_BUCKETS.burned]: {
    shortLabel: SRS_BUCKET_SHORT_LABELS[SRS_BUCKETS.burned],
    badgeClass: "border-slate-300 text-slate-700 bg-slate-100",
  },
  [SRS_BUCKETS.locked]: {
    shortLabel: SRS_BUCKET_SHORT_LABELS[SRS_BUCKETS.locked],
    badgeClass: "border-gray-300 text-gray-600 bg-gray-100",
  },
  [SRS_BUCKETS.unknown]: {
    shortLabel: SRS_BUCKET_SHORT_LABELS[SRS_BUCKETS.unknown],
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
  return SRS_BUCKET_TITLE_LABELS[value];
}
