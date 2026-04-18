import { useEffect, useMemo, useState } from "react";

import {
  shortSubjectTypeLabel,
} from "../../level-explorer/lib/levelExplorerDisplay";
import type { StudyQueueItem } from "./studyExplorerTypes";

type Args = {
  filteredItems: StudyQueueItem[];
};

export function useStudyBulkReset({ filteredItems }: Args) {
  const [bulkModeEnabled, setBulkModeEnabled] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(new Set());
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
    return selectedItems.slice(0, 6).map((item) => item.characters);
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
        setBulkAnchorIndex(null);
      }
      return next;
    });
  };

  return {
    bulkModeEnabled,
    selectedSubjectIds,
    selectedItems,
    selectedDetails,
    selectedPreview,
    toggleBulkSelection,
    applyBulkSelection,
    toggleBulkMode,
    setBulkModeEnabled,
    setSelectedSubjectIds,
  };
}
