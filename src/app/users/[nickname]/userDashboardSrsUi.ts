import { WK_STATUSES, type SrsProgressStatus, type WkStatus } from "@/lib/domainConstants";

export function srsSegmentClass(stage: WkStatus): string {
  if (stage === WK_STATUSES.locked) return "bg-foreground/15";
  if (stage === WK_STATUSES.apprentice) return "bg-hot";
  if (stage === WK_STATUSES.guru) return "bg-accent";
  if (stage === WK_STATUSES.master) return "bg-sky-500";
  if (stage === WK_STATUSES.enlightened) return "bg-amber-500";
  return "bg-emerald-500";
}

export function srsSegmentTextClass(stage: WkStatus): string {
  if (stage === WK_STATUSES.enlightened) return "text-slate-900";
  if (stage === WK_STATUSES.locked) return "text-slate-900";
  return "text-white";
}

export function srsBadgeClass(stage: WkStatus): string {
  if (stage === WK_STATUSES.apprentice) return "border-hot/40 bg-hot/10 text-hot";
  if (stage === WK_STATUSES.guru) return "border-accent/40 bg-accent/10 text-accent";
  if (stage === WK_STATUSES.master) return "border-sky-500/40 bg-sky-500/10 text-sky-700";
  if (stage === WK_STATUSES.enlightened) return "border-amber-500/40 bg-amber-500/10 text-amber-800";
  if (stage === WK_STATUSES.burned) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800";
  return "border-foreground/30 bg-foreground/10 text-foreground";
}

export function stageLabel(stage: SrsProgressStatus): string {
  if (stage === WK_STATUSES.locked) return "Lock";
  if (stage === WK_STATUSES.apprentice) return "Appr";
  if (stage === WK_STATUSES.guru) return "Guru";
  if (stage === WK_STATUSES.master) return "Mast";
  if (stage === WK_STATUSES.enlightened) return "Enli";
  return "Burn";
}

export function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}
