import { badgeClass, disabledBadgeClass, formatNumber } from "../level-explorer/lib/levelExplorerDisplay";
import { SUBJECT_TYPE_VALUES, type SubjectType } from "@/lib/domainConstants";

import SubjectTypeFilterButton from "./SubjectTypeFilterButton";

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
  allButtonClassName?: string;
  showPlaceholderCounts?: boolean;
  disabled?: boolean;
  hideZeroInactive?: boolean;
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
  allButtonClassName,
  showPlaceholderCounts = false,
  disabled = false,
  hideZeroInactive = false,
}: Props) {
  const formatCount = (value: number): string => (showPlaceholderCounts ? "..." : formatNumber(value));
  const allDisabledStyle = disabled && !allActive;

  return (
    <div className={className ?? "flex flex-wrap gap-2"}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClickAll}
        className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${allDisabledStyle ? disabledBadgeClass() : `${allButtonClassName ?? badgeClass(allActive)}${disabled ? " cursor-not-allowed opacity-70" : ""}`}`}
      >
        {allLabel} <span className="ml-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatCount(allCount ?? counts.all)})</span>
      </button>
      {SUBJECT_TYPE_VALUES.map((type) => {
        const isInactiveZero = hideZeroInactive && !activeTypes[type] && counts[type] === 0;
        if (isInactiveZero) {
          return null;
        }

        return (
          <SubjectTypeFilterButton
            key={type}
            type={type}
            countLabel={formatCount(counts[type])}
            active={activeTypes[type]}
            disabled={disabled}
            onClick={() => onClickType(type)}
          />
        );
      })}
    </div>
  );
}
