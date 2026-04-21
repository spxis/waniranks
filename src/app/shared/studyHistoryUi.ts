import type { HistorySrsBucket } from "@/app/shared/studyHistoryTypes";

export function srsBucketLabel(value: HistorySrsBucket): string {
  if (value === "apprentice") return "APPR";
  if (value === "guru") return "GURU";
  if (value === "master") return "MASTER";
  if (value === "enlightened") return "ENL";
  if (value === "burned") return "BURN";
  if (value === "locked") return "LOCK";
  return "UNK";
}

export function srsBucketBadgeClass(value: HistorySrsBucket): string {
  if (value === "apprentice") return "border-amber-300 text-amber-700 bg-amber-50";
  if (value === "guru") return "border-violet-300 text-violet-700 bg-violet-50";
  if (value === "master") return "border-sky-300 text-sky-700 bg-sky-50";
  if (value === "enlightened") return "border-emerald-300 text-emerald-700 bg-emerald-50";
  if (value === "burned") return "border-slate-300 text-slate-700 bg-slate-100";
  if (value === "locked") return "border-gray-300 text-gray-600 bg-gray-100";
  return "border-gray-300 text-gray-500 bg-white";
}

export function titleCaseSrsBucket(value: HistorySrsBucket): string {
  if (value === "apprentice") return "Apprentice";
  if (value === "guru") return "Guru";
  if (value === "master") return "Master";
  if (value === "enlightened") return "Enlightened";
  if (value === "burned") return "Burned";
  if (value === "locked") return "Locked";
  return "Unknown";
}
