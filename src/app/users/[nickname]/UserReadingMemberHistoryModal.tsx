"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  ReadingChallengeBookRecord,
  ReadingSignoffEntryRecord,
  ReadingSignoffRecord,
} from "@/lib/readingSignoff";

import UserReadingBookCoverImage from "./UserReadingBookCoverImage";
import type { Member } from "./UserReadingSignoffPanel.types";

type UserReadingMemberHistoryModalProps = {
  open: boolean;
  member: Member | null;
  signoffs: ReadingSignoffRecord[];
  entries: ReadingSignoffEntryRecord[];
  memberBooks: ReadingChallengeBookRecord[];
  isAdmin: boolean;
  onClose: () => void;
  onMutate: () => Promise<unknown> | unknown;
};

type BookLookup = { isbn: string; thumbnailUrl: string | null; title: string } | null;

function normalizeTitleKey(title: string): string {
  return title.trim().toLowerCase();
}

type EditDraft = {
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
  signoffDatePst: string;
};

function toDraftFromEntry(entry: ReadingSignoffEntryRecord): EditDraft {
  return {
    bookTitle: entry.bookTitle,
    pagesRead: entry.pagesRead,
    minutesRead: entry.minutesRead,
    didWanikaniReviews: entry.didWanikaniReviews,
    signoffDatePst: entry.signoffDatePst,
  };
}

function toDraftFromSignoff(signoff: ReadingSignoffRecord): EditDraft {
  return {
    bookTitle: signoff.bookTitle,
    pagesRead: signoff.pagesRead,
    minutesRead: signoff.minutesRead,
    didWanikaniReviews: signoff.didWanikaniReviews,
    signoffDatePst: signoff.signoffDatePst,
  };
}

