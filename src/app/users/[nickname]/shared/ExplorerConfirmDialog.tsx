import { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  details?: string[];
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ExplorerConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  details,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onCancel, open]);

  if (!open) {
    return null;
  }

  const confirmButtonClass =
    tone === "danger"
      ? "border-red-300 bg-red-600 text-white hover:bg-red-700"
      : "border-accent bg-accent text-white hover:bg-accent-2";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-[0_20px_55px_rgba(8,16,36,0.25)]"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/55">Confirm Action</p>
        <h3 className="mt-1 text-xl font-black text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-foreground/80">{description}</p>

        {details && details.length > 0 ? (
          <div className="mt-3 rounded-xl border border-line bg-surface-muted p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/65">Selected Items</p>
            <p className="mt-1 text-sm font-semibold text-foreground/85">{details.join("  •  ")}</p>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-55"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-55 ${confirmButtonClass}`}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
