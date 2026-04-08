"use client";

import type { Snapshot, SrsFilter } from "./explorerTypes";
import LevelExplorerController from "./LevelExplorerController";

type Props = {
  accountId: string;
  maxLevel: number;
  initialSnapshot: Snapshot;
  initialSrsFilter?: SrsFilter;
  showEnglish?: boolean;
};

export default function LevelExplorerScreen(props: Props) {
  return <LevelExplorerController {...props} />;
}
