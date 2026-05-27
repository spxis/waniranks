import { useState } from "react";

import type { ReadingChallengeBookRecord } from "@/lib/readingSignoff";

import { useBookStripAutoScroll } from "./UserReadingCheckinModal.bookStrip";
import UserReadingBookCoverImage from "./UserReadingBookCoverImage";

type UserReadingBooksEditorProps = {
  memberBooks: ReadingChallengeBookRecord[];
  showBookPicker?: boolean;
  selectedBookTitle?: string;
  onBookChange?: (nextBookTitle: string) => void;
  addIsbn: string;
  bookActionMessage: string;
  bookActionState: "idle" | "adding" | "deleting";
  onAddIsbnChange: (value: string) => void;
  onAddBook: () => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
};

export default function UserReadingBooksEditor({
  memberBooks,
  showBookPicker = false,
  selectedBookTitle,
  onBookChange,
  addIsbn,
  bookActionMessage,
  bookActionState,
  onAddIsbnChange,
  onAddBook,
  onDeleteBook,
}: UserReadingBooksEditorProps) {
  const [showAddBookForm, setShowAddBookForm] = useState(false);
  const [previewBook, setPreviewBook] = useState<ReadingChallengeBookRecord | null>(null);
  const isBookActionLoading = bookActionState !== "idle";
  const canSelectBook = typeof onBookChange === "function";
  const setBookCardRef = useBookStripAutoScroll({
    open: true,
    showReading: true,
    selectedBookTitle: selectedBookTitle ?? "",
    booksKey: memberBooks.map((book) => `${book.id}:${book.title}`).join("|"),
  });

  function toggleBookPreview(book: ReadingChallengeBookRecord) {
    setPreviewBook((prev) => (prev?.id === book.id ? null : book));
  }

  return (
    <section className="relative rounded-xl border border-line bg-surface-muted p-3">
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

      {showBookPicker && canSelectBook ? (
        <label className="mt-2 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/65">Selected book</span>
          <select
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
            value={selectedBookTitle ?? ""}
            onChange={(event) => onBookChange(event.target.value)}
            disabled={memberBooks.length === 0 || isBookActionLoading}
          >
            <option value="">Pick a challenge book</option>
            {memberBooks.map((book) => (
              <option key={`picker-${book.id}`} value={book.title}>
                {book.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mt-2 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1.5">
          {memberBooks.length === 0 ? (
            <p className="px-1 py-2 text-xs text-foreground/70">No books yet. Add at least 3 to start tracking reading check-ins.</p>
          ) : (
            memberBooks.map((book) => {
              const selected = canSelectBook && selectedBookTitle === book.title;
              return (
                <div
                  key={book.id}
                  ref={setBookCardRef(book.title)}
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
                        <UserReadingBookCoverImage
                          isbn={book.isbn}
                          title={book.title}
                          thumbnailUrl={book.thumbnailUrl}
                          width={120}
                          height={160}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </button>

                    {canSelectBook ? (
                      <button
                        type="button"
                        className="mt-1 w-full text-left"
                        disabled={isBookActionLoading}
                        onClick={() => onBookChange(book.title)}
                      >
                        <p className="line-clamp-2 min-h-8 text-xs font-semibold text-foreground">{book.title}</p>
                        <p className="text-[10px] text-foreground/60">ISBN {book.isbn}</p>
                      </button>
                    ) : (
                      <div className="mt-1">
                        <p className="line-clamp-2 min-h-8 text-xs font-semibold text-foreground">{book.title}</p>
                        <p className="text-[10px] text-foreground/60">ISBN {book.isbn}</p>
                      </div>
                    )}

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
                        ) : (
                          <span />
                        )}
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
            })
          )}
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
                <UserReadingBookCoverImage
                  isbn={previewBook.isbn}
                  title={previewBook.title}
                  thumbnailUrl={previewBook.thumbnailUrl}
                  width={640}
                  height={900}
                  className="h-auto w-full object-contain"
                />
              </div>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
