import Image from "next/image";
import { useEffect, useState } from "react";
import type { ReadingChallengeBookRecord, ReadingReviewQueueSnapshot, ReadingSignoffRecord } from "@/lib/readingSignoff";
import { SUBJECT_TYPES } from "@/lib/domainConstants";
import { subjectTypePluralLabel } from "./shared/subjectTypeLabels";
import ExplorerConfirmDialog from "./shared/ExplorerConfirmDialog";
import UserReadingCheckinModalAdminDateField from "./UserReadingCheckinModalAdminDateField";

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
  allowSignoffDateEdit: boolean;
  maxSignoffDatePst: string;
  memberBooks: ReadingChallengeBookRecord[];
  addIsbn: string;
  bookActionMessage: string;
  bookActionState: "idle" | "adding" | "deleting";
  submitState: SubmitState;
  submitMessage: string;
  isDirty: boolean;
  selectedReviewQueue: ReadingReviewQueueSnapshot;
  modalExistingEntry: ReadingSignoffRecord | null;
  onRequestClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onMemberChange: (nextMemberId: string) => void;
  onSignoffDateChange: (nextDateKey: string) => void;
  onAddIsbnChange: (value: string) => void;
  onAddBook: () => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
  onQuickReading: () => void;
  onQuickWaniKani: () => void;
  onQuickBoth: () => void;
  onBookChange: (nextBook: string) => void;
  onPagesChange: (nextPages: number) => void;
  onMinutesChange: (nextMinutes: number) => void;
};

