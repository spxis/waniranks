import type { ReactNode } from "react";

type Props = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  ariaLabel: string;
  children: ReactNode;
};

export default function StudyFilterSection({
  title,
  isOpen,
  onToggle,
  ariaLabel,
  children,
}: Props) {
  const isCollapsedOnMobile = !isOpen;

  return (
    <div className="flex w-full max-w-full items-start gap-1 rounded-xl border border-line bg-surface px-1.5 py-1">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={!isOpen}
        className="inline-flex h-7 items-center px-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground/70"
        title={isOpen ? `Compact ${title}` : `Expand ${title}`}
      >
        {title}
        <span className={`ml-1 text-[11px] leading-none ${isCollapsedOnMobile ? "opacity-70" : "opacity-0"}`}>+</span>
      </button>
      <div
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
        role="tablist"
        aria-label={ariaLabel}
      >
        {children}
        {isCollapsedOnMobile ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={`Expand ${title} filters`}
            className="ml-auto inline-flex h-7 items-center px-1 text-[12px] font-semibold tracking-[0.2em] text-foreground/35 sm:hidden"
          >
            ...
          </button>
        ) : null}
      </div>
    </div>
  );
}
