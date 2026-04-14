"use client";

import type { Snapshot, SrsFilter } from "../../explorerTypes";
import LevelExplorerScreen from "./LevelExplorerScreen";

type Props = {
  accountId: string;
  maxLevel: number;
  accountPendingReviews: number;
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
