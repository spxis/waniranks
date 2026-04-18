import { useCallback, useEffect, useState } from "react";

import type { LevelItem } from "../../explorerTypes";
import { formatNumber } from "./levelExplorerDisplay";

type ResetFeedback = { kind: "success" | "error"; message: string } | null;

type Args = {
  accountId: string;
  filteredItems: LevelItem[];
  visibleItems: LevelItem[];
};

export function useLevelExplorerResetSelection({
  accountId,
  filteredItems,
  visibleItems,
}: Args) {
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(new Set());
  const [isResetting, setIsResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<ResetFeedback>(null);

  useEffect(() => {
    setSelectedSubjectIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const visibleInFilters = new Set(filteredItems.map((item) => item.subjectId));
      const next = new Set<number>();
      for (const subjectId of prev.values()) {
        if (visibleInFilters.has(subjectId)) {
          next.add(subjectId);
        }
      }

      return next.size === prev.size ? prev : next;
    });
  }, [filteredItems]);

  const runReset = useCallback(
    async (subjectIds: number[]) => {
      if (subjectIds.length === 0) {
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
        const kind = failed > 0 ? "error" : "success";
        const message = `Reset ${formatNumber(reset)} • Skipped ${formatNumber(skipped)} • Failed ${formatNumber(failed)}`;

        setResetFeedback({ kind, message });
        setSelectedSubjectIds((prev) => {
          const next = new Set(prev);
          for (const subjectId of subjectIds) {
            next.delete(subjectId);
          }
          return next;
        });

        void fetch(`/api/accounts/${accountId}/refresh`, { method: "POST" }).catch(() => {
          // Non-blocking refresh to keep explorer aggregates aligned.
        });
      } catch (resetError) {
        setResetFeedback({
          kind: "error",
          message: resetError instanceof Error ? resetError.message : "Could not reset selected items.",
        });
      } finally {
        setIsResetting(false);
      }
    },
    [accountId],
  );

  const toggleSubjectSelection = useCallback((subjectId: number) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  }, []);

  const selectSubjectIds = useCallback((subjectIds: number[]) => {
    if (subjectIds.length === 0) {
      return;
    }

    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      for (const subjectId of subjectIds) {
        next.add(subjectId);
      }
      return next;
    });
  }, []);

  const selectVisibleSubjects = useCallback(() => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      for (const item of visibleItems) {
        next.add(item.subjectId);
      }
      return next;
    });
  }, [visibleItems]);

  const clearSelection = useCallback(() => {
    setSelectedSubjectIds(new Set());
    setResetFeedback(null);
  }, []);

  const resetSelected = useCallback(() => {
    const selected = Array.from(selectedSubjectIds.values());
    if (selected.length === 0) {
      return;
    }

    void runReset(selected);
  }, [runReset, selectedSubjectIds]);

  const resetSingle = useCallback(
    (subjectId: number) => {
      void runReset([subjectId]);
    },
    [runReset],
  );

  return {
    selectedSubjectIds,
    isResetting,
    resetFeedback,
    toggleSubjectSelection,
    selectSubjectIds,
    selectVisibleSubjects,
    clearSelection,
    resetSelected,
    resetSingle,
  };
}