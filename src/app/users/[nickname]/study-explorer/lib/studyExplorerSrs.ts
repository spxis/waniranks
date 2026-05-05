import type { StudySrsFilter, StudySrsStageFilter } from "./studyExplorerTypes";

export function normalizeSrsStageFilter(
  nextFilter: StudySrsFilter,
  currentStage: StudySrsStageFilter | null,
): StudySrsStageFilter | null {
  if (currentStage === null) {
    return null;
  }

  if (nextFilter === "all") {
    return currentStage;
  }

  if (nextFilter === "apprentice" && currentStage >= 1 && currentStage <= 4) return currentStage;
  if (nextFilter === "guru" && currentStage >= 5 && currentStage <= 6) return currentStage;
  if (nextFilter === "master" && currentStage === 7) return currentStage;
  if (nextFilter === "enlightened" && currentStage === 8) return currentStage;
  if (nextFilter === "burned" && currentStage === 9) return currentStage;

  return null;
}
