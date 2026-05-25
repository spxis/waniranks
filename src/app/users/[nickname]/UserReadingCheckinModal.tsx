import { READING_BOOK_OPTIONS, type ReadingSignoffRecord } from "@/lib/readingSignoff";

type Member = {
  id: string;
  nickname: string;
};

type FormState = {
  signoffDatePst: string;
  bookTitle: (typeof READING_BOOK_OPTIONS)[number];
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
};

type ChallengeBooksState = [string, string, string];

type SubmitState = "idle" | "saving" | "saved" | "error";

type UserReadingCheckinModalProps = {
  open: boolean;
  form: FormState | null;
  members: Member[];
  selectedMemberId: string;
  selectedMemberName: string;
  viewerCanChooseMember: boolean;
  challengeBooks: ChallengeBooksState;
  submitState: SubmitState;
  submitMessage: string;
  modalExistingEntry: ReadingSignoffRecord | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onMemberChange: (nextMemberId: string) => void;
  onChallengeBookChange: (index: number, value: string) => void;
  onQuickReading: () => void;
  onQuickWaniKani: () => void;
  onDateChange: (nextDate: string) => void;
  onBookChange: (nextBook: (typeof READING_BOOK_OPTIONS)[number]) => void;
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
  challengeBooks,
  submitState,
  submitMessage,
  modalExistingEntry,
  onClose,
  onSubmit,
  onMemberChange,
  onChallengeBookChange,
  onQuickReading,
  onQuickWaniKani,
  onDateChange,
  onBookChange,
  onPagesChange,
  onMinutesChange,
  onDidReviewsChange,
}: UserReadingCheckinModalProps) {
  if (!open || !form) {
    return null;
  }

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
            onClick={onClose}
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
          <h4 className="text-sm font-black text-foreground">3 challenge books</h4>
          <p className="mt-1 text-xs text-foreground/70">These are required to join this challenge.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {challengeBooks.map((book, index) => (
              <label key={`challenge-book-${index}`} className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/65">Book {index + 1}</span>
                <input
                  type="text"
                  maxLength={80}
                  className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
                  value={book}
                  onChange={(event) => onChallengeBookChange(index, event.target.value)}
                  required
                />
              </label>
            ))}
          </div>
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
              onChange={(event) => onBookChange(event.target.value as (typeof READING_BOOK_OPTIONS)[number])}
            >
              {READING_BOOK_OPTIONS.map((book) => (
                <option key={book} value={book}>
                  {book}
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
            <span className="text-sm font-semibold text-foreground/80">WaniKani reviews completed</span>
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
          </div>
        </form>
      </div>
    </div>
  );
}
