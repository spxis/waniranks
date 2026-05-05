import { disabledBadgeClass, formatNumber, typeBadgeClass } from "../level-explorer/lib/levelExplorerDisplay";
import { subjectTypeFilterLabel } from "./subjectTypeLabels";

type SubjectType = "radical" | "kanji" | "vocabulary";

type Props = {
  type: SubjectType;
  count?: number;
  countLabel?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export default function SubjectTypeFilterButton({
  type,
  count,
  countLabel,
  active,
  disabled = false,
  onClick,
}: Props) {
  const resolvedCountLabel = countLabel ?? formatNumber(count ?? 0);
  const showDisabledStyle = disabled && !active;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
        showDisabledStyle ? disabledBadgeClass() : `${typeBadgeClass(type, active, false)}${disabled ? " cursor-not-allowed opacity-70" : ""}`
      }`}
    >
      {subjectTypeFilterLabel(type)} ({resolvedCountLabel})
    </button>
  );
}
