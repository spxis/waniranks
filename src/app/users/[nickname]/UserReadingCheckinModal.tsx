import Image from "next/image";
import { useEffect } from "react";

import type {
  ReadingChallengeBookRecord,
  ReadingReviewQueueSnapshot,
  ReadingSignoffRecord,
} from "@/lib/readingSignoff";

type Member = {
  id: string;
  nickname: string;
};

type FormState = {
  signoffDatePst: string;
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
};

type SubmitState = "idle" | "saving" | "saved" | "error";

type UserReadingCheckinModalProps = {
  open: boolean;
  form: FormState | null;
  members: Member[];
  selectedMemberId: string;
  selectedMemberName: string;
  viewerCanChooseMember: boolean;
  memberBooks: ReadingChallengeBookRecord[];
  addIsbn: string;
  bookActionMessage: string;
  submitState: SubmitState;
  submitMessage: string;
  isDirty: boolean;
  selectedReviewQueue: ReadingReviewQueueSnapshot;
  modalExistingEntry: ReadingSignoffRecord | null;
  onRequestClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onMemberChange: (nextMemberId: string) => void;
  onAddIsbnChange: (value: string) => void;
  onAddBook: () => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
  onQuickReading: () => void;
  onQuickWaniKani: () => void;
  onDateChange: (nextDate: string) => void;
  onBookChange: (nextBook: string) => void;
  onPagesChange: (nextPages: number) => void;
  onMinutesChange: (nextMinutes: number) => void;
  onDidReviewsChange: (nextDidReviews: boolean) => void;
};

