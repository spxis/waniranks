"use client";

import type { StudyQueueItem } from "@/app/users/[nickname]/study-explorer/lib/studyExplorerTypes";

export type ViewGlyphViewerPayload = {
  items: StudyQueueItem[];
  startIndex?: number;
  title?: string;
  accountId?: string;
};

export const VIEW_GLYPH_EVENT = "wr:view-glyph-open";

export function openViewGlyphViewer(payload: ViewGlyphViewerPayload): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!payload.items || payload.items.length === 0) {
    return;
  }

  window.dispatchEvent(new CustomEvent<ViewGlyphViewerPayload>(VIEW_GLYPH_EVENT, { detail: payload }));
}
