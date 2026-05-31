import type { ReactNode } from "react";

type SegmentSize = "sm" | "md";

type SegmentOption<TValue extends string> = {
  value: TValue;
  label: ReactNode;
  title?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

type Props<TValue extends string> = {
  value: TValue;
  onChange: (next: TValue) => void;
  options: SegmentOption<TValue>[];
  size?: SegmentSize;
  ariaLabel: string;
  className?: string;
  asTabs?: boolean;
  mobileFill?: boolean;
};

const sizeClass: Record<SegmentSize, string> = {
  sm: "h-8 px-3 text-[11px] sm:px-3.5",
  md: "h-9 px-3.5 text-xs sm:px-4",
};

export default function SegmentedControl<TValue extends string>({
  value,
  onChange,
  options,
  size = "sm",
  ariaLabel,
  className,
  asTabs = false,
  mobileFill = false,
}: Props<TValue>) {
  const containerClassName = className ?? "inline-flex items-center rounded-full border border-line bg-surface p-1";
  const role = asTabs ? "tablist" : "group";

  return (
    <div className={containerClassName} role={role} aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        const activeClass = option.activeClassName ?? "border border-accent bg-accent text-white";
        const inactiveClass = option.inactiveClassName ?? "text-foreground hover:bg-surface-muted";
        return (
          <button
            key={option.value}
            type="button"
            role={asTabs ? "tab" : undefined}
            aria-selected={asTabs ? selected : undefined}
            onClick={() => onChange(option.value)}
            title={option.title}
            className={`inline-flex ${mobileFill ? "min-w-0 flex-1 sm:flex-none sm:shrink-0" : "shrink-0"} select-none items-center justify-center rounded-full font-bold uppercase tracking-[0.1em] transition ${sizeClass[size]} ${selected ? activeClass : inactiveClass}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}