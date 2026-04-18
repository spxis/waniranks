import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  details?: string[];
  detailsTitle?: string;
  requirePhrase?: string;
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
  detailsTitle = "Selected Items",
  requirePhrase,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const [typedPhrase, setTypedPhrase] = useState("");

  useEffect(() => {
    if (!open) {
      setTypedPhrase("");
    }
  }, [open]);

  const requiresPhraseMatch = Boolean(requirePhrase);
  const phraseMatches = useMemo(() => {
    if (!requirePhrase) {
      return true;
    }

    return typedPhrase.trim().toUpperCase() === requirePhrase.trim().toUpperCase();
  }, [requirePhrase, typedPhrase]);

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
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/65">{detailsTitle}</p>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-line bg-surface px-2 py-1">
              <ul className="space-y-1 text-sm font-semibold text-foreground/85">
                {details.map((detail, index) => (
                  <li key={`${detail}-${index}`}>{detail}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {requiresPhraseMatch ? (
          <div className="mt-3 rounded-xl border border-line bg-surface-muted p-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/65">
              Type {requirePhrase} To Confirm
            </p>
            <input
              type="text"
              value={typedPhrase}
              onChange={(event) => setTypedPhrase(event.target.value)}
              placeholder={requirePhrase}
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-foreground outline-none ring-accent/40 focus:ring-2"
            />
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
              disabled={busy || !phraseMatches}
            className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-55 ${confirmButtonClass}`}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