export default function UserReadingMemberHistoryModal({
  open,
  member,
  signoffs,
  entries,
  memberBooks,
  isAdmin,
  onClose,
  onMutate,
}: UserReadingMemberHistoryModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setDraft(null);
      setPendingDeleteId(null);
      setErrorMessage(null);
    }
  }, [open]);

  // ESC closes the history modal. Use capture phase + stopImmediatePropagation
  // so any parent listeners (e.g. the books-section editor) don't also fire.
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onClose]);

  const bookByTitle = useMemo(() => {
    const map = new Map<string, BookLookup>();
    for (const book of memberBooks) {
      map.set(normalizeTitleKey(book.title), {
        isbn: book.isbn,
        thumbnailUrl: book.thumbnailUrl,
        title: book.title,
      });
    }
    return map;
  }, [memberBooks]);

  const groupedByDay = useMemo(() => {
    const byDay = new Map<string, { signoff: ReadingSignoffRecord | null; entries: ReadingSignoffEntryRecord[] }>();
    for (const signoff of signoffs) {
      const slot = byDay.get(signoff.signoffDatePst) ?? { signoff: null, entries: [] };
      slot.signoff = signoff;
      byDay.set(signoff.signoffDatePst, slot);
    }
    for (const entry of entries) {
      const slot = byDay.get(entry.signoffDatePst) ?? { signoff: null, entries: [] };
      slot.entries.push(entry);
      byDay.set(entry.signoffDatePst, slot);
    }
    return [...byDay.entries()]
      .map(([dateKey, slot]) => ({
        dateKey,
        signoff: slot.signoff,
        entries: [...slot.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      }))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [signoffs, entries]);

  if (!open || !member) {
    return null;
  }

  function startEdit(id: string, initial: EditDraft) {
    setEditingId(id);
    setDraft(initial);
    setErrorMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setErrorMessage(null);
  }

  async function saveEdit(id: string) {
    if (!draft) {
      return;
    }
    setBusyId(id);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/admin/reading-signoff-entries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signoffDatePst: draft.signoffDatePst,
          bookTitle: draft.bookTitle.trim() || "Reviews only",
          pagesRead: Math.max(0, Math.floor(draft.pagesRead)),
          minutesRead: Math.max(0, Math.floor(draft.minutesRead)),
          didWanikaniReviews: draft.didWanikaniReviews,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Could not update entry.");
      }
      await onMutate();
      cancelEdit();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update entry.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRow(id: string) {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      return;
    }
    setPendingDeleteId(null);
    setBusyId(id);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/admin/reading-signoff-entries/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Could not delete entry.");
      }
      await onMutate();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete entry.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${member.nickname} check-in history`}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-surface text-left shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-3 pt-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-foreground/55">Check-in history</p>
            <h2 className="text-lg font-black text-foreground">{member.nickname}</h2>
            <p className="text-xs text-foreground/65">
              {groupedByDay.length} day{groupedByDay.length === 1 ? "" : "s"} with activity
              {isAdmin ? " · admin edit mode" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]"
          >
            Close
          </button>
        </div>

        {errorMessage ? (
          <p className="mx-5 mt-3 rounded border border-red-400 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {groupedByDay.length === 0 ? (
            <p className="rounded border border-line bg-surface-muted px-3 py-4 text-center text-sm font-semibold text-foreground/65">
              No check-ins yet.
            </p>
          ) : null}
          {groupedByDay.map((day) => (
            <section key={day.dateKey} className="rounded-lg border border-line bg-surface-muted/40 p-3">
              <header className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-black text-foreground">{day.dateKey}</h3>
                {day.signoff ? (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/55">
                    Day total: {day.signoff.pagesRead}p · {day.signoff.minutesRead}m
                    {day.signoff.didWanikaniReviews ? " · WK" : ""}
                  </span>
                ) : null}
              </header>
              <ul className="space-y-2">
                {day.entries.length === 0 && day.signoff ? (
                  <RowDisplay
                    id={day.signoff.id}
                    bookTitle={day.signoff.bookTitle}
                    pagesRead={day.signoff.pagesRead}
                    minutesRead={day.signoff.minutesRead}
                    didWanikaniReviews={day.signoff.didWanikaniReviews}
                    book={bookByTitle.get(normalizeTitleKey(day.signoff.bookTitle)) ?? null}
                    bookOptions={memberBooks}
                    isAdmin={isAdmin}
                    isEditing={editingId === day.signoff.id}
                    draft={editingId === day.signoff.id ? draft : null}
                    busy={busyId === day.signoff.id}
                    pendingDelete={pendingDeleteId === day.signoff.id}
                    onEdit={() => startEdit(day.signoff!.id, toDraftFromSignoff(day.signoff!))}
                    onDraftChange={setDraft}
                    onCancel={cancelEdit}
                    onSave={() => saveEdit(day.signoff!.id)}
                    onDelete={() => deleteRow(day.signoff!.id)}
                    onCancelDelete={() => setPendingDeleteId(null)}
                  />
                ) : null}
                {day.entries.map((entry) => (
                  <RowDisplay
                    key={entry.id}
                    id={entry.id}
                    bookTitle={entry.bookTitle}
                    pagesRead={entry.pagesRead}
                    minutesRead={entry.minutesRead}
                    didWanikaniReviews={entry.didWanikaniReviews}
                    book={bookByTitle.get(normalizeTitleKey(entry.bookTitle)) ?? null}
                    bookOptions={memberBooks}
                    isAdmin={isAdmin}
                    isEditing={editingId === entry.id}
                    draft={editingId === entry.id ? draft : null}
                    busy={busyId === entry.id}
                    pendingDelete={pendingDeleteId === entry.id}
                    onEdit={() => startEdit(entry.id, toDraftFromEntry(entry))}
                    onDraftChange={setDraft}
                    onCancel={cancelEdit}
                    onSave={() => saveEdit(entry.id)}
                    onDelete={() => deleteRow(entry.id)}
                    onCancelDelete={() => setPendingDeleteId(null)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

type RowDisplayProps = {
  id: string;
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
  book: BookLookup;
  bookOptions: ReadingChallengeBookRecord[];
  isAdmin: boolean;
  isEditing: boolean;
  draft: EditDraft | null;
  busy: boolean;
  pendingDelete: boolean;
  onEdit: () => void;
  onDraftChange: (next: EditDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
};

function RowDisplay({
  bookTitle,
  pagesRead,
  minutesRead,
  didWanikaniReviews,
  book,
  bookOptions,
  isAdmin,
  isEditing,
  draft,
  busy,
  pendingDelete,
  onEdit,
  onDraftChange,
  onCancel,
  onSave,
  onDelete,
  onCancelDelete,
}: RowDisplayProps) {
  if (isEditing && draft) {
    return (
      <li className="rounded border border-accent/40 bg-surface p-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <select
            value={draft.bookTitle}
            onChange={(event) => onDraftChange({ ...draft, bookTitle: event.target.value })}
            className="rounded border border-line bg-surface px-2 py-1 text-xs"
            aria-label="Book"
          >
            {bookOptions.findIndex((option) => option.title === draft.bookTitle) === -1 ? (
              <option value={draft.bookTitle}>{draft.bookTitle || "(unknown book)"}</option>
            ) : null}
            {bookOptions.map((option) => (
              <option key={option.id} value={option.title}>
                {option.title}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={draft.pagesRead}
            onChange={(event) => onDraftChange({ ...draft, pagesRead: Number(event.target.value) || 0 })}
            className="w-20 rounded border border-line bg-surface px-2 py-1 text-xs"
            aria-label="Pages read"
          />
          <input
            type="number"
            min={0}
            value={draft.minutesRead}
            onChange={(event) => onDraftChange({ ...draft, minutesRead: Number(event.target.value) || 0 })}
            className="w-20 rounded border border-line bg-surface px-2 py-1 text-xs"
            aria-label="Minutes read"
          />
          <label className="flex items-center gap-1 text-[11px] font-semibold text-foreground/75">
            <input
              type="checkbox"
              checked={draft.didWanikaniReviews}
              onChange={(event) => onDraftChange({ ...draft, didWanikaniReviews: event.target.checked })}
            />
            WK
          </label>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-line px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em]"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-accent px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-60"
            onClick={onSave}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded border border-line bg-surface px-2 py-1 text-xs">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {book?.isbn ? (
          <UserReadingBookCoverImage
            isbn={book.isbn}
            title={book.title}
            thumbnailUrl={book.thumbnailUrl}
            width={28}
            height={40}
            size="small"
            className="h-10 w-7 shrink-0 rounded object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{bookTitle}</p>
          <p className="text-[10px] font-semibold text-foreground/65">
            {pagesRead}p · {minutesRead}m{didWanikaniReviews ? " · WK" : ""}
          </p>
        </div>
      </div>
      {isAdmin ? (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
            disabled={busy || pendingDelete}
          >
            Edit
          </button>
          {pendingDelete ? (
            <>
              <button
                type="button"
                onClick={onCancelDelete}
                className="rounded border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-60"
                disabled={busy}
              >
                {busy ? "…" : "Confirm"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onDelete}
              className="rounded border border-red-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-red-700"
              disabled={busy}
            >
              Delete
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}
