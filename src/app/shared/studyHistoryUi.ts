import type { HistorySrsBucket } from "@/app/shared/studyHistoryTypes";
import { WK_STATUSES } from "@/lib/domainConstants";

export function srsBucketLabel(value: HistorySrsBucket): string {
  if (value === WK_STATUSES.apprentice) return "APPR";
  if (value === WK_STATUSES.guru) return "GURU";
  if (value === WK_STATUSES.master) return "MASTER";
  if (value === WK_STATUSES.enlightened) return "ENL";
  if (value === WK_STATUSES.burned) return "BURN";
  if (value === WK_STATUSES.locked) return "LOCK";
  return "UNK";
}

export function srsBucketBadgeClass(value: HistorySrsBucket): string {
  if (value === WK_STATUSES.apprentice) return "border-amber-300 text-amber-700 bg-amber-50";
  if (value === WK_STATUSES.guru) return "border-violet-300 text-violet-700 bg-violet-50";
  if (value === WK_STATUSES.master) return "border-sky-300 text-sky-700 bg-sky-50";
  if (value === WK_STATUSES.enlightened) return "border-emerald-300 text-emerald-700 bg-emerald-50";
  if (value === WK_STATUSES.burned) return "border-slate-300 text-slate-700 bg-slate-100";
  if (value === WK_STATUSES.locked) return "border-gray-300 text-gray-600 bg-gray-100";
  return "border-gray-300 text-gray-500 bg-white";
}

export function titleCaseSrsBucket(value: HistorySrsBucket): string {
  if (value === WK_STATUSES.apprentice) return "Apprentice";
  if (value === WK_STATUSES.guru) return "Guru";
  if (value === WK_STATUSES.master) return "Master";
  if (value === WK_STATUSES.enlightened) return "Enlightened";
  if (value === WK_STATUSES.burned) return "Burned";
  if (value === WK_STATUSES.locked) return "Locked";
  return "Unknown";
}
