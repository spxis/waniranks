"use client";

import { formatDateTimeShort, formatRelativeFromNow } from "@/lib/timeFormat";

import type { AdminReadingEntry, EntryEditDraft } from "./AdminReadingEntries.types";

type AdminReadingEntriesTableProps = {
  entries: AdminReadingEntry[];
  editingEntryId: string | null;
  draft: EntryEditDraft | null;
  loading: boolean;
  saving: boolean;
  localTimezoneLabel: string;
  onDraftChange: (nextDraft: EntryEditDraft) => void;
  onBeginEdit: (entry: AdminReadingEntry) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDeleteEntry: (entry: AdminReadingEntry) => void;
};

export default function AdminReadingEntriesTable({
  entries,
  editingEntryId,
  draft,
  loading,
  saving,
  localTimezoneLabel,
  onDraftChange,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDeleteEntry,
}: AdminReadingEntriesTableProps) {
  return (
    <div className="relative mt-4 min-h-96 overflow-auto rounded-xl border border-line">
      {loading ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end bg-white/45 p-3">
          <p className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-foreground/75">Loading...</p>
        </div>
      ) : null}

      <table className="w-full min-w-205 text-left text-xs sm:text-sm">
        <thead className="bg-surface-muted text-[11px] uppercase tracking-[0.08em] text-foreground/70">
          <tr>
            <th className="px-3 py-2">Created / Updated</th>
            <th className="px-3 py-2">Member</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Book</th>
            <th className="px-3 py-2">Pages</th>
            <th className="px-3 py-2">Minutes</th>
            <th className="px-3 py-2">WK done</th>
            <th className="px-3 py-2">Reviews left</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/50 bg-surface">
          {entries.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-3 py-6 text-center text-sm text-foreground/70">
                {loading ? "Loading check-ins..." : "No check-ins found for the selected filters."}
              </td>
            </tr>
          ) : null}

          {entries.map((entry) => {
            const isEditing = editingEntryId === entry.id && draft !== null;

            return (
              <tr key={entry.id} className="align-top hover:bg-surface-muted/40">
                <td className="whitespace-nowrap px-3 py-2 text-foreground/70">
                  <p className="font-semibold text-foreground/85">{formatDateTimeShort(entry.createdAt)}</p>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-foreground/55">
                    {formatRelativeFromNow(entry.createdAt, {
                      style: "short",
                      allowFuture: false,
                      noValueLabel: "-",
                      invalidLabel: "-",
                    })}
                  </p>
                  {entry.updatedAt ? (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-foreground/55">
                      Updated {formatDateTimeShort(entry.updatedAt)}
                    </p>
                  ) : null}
                  {isEditing && draft.source === "entry" ? (
                    <label className="mt-2 flex max-w-48 flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">
                        Submitted time ({localTimezoneLabel})
                      </span>
                      <input
                        type="datetime-local"
                        className="h-9 rounded-md border border-line bg-white px-2 text-xs"
                        value={draft.submittedAtLocal}
                        onChange={(event) => {
                          onDraftChange({
                            ...draft,
                            submittedAtLocal: event.target.value,
                          });
                        }}
                      />
                    </label>
                  ) : null}
                </td>

                <td className="whitespace-nowrap px-3 py-2">
                  <p className="font-semibold text-foreground/90">{entry.nickname}</p>
                  <p className="text-[11px] text-foreground/60">{entry.wkUsername}</p>
                </td>

                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${entry.source === "daily" ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-sky-200 bg-sky-50 text-sky-700"}`}
                  >
                    {entry.source === "daily" ? "Daily" : "Entry"}
                  </span>
                </td>

                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="date"
                      className="h-9 w-34 rounded-md border border-line bg-white px-2 text-xs"
                      value={draft.signoffDatePst}
                      onChange={(event) => {
                        onDraftChange({
                          ...draft,
                          signoffDatePst: event.target.value,
                        });
                      }}
                    />
                  ) : (
                    entry.signoffDatePst
                  )}
                </td>

                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="text"
                      className="h-9 w-56 rounded-md border border-line bg-white px-2 text-xs"
                      maxLength={180}
                      value={draft.bookTitle}
                      onChange={(event) => {
                        onDraftChange({
                          ...draft,
                          bookTitle: event.target.value,
                        });
                      }}
                    />
                  ) : (
                    <span className="line-clamp-2">{entry.bookTitle}</span>
                  )}
                </td>

                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="number"
                      className="h-9 w-20 rounded-md border border-line bg-white px-2 text-xs"
                      min={0}
                      max={2000}
                      value={draft.pagesRead}
                      onChange={(event) => {
                        onDraftChange({
                          ...draft,
                          pagesRead: Number(event.target.value),
                        });
                      }}
                    />
                  ) : (
                    entry.pagesRead
                  )}
                </td>

                <td className="px-3 py-2">
                  {isEditing ? <input
                    type="number"
                    className="h-9 w-20 rounded-md border border-line bg-white px-2 text-xs"
                    min={0}
                    max={1440}
                    value={draft.minutesRead}
                    onChange={(event) => {
                      onDraftChange({
                        ...draft,
                        minutesRead: Number(event.target.value),
                      });
                    }}
                  /> : entry.minutesRead}
                </td>

                <td className="px-3 py-2">
                  {isEditing ? (
                    <label className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/80"><input
                      type="checkbox"
                      checked={draft.didWanikaniReviews}
                      onChange={(event) => {
                        onDraftChange({
                          ...draft,
                          didWanikaniReviews: event.target.checked,
                        });
                      }}
                    />Yes</label>
                  ) : entry.didWanikaniReviews ? (
                    "Yes"
                  ) : (
                    "No"
                  )}
                </td>

                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="number"
                      className="h-9 w-24 rounded-md border border-line bg-white px-2 text-xs"
                      min={0}
                      max={20000}
                      value={draft.reviewsLeft}
                      onChange={(event) => {
                        onDraftChange({
                          ...draft,
                          reviewsLeft: Number(event.target.value),
                        });
                      }}
                    />
                  ) : (
                    entry.reviewsLeft
                  )}
                </td>

                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={onSaveEdit}
                          className="rounded-full border border-line bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                          disabled={saving || loading}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          className="rounded-full border border-line bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                          disabled={saving || loading}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onBeginEdit(entry)}
                        className="rounded-full border border-line bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                        disabled={saving || loading}
                      >
                        Edit
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry)}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-red-700"
                      disabled={saving || loading}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
