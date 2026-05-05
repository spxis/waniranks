import { badgeClass, formatNumber } from "../level-explorer/lib/levelExplorerDisplay";

import SubjectTypeFilterButton from "./SubjectTypeFilterButton";

type SubjectType = "radical" | "kanji" | "vocabulary";

type Props = {
  counts: {
    all: number;
    radical: number;
    kanji: number;
    vocabulary: number;
  };
  allLabel: string;
  allCount?: number;
  allActive: boolean;
  activeTypes: Record<SubjectType, boolean>;
  onClickAll: () => void;
  onClickType: (type: SubjectType) => void;
  className?: string;
  showPlaceholderCounts?: boolean;
  disabled?: boolean;
  disableInactiveOnly?: boolean;
};

export default function SubjectTypeFilterGroup({
  counts,
  allLabel,
  allCount,
  allActive,
  activeTypes,
  onClickAll,
  onClickType,
  className,
  showPlaceholderCounts = false,
  disabled = false,
  disableInactiveOnly = false,
}: Props) {
  const formatCount = (value: number): string => (showPlaceholderCounts ? "..." : formatNumber(value));
  const allDisabled = disabled && (!disableInactiveOnly || !allActive);

  return (
    <div className={className ?? "flex flex-wrap gap-2"}>
      <button
        type="button"
        disabled={allDisabled}
        onClick={onClickAll}
        className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${allDisabled ? "opacity-45" : badgeClass(allActive)}`}
      >
        {allLabel} ({formatCount(allCount ?? counts.all)})
      </button>
      {(["radical", "kanji", "vocabulary"] as const).map((type) => (
        <SubjectTypeFilterButton
          key={type}
          type={type}
          countLabel={formatCount(counts[type])}
          active={activeTypes[type]}
          disabled={disabled && (!disableInactiveOnly || !activeTypes[type])}
          onClick={() => onClickType(type)}
        />
      ))}
    </div>
  );
}
