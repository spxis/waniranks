import { disabledBadgeClass, formatNumber, typeBadgeClass } from "../level-explorer/lib/levelExplorerDisplay";

type SubjectType = "radical" | "kanji" | "vocabulary";

type Props = {
  type: SubjectType;
  count: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function buttonLabel(type: SubjectType): string {
  if (type === "vocabulary") {
    return "vocab";
  }

  return type;
}

export default function SubjectTypeFilterButton({
  type,
  count,
  active,
  disabled = false,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
        disabled ? disabledBadgeClass() : typeBadgeClass(type, active, false)
      }`}
    >
      {buttonLabel(type)} ({formatNumber(count)})
    </button>
  );
}
