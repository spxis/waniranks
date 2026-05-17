import type { HistorySrsBucket } from "@/app/shared/studyHistoryTypes";
import { SUBJECT_STATUSES } from "@/lib/domainConstants";

export function srsBucketLabel(value: HistorySrsBucket): string {
  if (value === SUBJECT_STATUSES.apprentice) return "APPR";
  if (value === SUBJECT_STATUSES.guru) return "GURU";
  if (value === SUBJECT_STATUSES.master) return "MASTER";
  if (value === SUBJECT_STATUSES.enlightened) return "ENL";
  if (value === SUBJECT_STATUSES.burned) return "BURN";
  if (value === SUBJECT_STATUSES.locked) return "LOCK";
  return "UNK";
}

export function srsBucketBadgeClass(value: HistorySrsBucket): string {
  if (value === SUBJECT_STATUSES.apprentice) return "border-amber-300 text-amber-700 bg-amber-50";
  if (value === SUBJECT_STATUSES.guru) return "border-violet-300 text-violet-700 bg-violet-50";
  if (value === SUBJECT_STATUSES.master) return "border-sky-300 text-sky-700 bg-sky-50";
  if (value === SUBJECT_STATUSES.enlightened) return "border-emerald-300 text-emerald-700 bg-emerald-50";
  if (value === SUBJECT_STATUSES.burned) return "border-slate-300 text-slate-700 bg-slate-100";
  if (value === SUBJECT_STATUSES.locked) return "border-gray-300 text-gray-600 bg-gray-100";
  return "border-gray-300 text-gray-500 bg-white";
}

export function titleCaseSrsBucket(value: HistorySrsBucket): string {
  if (value === SUBJECT_STATUSES.apprentice) return "Apprentice";
  if (value === SUBJECT_STATUSES.guru) return "Guru";
  if (value === SUBJECT_STATUSES.master) return "Master";
  if (value === SUBJECT_STATUSES.enlightened) return "Enlightened";
  if (value === SUBJECT_STATUSES.burned) return "Burned";
  if (value === SUBJECT_STATUSES.locked) return "Locked";
  return "Unknown";
}
