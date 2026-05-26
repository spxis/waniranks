type AdminPaginationControlsProps = {
  page: number;
  pageCount: number;
  itemLabel: string;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
};

export default function AdminPaginationControls({
  page,
  pageCount,
  itemLabel,
  total,
  onPrevious,
  onNext,
  disabled = false,
}: AdminPaginationControlsProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/65">
      <p>
        Page {page} of {pageCount} · {total.toLocaleString("en-US")} total {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={disabled || page <= 1}
          className="h-9 rounded-full border border-line bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={disabled || page >= pageCount}
          className="h-9 rounded-full border border-line bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Next
        </button>
      </div>
    </div>
  );
}
