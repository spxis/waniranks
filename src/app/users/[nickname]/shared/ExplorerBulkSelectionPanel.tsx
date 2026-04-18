type BulkSelectionRow = {
  subjectId: number;
  characters: string;
  subjectTypeLabel: string;
  wkLevel: number | null;
  srsStage: number;
  reading: string | null;
  meaning: string | null;
};

type Props = {
  selectedCount: number;
  preview: string[];
  rows: BulkSelectionRow[];
  showFullList: boolean;
  isBusy?: boolean;
  onToggleFullList: () => void;
  onSelectVisible: () => void;
  onClearSelection: () => void;
  onDone: () => void;
};

export default function ExplorerBulkSelectionPanel({
  selectedCount,
  preview,
  rows,
  showFullList,
  isBusy = false,
  onToggleFullList,
  onSelectVisible,
  onClearSelection,
  onDone,
}: Props) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-surface p-3 shadow-[0_8px_22px_rgba(8,16,36,0.12)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Bulk Selection Active</p>
          <p className="mt-1 text-sm font-semibold text-foreground/85">
            Selected {selectedCount} item{selectedCount === 1 ? "" : "s"}
          </p>
          {hasSelection ? (
            <>
              <button
                type="button"
                onClick={onToggleFullList}
                className="mt-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/80 hover:bg-surface-muted"
              >
                {showFullList ? "Hide Full List" : "View Full List"}
              </button>
              <p className="mt-1 text-xs text-foreground/70">{preview.join("  •  ")}</p>
            </>
          ) : (
            <p className="mt-1 text-xs text-foreground/70">Shift+click to select ranges.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button
            type="button"
            onClick={onSelectVisible}
            disabled={rows.length === 0 || isBusy}
            className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Select Visible
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={!hasSelection || isBusy}
            className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onDone}
            disabled={isBusy}
            className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>

      {showFullList && hasSelection ? (
        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-line bg-surface-muted">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/70">
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Reading</th>
                <th className="px-3 py-2">Meaning</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">SRS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.subjectId} className="border-b border-line/60 last:border-b-0">
                  <td className="px-3 py-2 text-sm font-black text-foreground">{row.characters}</td>
                  <td className="px-3 py-2 text-foreground/80">{row.reading ?? "-"}</td>
                  <td className="px-3 py-2 text-foreground/80">{row.meaning ?? "-"}</td>
                  <td className="px-3 py-2 font-semibold uppercase tracking-[0.06em] text-foreground/80">
                    {row.subjectTypeLabel}
                  </td>
                  <td className="px-3 py-2 font-semibold text-foreground/80">
                    {typeof row.wkLevel === "number" ? `L${row.wkLevel}` : "L?"}
                  </td>
                  <td className="px-3 py-2 font-semibold text-foreground/80">{row.srsStage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}