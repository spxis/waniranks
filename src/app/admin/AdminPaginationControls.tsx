"use client";

import { FormEvent, useEffect, useState } from "react";

type AdminPaginationControlsProps = {
  page: number;
  pageCount: number;
  itemLabel: string;
  total: number;
  onFirst?: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast?: () => void;
  onPageChange?: (nextPage: number) => void;
  disabled?: boolean;
};

export default function AdminPaginationControls({
  page,
  pageCount,
  itemLabel,
  total,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  onPageChange,
  disabled = false,
}: AdminPaginationControlsProps) {
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  function submitPageJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onPageChange) {
      return;
    }

    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const nextPage = Math.min(pageCount, Math.max(1, Math.trunc(parsed)));
    if (nextPage !== page) {
      onPageChange(nextPage);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/65">
      <p>
        Page {page} of {pageCount} · {total.toLocaleString("en-US")} total {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onFirst ?? onPrevious}
          disabled={disabled || page <= 1}
          className="h-9 rounded-full border border-line bg-white px-3 text-xs font-bold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-60"
        >
          First
        </button>
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
        <button
          type="button"
          onClick={onLast ?? onNext}
          disabled={disabled || page >= pageCount}
          className="h-9 rounded-full border border-line bg-white px-3 text-xs font-bold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Last
        </button>
        {onPageChange ? (
          <form onSubmit={submitPageJump} className="ml-1 flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={pageCount}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              className="h-9 w-16 rounded-md border border-line bg-white px-2 text-xs"
              disabled={disabled}
              aria-label="Page number"
            />
            <button
              type="submit"
              disabled={disabled}
              className="h-9 rounded-full border border-line bg-white px-3 text-xs font-bold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Go
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
