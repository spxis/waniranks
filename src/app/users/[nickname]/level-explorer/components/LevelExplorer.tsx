"use client";

import type { Snapshot, SrsFilter } from "../../explorerTypes";
import LevelExplorerScreen from "./LevelExplorerScreen";

type Props = {
  accountId: string;
  isActive?: boolean;
  maxLevel: number;
  accountPendingReviews: number;
  levelItemCountsByLevel: Record<number, number>;
  initialSnapshot: Snapshot;
  initialSrsFilter?: SrsFilter;
  showEnglish?: boolean;
  canToggleEnglish?: boolean;
  onToggleShowEnglish?: () => void;
  studyMode?: boolean;
};

export default function LevelExplorer(props: Props) {
  return <LevelExplorerScreen {...props} />;
}
