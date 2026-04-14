import type { LevelItem } from "../../explorerTypes";

export function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

export function formatDate(input: string | null | undefined): string {
  if (!input) {
    return "-";
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

type NextReviewBadge = {
  label: string;
  className: string;
};

export function formatNextReviewBadge(input: string | null | undefined): NextReviewBadge | null {
  if (!input) {
    return null;
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const deltaMs = parsed.getTime() - Date.now();
  const absMs = Math.abs(deltaMs);
  if (deltaMs <= 0) {
    if (absMs < 15 * 60 * 1000) {
      return { label: "LATE now", className: "border-orange-300 bg-orange-50 text-orange-700" };
    }
    if (absMs < 60 * 60 * 1000) {
      const minutes = Math.max(1, Math.round(absMs / (60 * 1000)));
      return { label: `LATE ${minutes}M`, className: "border-orange-300 bg-orange-50 text-orange-700" };
    }
    if (absMs < 24 * 60 * 60 * 1000) {
      const hours = Math.max(1, Math.round(absMs / (60 * 60 * 1000)));
      return { label: `LATE ${hours}H`, className: "border-orange-300 bg-orange-50 text-orange-700" };
    }
    const days = Math.max(1, Math.round(absMs / (24 * 60 * 60 * 1000)));
    return { label: `LATE ${days}D`, className: "border-red-300 bg-red-50 text-red-700" };
  }
  if (absMs < 15 * 60 * 1000) {
    return { label: "Due soon", className: "border-emerald-300 bg-emerald-50 text-emerald-700" };
  }
  if (absMs < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(absMs / (60 * 1000)));
    return { label: `In ${minutes}M`, className: "border-emerald-300 bg-emerald-50 text-emerald-700" };
  }
  if (absMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(absMs / (60 * 60 * 1000)));
    return { label: `In ${hours}H`, className: "border-emerald-300 bg-emerald-50 text-emerald-700" };
  }
  const days = Math.max(1, Math.round(absMs / (24 * 60 * 60 * 1000)));
  return { label: `In ${days}D`, className: "border-emerald-300 bg-emerald-50 text-emerald-700" };
}

export function formatRelativeFromNow(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const deltaMs = parsed.getTime() - Date.now();
  const absMs = Math.abs(deltaMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;
  let value = 0;
  let unit = "minute";
  if (absMs >= yearMs) {
    value = Math.max(1, Math.round(absMs / yearMs));
    unit = "year";
  } else if (absMs >= monthMs) {
    value = Math.max(1, Math.round(absMs / monthMs));
    unit = "month";
  } else if (absMs >= weekMs) {
    value = Math.max(1, Math.round(absMs / weekMs));
    unit = "week";
  } else if (absMs >= dayMs) {
    value = Math.max(1, Math.round(absMs / dayMs));
    unit = "day";
  } else if (absMs >= hourMs) {
    value = Math.max(1, Math.round(absMs / hourMs));
    unit = "hour";
  } else {
    value = Math.max(1, Math.round(absMs / minuteMs));
    unit = "minute";
  }
  const plural = value === 1 ? unit : `${unit}s`;
  return deltaMs < 0 ? `${value} ${plural} ago` : `in ${value} ${plural}`;
}

export function isNewGlyphWithinHours(
  item: LevelItem,
  hours: number = 72,
  nowMs: number = Date.now(),
): boolean {
  const anchor = item.startedAt ?? item.availableAt;
  if (!anchor) {
    return false;
  }

  const anchorMs = Date.parse(anchor);
  if (Number.isNaN(anchorMs) || anchorMs > nowMs) {
    return false;
  }

  return nowMs - anchorMs <= hours * 60 * 60 * 1000;
}
