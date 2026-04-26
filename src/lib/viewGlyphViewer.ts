"use client";

import type { StudyQueueItem } from "@/app/users/[nickname]/study-explorer/lib/studyExplorerTypes";

export type ViewGlyphSelectorEntry = {
  label: string;
  itemIndex: number | null;
  kind: "vocabulary" | "kanji";
  exists: boolean;
};

export type ViewGlyphViewerPayload = {
  items: StudyQueueItem[];
  startIndex?: number;
  title?: string;
  accountId?: string;
  selector?: ViewGlyphSelectorEntry[];
};

export const VIEW_GLYPH_EVENT = "wr:view-glyph-open";

const DUPLICATE_DISPATCH_WINDOW_MS = 500;
let lastDispatchAtMs = 0;
let lastDispatchKey = "";

export function openViewGlyphViewer(payload: ViewGlyphViewerPayload): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!payload.items || payload.items.length === 0) {
    return;
  }

  const first = payload.items[0];
  const dispatchKey = `${first?.subjectId ?? "none"}:${payload.items.length}:${payload.startIndex ?? 0}:${payload.title ?? ""}`;
  const now = Date.now();
  if (dispatchKey === lastDispatchKey && now - lastDispatchAtMs < DUPLICATE_DISPATCH_WINDOW_MS) {
    return;
  }

  lastDispatchAtMs = now;
  lastDispatchKey = dispatchKey;

  window.dispatchEvent(new CustomEvent<ViewGlyphViewerPayload>(VIEW_GLYPH_EVENT, { detail: payload }));
}
