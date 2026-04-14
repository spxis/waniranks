"use client";

import type { Snapshot, SrsFilter } from "../../explorerTypes";
import LevelExplorerController from "./LevelExplorerController";

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

export default function LevelExplorerScreen(props: Props) {
  return <LevelExplorerController {...props} />;
}