export default function UserReadingCheckinModal({
  open,
  form,
  members,
  selectedMemberId,
  selectedMemberName,
  viewerCanChooseMember,
  allowSignoffDateEdit,
  maxSignoffDatePst,
  memberBooks,
  addIsbn,
  bookActionMessage,
  bookActionState,
  submitState,
  submitMessage,
  isDirty,
  selectedReviewQueue,
  modalExistingEntry,
  onRequestClose,
  onSubmit,
  onMemberChange,
  onSignoffDateChange,
  onAddIsbnChange,
  onAddBook,
  onDeleteBook,
  onQuickReading,
  onQuickWaniKani,
  onQuickBoth,
  onBookChange,
  onPagesChange,
  onMinutesChange,
}: UserReadingCheckinModalProps) {
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [showAddBookForm, setShowAddBookForm] = useState(false);
  const [previewBook, setPreviewBook] = useState<ReadingChallengeBookRecord | null>(null);
  const isBookActionLoading = bookActionState !== "idle";

  function requestCloseWithConfirm() {
    if (!isDirty) {
      onRequestClose();
      return;
    }
    setDiscardConfirmOpen(true);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      if (!isDirty) {
        onRequestClose();
        return;
      }
      setDiscardConfirmOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isDirty, onRequestClose, open]);

  if (!open || !form) {
    return null;
  }

  const pagesGoalForBonus = 15;
  const pagesToBonus = Math.max(0, pagesGoalForBonus - form.pagesRead);
  const bonusReady = pagesToBonus === 0;
  const zeroReviewsBonusActive = selectedReviewQueue.total === 0;
  const hasReadingActivity = form.pagesRead > 0 || form.minutesRead > 0;
  const hasWaniKaniActivity = form.didWanikaniReviews;
  const checkinMode: "none" | "reading" | "wanikani" | "both" = hasReadingActivity ? (hasWaniKaniActivity ? "both" : "reading") : (hasWaniKaniActivity ? "wanikani" : "none");
  const saveScopeLabel = checkinMode === "both" ? "reading + WaniKani" : checkinMode === "reading" ? "reading" : checkinMode === "wanikani" ? "WaniKani" : "nothing yet";
  const showReading = checkinMode === "reading" || checkinMode === "both";
  const showWaniKani = checkinMode === "wanikani" || checkinMode === "both";

  function toggleBookPreview(book: ReadingChallengeBookRecord) {
    setPreviewBook((prev) => (prev?.id === book.id ? null : book));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 sm:p-6">
      <div className="flex max-h-[95dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-2xl sm:p-5">
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
            onClick={requestCloseWithConfirm}
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
        {allowSignoffDateEdit ? <UserReadingCheckinModalAdminDateField value={form.signoffDatePst} maxDate={maxSignoffDatePst} onChange={onSignoffDateChange} /> : null}

        <section className="mt-4 rounded-xl border border-line bg-surface-muted p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">What are you checking in?</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              className={`rounded-xl border px-3 py-3 text-left transition ${checkinMode === "reading" ? "border-accent bg-accent/10" : "border-line bg-surface hover:bg-surface-muted"}`}
              onClick={onQuickReading}
            >
              <p className="text-sm font-black text-foreground">Reading</p>
              <p className="text-xs text-foreground/70">Log book pages and minutes.</p>
            </button>
            <button
              type="button"
              className={`rounded-xl border px-3 py-3 text-left transition ${checkinMode === "wanikani" ? "border-accent bg-accent/10" : "border-line bg-surface hover:bg-surface-muted"}`}
              onClick={onQuickWaniKani}
            >
              <p className="text-sm font-black text-foreground">WaniKani</p>
              <p className="text-xs text-foreground/70">Log WaniKani activity only.</p>
            </button>
            <button
              type="button"
              className={`rounded-xl border px-3 py-3 text-left transition ${checkinMode === "both" ? "border-accent bg-accent/10" : "border-line bg-surface hover:bg-surface-muted"}`}
              onClick={onQuickBoth}
            >
              <p className="text-sm font-black text-foreground">Both</p>
              <p className="text-xs text-foreground/70">Log reading and WaniKani.</p>
            </button>
          </div>
          <p className="mt-2 text-xs text-foreground/70">
            Save check-in will log: <span className="font-bold text-foreground">{saveScopeLabel}</span>
          </p>
        </section>

        {showReading ? (
          <section className="relative mt-3 rounded-xl border border-line bg-surface-muted p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-black text-foreground">Challenge books</h4>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-foreground/70">Need at least 3 books to play</span>
                <button
                  type="button"
                  onClick={() => setShowAddBookForm((prev) => !prev)}
                  disabled={isBookActionLoading}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-foreground"
                  aria-expanded={showAddBookForm}
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] leading-none">+</span>
                  <span>{showAddBookForm ? "Done editing" : "Edit books"}</span>
                </button>
              </div>
            </div>
            <div className="mt-2 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-1.5">
                {memberBooks.map((book) => {
                  const selected = form.bookTitle === book.title;
                  return (
                    <div
                      key={book.id}
                      className={`h-64 w-33 shrink-0 rounded-lg border p-1.5 ${selected ? "border-accent bg-accent/5" : "border-line bg-surface"}`}
                    >
                      <div className="flex h-full flex-col">
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => toggleBookPreview(book)}
                          aria-label={`Preview ${book.title}`}
                        >
                          <div className="aspect-3/4 overflow-hidden rounded border border-line bg-surface-muted">
                            {book.thumbnailUrl ? (
                              <Image
                                src={book.thumbnailUrl}
                                alt={book.title}
                                width={120}
                                height={160}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-foreground/60">No cover</div>
                            )}
                          </div>
                        </button>
                        <button
                          type="button"
                          className="mt-1 w-full text-left"
                          disabled={isBookActionLoading}
                          onClick={() => onBookChange(book.title)}
                        >
                          <p className="line-clamp-2 min-h-8 text-xs font-semibold text-foreground">{book.title}</p>
                          <p className="text-[10px] text-foreground/60">ISBN {book.isbn}</p>
                        </button>
                        {showAddBookForm ? (
                          <div className="mt-auto flex items-center justify-between gap-1 pt-1">
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
                              onClick={() => {
                                void onDeleteBook(book.id);
                              }}
                              disabled={isBookActionLoading}
                              className="text-[10px] font-bold uppercase tracking-[0.08em] text-rose-700"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {showAddBookForm ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="flex-1 min-w-48">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/65">Add by ISBN</span>
                  <input
                    type="text"
                    maxLength={32}
                    className="mt-1 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm"
                    value={addIsbn}
                    disabled={isBookActionLoading}
                    onChange={(event) => onAddIsbnChange(event.target.value)}
                    placeholder="4-09-140108-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    void onAddBook();
                  }}
                  disabled={isBookActionLoading || addIsbn.trim().length === 0}
                  className="h-10 rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.08em]"
                >
                  {bookActionState === "adding" ? "Saving..." : "Save book"}
                </button>
              </div>
            ) : null}
            {bookActionMessage ? <p className="mt-2 text-xs text-foreground/70">{bookActionMessage}</p> : null}
            {isBookActionLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-surface/80 backdrop-blur-[1px]">
                <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground">
                  <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
                  {bookActionState === "adding" ? "Adding book" : "Updating books"}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
        {previewBook ? (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPreviewBook(null)}
            role="dialog"
            aria-label="Book cover preview"
          >
            <div className="max-h-[90vh] w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setPreviewBook(null)}
                className="mb-2 ml-auto block rounded-full border border-white/40 bg-black/40 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-white"
              >
                Close preview
              </button>
              <button type="button" className="w-full" onClick={() => setPreviewBook(null)}>
                <div className="overflow-hidden rounded-xl border border-white/30 bg-black/20">
                  {previewBook.thumbnailUrl ? (
                    <Image
                      src={previewBook.thumbnailUrl}
                      alt={previewBook.title}
                      width={640}
                      height={900}
                      className="h-auto w-full object-contain"
                    />
                  ) : (
                    <div className="flex min-h-96 items-center justify-center text-sm font-semibold text-white/80">No cover available</div>
                  )}
                </div>
              </button>
            </div>
          </div>
        ) : null}
        {showWaniKani ? (
          <section className="mt-3 rounded-xl border border-line bg-surface-muted p-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Current review queue snapshot</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground/85">
              <span className="subject-pill subject-pill--radical">
                {subjectTypePluralLabel(SUBJECT_TYPES.radical)} left: {selectedReviewQueue.radical}
              </span>
              <span className="subject-pill subject-pill--kanji">
                {subjectTypePluralLabel(SUBJECT_TYPES.kanji)} left: {selectedReviewQueue.kanji}
              </span>
              <span className="subject-pill subject-pill--vocabulary">
                {subjectTypePluralLabel(SUBJECT_TYPES.vocabulary)} left: {selectedReviewQueue.vocabulary}
              </span>
            </div>
            <p className={`mt-1 text-xs ${zeroReviewsBonusActive ? "text-emerald-700" : "text-foreground/70"}`}>
              {zeroReviewsBonusActive
                ? "Special bonus active: review queue is at 0."
                : `${selectedReviewQueue.total} total reviews currently due.`}
            </p>
          </section>
        ) : null}
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
          {showReading ? (
            <>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Your Book</span>
                <select
                  className="h-10 rounded-lg border border-line bg-surface-muted px-3 text-sm"
                  value={form.bookTitle}
                  onChange={(event) => onBookChange(event.target.value)}
                >
                  <option value="">Pick a challenge book</option>
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
                  min={0}
                  max={2000}
                  className="h-10 rounded-lg border border-line bg-surface-muted px-3 text-sm"
                  value={form.pagesRead}
                  onChange={(event) => onPagesChange(Number(event.target.value))}
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
                  min={0}
                  max={1440}
                  className="h-10 rounded-lg border border-line bg-surface-muted px-3 text-sm"
                  value={form.minutesRead}
                  onChange={(event) => onMinutesChange(Number(event.target.value))}
                />
                <span className={`text-[11px] ${form.minutesRead > 30 ? "text-emerald-700" : "text-foreground/70"}`}>
                  {form.minutesRead > 30
                    ? "Bonus unlocked: +JPY 500 for reading over 30 minutes."
                    : `Read ${Math.max(0, 31 - form.minutesRead)} more minute${Math.max(0, 31 - form.minutesRead) === 1 ? "" : "s"} to unlock +JPY 500.`}
                </span>
              </label>
            </>
          ) : null}

          {modalExistingEntry ? (
            <p className="sm:col-span-2 text-xs text-foreground/70">
              Previous saved snapshot: reviews left {modalExistingEntry.reviewsLeft}, apprentice {modalExistingEntry.apprenticeCount}, level {modalExistingEntry.currentWkLevel}
            </p>
          ) : null}

          {!showReading ? (
            <p className="sm:col-span-2 text-xs text-foreground/70">
              WaniKani-only check-in is valid: no reading numbers and no selected book.
            </p>
          ) : null}

          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-5 text-sm font-bold uppercase tracking-[0.08em] text-foreground transition hover:bg-surface-muted"
              disabled={submitState === "saving"}
            >
              {submitState === "saving" ? "Saving" : `Save ${saveScopeLabel} check-in`}
            </button>
            {submitMessage ? (
              <p className={`text-sm ${submitState === "error" ? "text-red-700" : "text-foreground/75"}`}>
                {submitMessage}
              </p>
            ) : null}
            {isDirty ? <p className="text-xs text-foreground/65">Unsaved changes. Press Esc to close with confirmation.</p> : null}
          </div>
        </form>

        <ExplorerConfirmDialog
          open={discardConfirmOpen}
          title="Discard check-in changes?"
          description="You have unsaved edits in this check-in." 
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          tone="neutral"
          onCancel={() => setDiscardConfirmOpen(false)}
          onConfirm={() => {
            setDiscardConfirmOpen(false);
            onRequestClose();
          }}
        />
      </div>
    </div>
  );
}