export default function UserReadingCheckinModal({
  open,
  form,
  members,
  selectedMemberId,
  selectedMemberName,
  viewerCanChooseMember,
  memberBooks,
  addIsbn,
  bookActionMessage,
  submitState,
  submitMessage,
  isDirty,
  selectedReviewQueue,
  modalExistingEntry,
  onRequestClose,
  onSubmit,
  onMemberChange,
  onAddIsbnChange,
  onAddBook,
  onDeleteBook,
  onQuickReading,
  onQuickWaniKani,
  onDateChange,
  onBookChange,
  onPagesChange,
  onMinutesChange,
  onDidReviewsChange,
}: UserReadingCheckinModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onRequestClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onRequestClose]);

  if (!open || !form) {
    return null;
  }

  const pagesGoalForBonus = 15;
  const pagesToBonus = Math.max(0, pagesGoalForBonus - form.pagesRead);
  const bonusReady = pagesToBonus === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-4 shadow-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/60">Nightly check-in</p>
            <h3 className="text-xl font-black text-foreground">
              {selectedMemberName} on {form.signoffDatePst}
            </h3>
            <p className="mt-1 text-sm text-foreground/70">Save challenge books, mark activity, then save.</p>
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            className="rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]"
          >
            Close
          </button>
        </div>

        {viewerCanChooseMember ? (
          <label className="mt-4 flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">User</span>
            <select
              className="h-10 rounded-lg border border-line bg-surface-muted px-3 text-sm"
              value={selectedMemberId}
              onChange={(event) => onMemberChange(event.target.value)}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nickname}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <section className="mt-4 rounded-xl border border-line bg-surface-muted p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-black text-foreground">Challenge books</h4>
            <span className="text-xs text-foreground/70">Need at least 3 books to play</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {memberBooks.map((book) => {
              const selected = form.bookTitle === book.title;
              return (
                <div key={book.id} className={`rounded-lg border p-2 ${selected ? "border-accent bg-accent/5" : "border-line bg-surface"}`}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onBookChange(book.title)}
                  >
                    <div className="aspect-[3/4] overflow-hidden rounded border border-line bg-surface-muted">
                      {book.thumbnailUrl ? (
                        <Image
                          src={book.thumbnailUrl}
                          alt={book.title}
                          width={160}
                          height={220}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-foreground/60">No cover</div>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold text-foreground">{book.title}</p>
                    <p className="text-[10px] text-foreground/60">ISBN {book.isbn}</p>
                  </button>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    {book.infoUrl ? (
                      <a
                        href={book.infoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold uppercase tracking-[0.08em] text-accent"
                      >
                        Open
                      </a>
                    ) : <span />}
                    <button
                      type="button"
                      onClick={() => onDeleteBook(book.id)}
                      className="text-[10px] font-bold uppercase tracking-[0.08em] text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[12rem]">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/65">Add by ISBN</span>
              <input
                type="text"
                maxLength={32}
                className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm"
                value={addIsbn}
                onChange={(event) => onAddIsbnChange(event.target.value)}
                placeholder="4-09-140108-2"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                void onAddBook();
              }}
              className="h-10 rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.08em]"
            >
              Add book
            </button>
          </div>
          {bookActionMessage ? <p className="mt-2 text-xs text-foreground/70">{bookActionMessage}</p> : null}
        </section>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="rounded-xl border border-line bg-surface-muted px-3 py-2 text-left"
            onClick={onQuickReading}
          >
            <p className="text-sm font-black text-foreground">Reading check-in</p>
            <p className="text-xs text-foreground/70">Marks reading with current pages/minutes values.</p>
          </button>
          <button
            type="button"
            className="rounded-xl border border-line bg-surface-muted px-3 py-2 text-left"
            onClick={onQuickWaniKani}
          >
            <p className="text-sm font-black text-foreground">WaniKani reviews to 0</p>
            <p className="text-xs text-foreground/70">Checks off WaniKani completion for the night.</p>
          </button>
        </div>

        <section className="mt-3 rounded-xl border border-line bg-surface-muted p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Current review queue snapshot</p>
          <p className="mt-1 text-sm font-semibold text-foreground/85">
            K {selectedReviewQueue.kanji} / V {selectedReviewQueue.vocabulary} / R {selectedReviewQueue.radical}
          </p>
          <p className={`mt-1 text-xs ${selectedReviewQueue.total === 0 ? "text-emerald-700" : "text-foreground/70"}`}>
            {selectedReviewQueue.total === 0
              ? "Special bonus active: review queue is at 0."
              : `${selectedReviewQueue.total} total reviews currently due.`}
          </p>
        </section>

        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Date</span>
            <input
              type="date"
              className="h-10 rounded-lg border border-line bg-surface-muted px-3 text-sm"
              value={form.signoffDatePst}
              onChange={(event) => onDateChange(event.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Book</span>
            <select
              className="h-10 rounded-lg border border-line bg-surface-muted px-3 text-sm"
              value={form.bookTitle}
              onChange={(event) => onBookChange(event.target.value)}
              required
            >
              <option value="" disabled>
                Select a saved challenge book
              </option>
              {memberBooks.map((book) => (
                <option key={book.id} value={book.title}>
                  {book.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Pages read</span>
            <input
              type="number"
              min={1}
              max={2000}
              className="h-10 rounded-lg border border-line bg-surface-muted px-3 text-sm"
              value={form.pagesRead}
              onChange={(event) => onPagesChange(Number(event.target.value))}
              required
            />
            <span className={`text-[11px] ${bonusReady ? "text-emerald-700" : "text-foreground/70"}`}>
              {bonusReady
                ? "Bonus unlocked: +JPY 250 for the extra 5 pages streak."
                : `Read ${pagesToBonus} more page${pagesToBonus === 1 ? "" : "s"} to earn +JPY 250.`}
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Minutes read</span>
            <input
              type="number"
              min={1}
              max={1440}
              className="h-10 rounded-lg border border-line bg-surface-muted px-3 text-sm"
              value={form.minutesRead}
              onChange={(event) => onMinutesChange(Number(event.target.value))}
              required
            />
          </label>

          <label className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2">
            <input
              type="checkbox"
              checked={form.didWanikaniReviews}
              onChange={(event) => onDidReviewsChange(event.target.checked)}
            />
            <span className="text-sm font-semibold text-foreground/80">WaniKani reviews completed (auto-checked when K/V/R is 0)</span>
          </label>

          {modalExistingEntry ? (
            <p className="sm:col-span-2 text-xs text-foreground/70">
              Previous saved snapshot: reviews left {modalExistingEntry.reviewsLeft}, apprentice {modalExistingEntry.apprenticeCount}, level {modalExistingEntry.currentWkLevel}
            </p>
          ) : null}

          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-5 text-sm font-bold uppercase tracking-[0.08em] text-foreground transition hover:bg-surface-muted"
              disabled={submitState === "saving"}
            >
              {submitState === "saving" ? "Saving" : "Save check-in"}
            </button>
            {submitMessage ? (
              <p className={`text-sm ${submitState === "error" ? "text-red-700" : "text-foreground/75"}`}>
                {submitMessage}
              </p>
            ) : null}
            {isDirty ? <p className="text-xs text-foreground/65">Unsaved changes. Press Esc to close with confirmation.</p> : null}
          </div>
        </form>
      </div>
    </div>
  );
}
