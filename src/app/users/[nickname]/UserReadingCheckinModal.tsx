import { useEffect, useState } from "react";
import type { ReadingChallengeBookRecord, ReadingReviewQueueSnapshot, ReadingSignoffRecord } from "@/lib/readingSignoff";
import ExplorerConfirmDialog from "./shared/ExplorerConfirmDialog";
import UserReadingBooksEditor from "./UserReadingBooksEditor";
import UserReadingCheckinModalAdminDateField from "./UserReadingCheckinModalAdminDateField";
import UserReadingCheckinModalReviewQueue from "./UserReadingCheckinModalReviewQueue";

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
  const hasReadingActivity = form.pagesRead > 0 || form.minutesRead > 0;
  const hasWaniKaniActivity = form.didWanikaniReviews;
  const checkinMode: "none" | "reading" | "wanikani" | "both" = hasReadingActivity ? (hasWaniKaniActivity ? "both" : "reading") : (hasWaniKaniActivity ? "wanikani" : "none");
  const saveScopeLabel = checkinMode === "both" ? "reading + WaniKani" : checkinMode === "reading" ? "reading" : checkinMode === "wanikani" ? "WaniKani" : "nothing yet";
  const showReading = checkinMode === "reading" || checkinMode === "both";
  const showWaniKani = checkinMode === "wanikani" || checkinMode === "both";

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
          <div className="mt-3">
            <UserReadingBooksEditor
              memberBooks={memberBooks}
              selectedBookTitle={form.bookTitle}
              onBookChange={onBookChange}
              addIsbn={addIsbn}
              bookActionMessage={bookActionMessage}
              bookActionState={bookActionState}
              onAddIsbnChange={onAddIsbnChange}
              onAddBook={onAddBook}
              onDeleteBook={onDeleteBook}
            />
          </div>
        ) : null}
        {showWaniKani ? <UserReadingCheckinModalReviewQueue selectedReviewQueue={selectedReviewQueue} /> : null}
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
