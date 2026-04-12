"use client";

import {
  badgeClass,
  formatNumber,
  typeBadgeClass,
} from "../level-explorer/lib/levelExplorerDisplay";

type SubjectType = "radical" | "kanji" | "vocabulary";

type Counts = {
  all: number;
  radical: number;
  kanji: number;
  vocabulary: number;
};

type Props = {
  counts: Counts;
  allLabel: string;
  allActive: boolean;
  activeTypes: Record<SubjectType, boolean>;
  onClickAll: () => void;
  onClickType: (type: SubjectType) => void;
};

export default function SubjectTypeFilterGroup({
  counts,
  allLabel,
  allActive,
  activeTypes,
  onClickAll,
  onClickType,
}: Props) {
  const typeButtons: Array<{ type: SubjectType; label: string }> = [
    { type: "radical", label: "Radicals" },
    { type: "kanji", label: "Kanji" },
    { type: "vocabulary", label: "Vocabulary" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onClickAll}
        className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(allActive)}`}
      >
        {allLabel} ({formatNumber(counts.all)})
      </button>

      {typeButtons.map(({ type, label }) => (
        <button
          key={type}
          type="button"
          onClick={() => onClickType(type)}
          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${typeBadgeClass(type, activeTypes[type], false)}`}
        >
          {label} ({formatNumber(counts[type])})
        </button>
      ))}
    </div>
  );
}
