import type { LevelItem } from "../../explorerTypes";
import { subjectTypeShortLabel } from "../../shared/subjectTypeLabels";
import type { TypeFilter } from "./levelExplorerState";

export function statusClass(status: LevelItem["status"]): string {
  switch (status) {
    case "locked":
      return "bg-surface-muted text-foreground/70";
    case "apprentice":
      return "bg-pink-100 text-pink-700";
    case "guru":
      return "bg-violet-100 text-violet-700";
    case "master":
      return "bg-sky-100 text-sky-700";
    case "enlightened":
      return "bg-amber-100 text-amber-700";
    case "burned":
      return "bg-surface-muted text-foreground/80";
  }
}

export function statusShortLabel(status: LevelItem["status"]): string {
  switch (status) {
    case "apprentice":
      return "APPR";
    case "enlightened":
      return "ENLIGHT";
    default:
      return status.toUpperCase();
  }
}

export function shortSubjectTypeLabel(type: LevelItem["subjectType"]): string {
  if (type === "radical" || type === "kanji" || type === "vocabulary") {
    return subjectTypeShortLabel(type);
  }

  return "ITEM";
}

export function srsFilterButtonLabel(
  status: "all" | "apprentice" | "guru" | "master" | "enlightened" | "burned" | "locked",
): string {
  switch (status) {
    case "all":
      return "All";
    case "apprentice":
      return "Appr";
    case "enlightened":
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
  if (type === "radical") {
    return active
      ? "border-radical bg-radical text-white"
      : "border-radical/50 bg-radical/10 text-radical hover:bg-radical/20";
  }
  if (type === "kanji") {
    return active
      ? "border-kanji bg-kanji text-white"
      : "border-kanji/50 bg-kanji/10 text-kanji hover:bg-kanji/20";
  }
  if (type === "vocabulary") {
    return active
      ? "border-vocabulary bg-vocabulary text-white"
      : "border-vocabulary/50 bg-vocabulary/10 text-vocabulary hover:bg-vocabulary/20";
  }
  return badgeClass(active);
}

export function subjectTypePillClass(type: LevelItem["subjectType"]): string {
  if (type === "radical") {
    return "subject-pill subject-pill--radical";
  }
  if (type === "kanji") {
    return "subject-pill subject-pill--kanji";
  }
  if (type === "vocabulary") {
    return "subject-pill subject-pill--vocabulary";
  }
  return "subject-pill";
}

export function typeCardClass(type: LevelItem["subjectType"], selected: boolean): string {
  const selectedRing = selected ? "ring-2 ring-accent" : "";
  if (type === "radical") {
    return `border-radical/50 bg-surface text-foreground ${selectedRing}`;
  }
  if (type === "kanji") {
    return `border-kanji/50 bg-surface text-foreground ${selectedRing}`;
  }
  if (type === "vocabulary") {
    return `border-vocabulary/50 bg-surface text-foreground ${selectedRing}`;
  }
  return `border-line bg-surface text-foreground ${selectedRing}`;
}

export function lockedCardStateClass(item: LevelItem): string {
  if (item.status !== "locked" && item.srsStage > 0) {
    return "";
  }
  return "bg-surface-muted/90 text-foreground/60";
}

export function typeGlyphBoxClass(type: LevelItem["subjectType"]): string {
  if (type === "radical") {
    return "border-radical/50 bg-radical/15 text-radical";
  }
  if (type === "kanji") {
    return "border-kanji/50 bg-kanji/15 text-kanji";
  }
  if (type === "vocabulary") {
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
  if (type === "radical") {
    return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-radical/50 bg-radical/10 text-radical hover:bg-radical/20" : "border-radical/30 bg-radical/5 text-radical/80"}`;
  }
  if (type === "kanji") {
    return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-kanji/50 bg-kanji/10 text-kanji hover:bg-kanji/20" : "border-kanji/30 bg-kanji/5 text-kanji/80"}`;
  }
  if (type === "vocabulary") {
    return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-vocabulary/50 bg-vocabulary/10 text-vocabulary hover:bg-vocabulary/20" : "border-vocabulary/30 bg-vocabulary/5 text-vocabulary/80"}`;
  }
  return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-line bg-surface text-foreground hover:bg-surface-muted" : "border-line bg-surface-muted text-foreground/60"}`;
}
