import type { ReactNode } from "react";

type Props = {
  onClick: () => void;
  className: string;
  indexLabel: string;
  topRight: ReactNode;
  title: string;
  titleClassName?: string;
  titleTooltip?: string;
  glyphClassName: string;
  glyphText: string;
  glyphTextClassName: string;
  glyphSubtitle?: ReactNode;
  statusChip: ReactNode;
  middleChip?: ReactNode;
  rightChip: ReactNode;
};

export default function UnifiedExplorerCard({
  onClick,
  className,
  indexLabel,
  topRight,
  title,
  titleClassName,
  titleTooltip,
  glyphClassName,
  glyphText,
  glyphTextClassName,
  glyphSubtitle,
  statusChip,
  middleChip,
  rightChip,
}: Props) {
  return (
    <button type="button" onClick={onClick} className={className}>
      <div className="flex min-h-[2.35rem] items-start justify-between gap-2">
        <span className="text-[10px] font-semibold text-foreground/45">{indexLabel}</span>
        <div className="flex min-h-[2.2rem] flex-wrap content-start items-start justify-end gap-1">{topRight}</div>
      </div>

      <div className="mt-2 min-h-[2rem]">
        <p
          className={`truncate whitespace-nowrap text-xl font-black leading-none text-foreground ${titleClassName ?? ""}`.trim()}
          title={titleTooltip}
        >
          {title}
        </p>
      </div>

      <div className={`mt-3 flex h-[8.5rem] flex-col justify-center rounded-xl border px-3 py-2 ${glyphClassName}`}>
        <p className={`${glyphTextClassName} text-center font-black leading-none`}>{glyphText}</p>
        <p className="mt-1 min-h-[1.25rem] text-center text-sm font-semibold text-foreground/70">{glyphSubtitle ?? ""}</p>
      </div>

      <div className="mt-3 grid grid-cols-3 items-center gap-2">
        <span className="justify-self-start">{statusChip}</span>
        <span className="justify-self-center">{middleChip ?? <span />}</span>
        <span className="justify-self-end">{rightChip}</span>
      </div>
    </button>
  );
}
