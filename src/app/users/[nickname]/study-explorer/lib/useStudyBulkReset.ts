import { useEffect, useMemo, useState } from "react";

import {
  formatNumber,
  shortSubjectTypeLabel,
} from "../../level-explorer/lib/levelExplorerDisplay";
import type { StudyQueueItem } from "./studyExplorerTypes";

type ResetFeedback = { kind: "success" | "error"; message: string } | null;

type Args = {
  accountId: string;
  filteredItems: StudyQueueItem[];
};

export function useStudyBulkReset({ accountId, filteredItems }: Args) {
  const [bulkModeEnabled, setBulkModeEnabled] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(new Set());
  const [pendingBulkReset, setPendingBulkReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<ResetFeedback>(null);
  const [bulkAnchorIndex, setBulkAnchorIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedSubjectIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const available = new Set(filteredItems.map((item) => item.subjectId));
      const next = new Set<number>();
      for (const subjectId of prev.values()) {
        if (available.has(subjectId)) {
          next.add(subjectId);
        }
      }

      return next.size === prev.size ? prev : next;
    });
  }, [filteredItems]);

  const selectedItems = useMemo(
    () => filteredItems.filter((item) => selectedSubjectIds.has(item.subjectId)),
    [filteredItems, selectedSubjectIds],
  );

  const selectedDetails = useMemo(
    () =>
      selectedItems.map(
        (item) =>
          `${item.characters} • ${shortSubjectTypeLabel(item.subjectType)} • ${typeof item.wkLevel === "number" ? `L${item.wkLevel}` : "L?"} • SRS ${item.srsStage}`,
      ),
    [selectedItems],
  );

  const selectedPreview = useMemo(() => {
    const labels = selectedItems.slice(0, 6).map((item) => item.characters);
    if (selectedItems.length > 6) {
      labels.push(`+${formatNumber(selectedItems.length - 6)} more`);
    }
    return labels;
  }, [selectedItems]);

  const toggleBulkSelection = (subjectId: number) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  };

  const applyBulkSelection = ({
    subjectId,
    sourceIndex,
    shiftKey,
  }: {
    subjectId: number;
    sourceIndex: number;
    shiftKey: boolean;
  }) => {
    if (!bulkModeEnabled) {
      return false;
    }

    if (shiftKey && bulkAnchorIndex !== null) {
      const start = Math.min(bulkAnchorIndex, sourceIndex);
      const end = Math.max(bulkAnchorIndex, sourceIndex);
      const rangeSubjectIds = filteredItems.slice(start, end + 1).map((item) => item.subjectId);
      if (rangeSubjectIds.length > 0) {
        setSelectedSubjectIds((prev) => {
          const next = new Set(prev);
          for (const selectedSubjectId of rangeSubjectIds) {
            next.add(selectedSubjectId);
          }
          return next;
        });
      }
      return true;
    }

    toggleBulkSelection(subjectId);
    setBulkAnchorIndex(sourceIndex);
    return true;
  };

  const toggleBulkMode = () => {
    setBulkModeEnabled((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedSubjectIds(new Set());
        setPendingBulkReset(false);
        setBulkAnchorIndex(null);
      }
      return next;
    });
  };

  const resetSelectedItems = async () => {
    const subjectIds = Array.from(selectedSubjectIds.values());
    if (subjectIds.length === 0 || isResetting) {
      return;
    }

    setIsResetting(true);
    setResetFeedback(null);

    try {
      const response = await fetch(`/api/study/${accountId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds }),
      });
      const payload = (await response.json()) as {
        error?: string;
        reset?: number;
        skipped?: number;
        failed?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not reset selected items.");
      }

      const reset = payload.reset ?? 0;
      const skipped = payload.skipped ?? 0;
      const failed = payload.failed ?? 0;

      setResetFeedback({
        kind: failed > 0 ? "error" : "success",
        message: `Reset ${formatNumber(reset)} • Skipped ${formatNumber(skipped)} • Failed ${formatNumber(failed)}`,
      });

      setSelectedSubjectIds(new Set());
      setPendingBulkReset(false);
      setBulkModeEnabled(false);
      setBulkAnchorIndex(null);

      window.dispatchEvent(new Event("focus"));
      void fetch(`/api/accounts/${accountId}/refresh`, { method: "POST" }).catch(() => {
        // Non-blocking refresh keeps study caches and aggregates aligned.
      });
    } catch (error) {
      setResetFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not reset selected items.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return {
    bulkModeEnabled,
    selectedSubjectIds,
    pendingBulkReset,
    isResetting,
    resetFeedback,
    selectedItems,
    selectedDetails,
    selectedPreview,
    toggleBulkSelection,
    applyBulkSelection,
    toggleBulkMode,
    setBulkModeEnabled,
    setSelectedSubjectIds,
    setPendingBulkReset,
    resetSelectedItems,
  };
}
