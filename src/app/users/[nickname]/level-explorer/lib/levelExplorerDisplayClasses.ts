import type { LevelItem } from "../../explorerTypes";
import { subjectTypeShortLabel } from "../../shared/subjectTypeLabels";
import type { SrsFilter } from "../../explorerTypes";
import {
  LEVEL_FILTER_ALL,
  LEVEL_STATUS_APPRENTICE,
  LEVEL_STATUS_BURNED,
  LEVEL_STATUS_ENLIGHTENED,
  LEVEL_STATUS_GURU,
  LEVEL_STATUS_LOCKED,
  LEVEL_STATUS_MASTER,
  LEVEL_TYPE_KANJI,
  LEVEL_TYPE_RADICAL,
  LEVEL_TYPE_VOCABULARY,
} from "./levelExplorerState";
import type { TypeFilter } from "./levelExplorerState";

export function statusClass(status: LevelItem["status"]): string {
  switch (status) {
    case LEVEL_STATUS_LOCKED:
      return "bg-surface-muted text-foreground/70";
    case LEVEL_STATUS_APPRENTICE:
      return "bg-pink-100 text-pink-700";
    case LEVEL_STATUS_GURU:
      return "bg-violet-100 text-violet-700";
    case LEVEL_STATUS_MASTER:
      return "bg-sky-100 text-sky-700";
    case LEVEL_STATUS_ENLIGHTENED:
      return "bg-amber-100 text-amber-700";
    case LEVEL_STATUS_BURNED:
      return "bg-surface-muted text-foreground/80";
  }
}

export function statusShortLabel(status: LevelItem["status"]): string {
  switch (status) {
    case LEVEL_STATUS_APPRENTICE:
      return "APPR";
    case LEVEL_STATUS_ENLIGHTENED:
      return "ENLIGHT";
    default:
      return status.toUpperCase();
  }
}

export function shortSubjectTypeLabel(type: LevelItem["subjectType"]): string {
  if (type === LEVEL_TYPE_RADICAL || type === LEVEL_TYPE_KANJI || type === LEVEL_TYPE_VOCABULARY) {
    return subjectTypeShortLabel(type);
  }

  return "ITEM";
}

export function srsFilterButtonLabel(
  status: SrsFilter,
): string {
  switch (status) {
    case LEVEL_FILTER_ALL:
      return "All";
    case LEVEL_STATUS_APPRENTICE:
      return "Appr";
    case LEVEL_STATUS_ENLIGHTENED:
      return "Enlight";
    default:
      return status;
  }
}

export function badgeClass(active: boolean): string {
  return active
    ? "border-accent bg-accent text-white"
    : "border-line bg-surface text-foreground hover:bg-surface-muted";
}

export function disabledBadgeClass(): string {
  return "cursor-not-allowed border-line bg-surface-muted text-foreground/45";
}

export function typeBadgeClass(type: TypeFilter, active: boolean, disabled: boolean): string {
  if (disabled) {
    return disabledBadgeClass();
  }
  if (type === LEVEL_TYPE_RADICAL) {
    return active
      ? "border-radical bg-radical text-white"
      : "border-radical/50 bg-radical/10 text-radical hover:bg-radical/20";
  }
  if (type === LEVEL_TYPE_KANJI) {
    return active
      ? "border-kanji bg-kanji text-white"
      : "border-kanji/50 bg-kanji/10 text-kanji hover:bg-kanji/20";
  }
  if (type === LEVEL_TYPE_VOCABULARY) {
    return active
      ? "border-vocabulary bg-vocabulary text-white"
      : "border-vocabulary/50 bg-vocabulary/10 text-vocabulary hover:bg-vocabulary/20";
  }
  return badgeClass(active);
}

export function subjectTypePillClass(type: LevelItem["subjectType"]): string {
  if (type === LEVEL_TYPE_RADICAL) {
    return "subject-pill subject-pill--radical";
  }
  if (type === LEVEL_TYPE_KANJI) {
    return "subject-pill subject-pill--kanji";
  }
  if (type === LEVEL_TYPE_VOCABULARY) {
    return "subject-pill subject-pill--vocabulary";
  }
  return "subject-pill";
}

export function jlptLevelPillClass(): string {
  return "subject-pill border-teal-300 bg-teal-100 text-teal-800";
}

export function typeCardClass(type: LevelItem["subjectType"], selected: boolean): string {
  const selectedRing = selected ? "ring-2 ring-accent" : "";
  if (type === LEVEL_TYPE_RADICAL) {
    return `border-radical/50 bg-surface text-foreground ${selectedRing}`;
  }
  if (type === LEVEL_TYPE_KANJI) {
    return `border-kanji/50 bg-surface text-foreground ${selectedRing}`;
  }
  if (type === LEVEL_TYPE_VOCABULARY) {
    return `border-vocabulary/50 bg-surface text-foreground ${selectedRing}`;
  }
  return `border-line bg-surface text-foreground ${selectedRing}`;
}

export function lockedCardStateClass(item: LevelItem): string {
  if (item.status !== LEVEL_STATUS_LOCKED && item.srsStage > 0) {
    return "";
  }
  return "bg-surface-muted/90 text-foreground/60";
}

export function typeGlyphBoxClass(type: LevelItem["subjectType"]): string {
  if (type === LEVEL_TYPE_RADICAL) {
    return "border-radical/50 bg-radical/15 text-radical";
  }
  if (type === LEVEL_TYPE_KANJI) {
    return "border-kanji/50 bg-kanji/15 text-kanji";
  }
  if (type === LEVEL_TYPE_VOCABULARY) {
    return "border-vocabulary/50 bg-vocabulary/15 text-vocabulary";
  }
  return "border-line bg-surface text-foreground";
}

export function glyphTextSizeClass(characters: string): string {
  const length = Array.from(characters).length;
  if (length >= 5) {
    return "text-4xl";
  }
  if (length >= 3) {
    return "text-5xl";
  }
  return "text-6xl";
}

export function relatedReferenceCardClass(
  type: LevelItem["subjectType"],
  isClickable: boolean,
  size: "normal" | "large",
): string {
  const base =
    "rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70";
  const sizeClass = size === "large" ? "px-4 py-3" : "px-3 py-2";
  if (type === LEVEL_TYPE_RADICAL) {
    return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-radical/50 bg-radical/10 text-radical hover:bg-radical/20" : "border-radical/30 bg-radical/5 text-radical/80"}`;
  }
  if (type === LEVEL_TYPE_KANJI) {
    return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-kanji/50 bg-kanji/10 text-kanji hover:bg-kanji/20" : "border-kanji/30 bg-kanji/5 text-kanji/80"}`;
  }
  if (type === LEVEL_TYPE_VOCABULARY) {
    return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-vocabulary/50 bg-vocabulary/10 text-vocabulary hover:bg-vocabulary/20" : "border-vocabulary/30 bg-vocabulary/5 text-vocabulary/80"}`;
  }
  return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-line bg-surface text-foreground hover:bg-surface-muted" : "border-line bg-surface-muted text-foreground/60"}`;
}
