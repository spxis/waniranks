import { typeGlyphBoxClass } from "@/app/users/[nickname]/level-explorer/lib/levelExplorerDisplay";

export type NewsGlyphBoxType = "kanji" | "vocabulary";

export function newsGlyphBoxClass(type: NewsGlyphBoxType): string {
  return typeGlyphBoxClass(type);
}

export function newsGlyphButtonClass(options: {
  type: NewsGlyphBoxType;
  size?: "compact" | "normal";
  selected?: boolean;
  clickable?: boolean;
}): string {
  const { type, size = "normal", selected = false, clickable = true } = options;
  const sizeClass =
    size === "compact"
      ? "h-10 min-w-10 px-2 text-2xl"
      : "min-h-10 min-w-10 px-3 text-2xl";
  const interactive = clickable
    ? "cursor-pointer transition hover:brightness-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
    : "cursor-default";
  const selectedClass = selected ? "ring-2 ring-accent/65" : "";

  return [
    "inline-flex items-center justify-center rounded-xl border font-black leading-none",
    sizeClass,
    newsGlyphBoxClass(type),
    interactive,
    selectedClass,
  ]
    .filter(Boolean)
    .join(" ");
}
