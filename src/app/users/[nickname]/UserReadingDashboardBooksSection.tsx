import { useMemo, useState } from "react";

import type { ReadingChallengeBookRecord } from "@/lib/readingSignoff";

import UserReadingBooksEditor from "./UserReadingBooksEditor";
import { getRememberedBook, rememberSelectedBook } from "./UserReadingSignoffPanel.books";
import type { Member } from "./UserReadingSignoffPanel.types";

type UserReadingDashboardBooksSectionProps = {
  viewerCanChooseMember: boolean;
  members: Member[];
  selectedMemberId: string;
  memberBooks: ReadingChallengeBookRecord[];
  addIsbn: string;
  bookActionMessage: string;
  bookActionState: "idle" | "adding" | "deleting";
  onSelectedMemberChange: (nextMemberId: string) => void;
  onAddIsbnChange: (value: string) => void;
  onAddBook: () => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
};

export default function UserReadingDashboardBooksSection({
  viewerCanChooseMember,
  members,
  selectedMemberId,
  memberBooks,
  addIsbn,
  bookActionMessage,
  bookActionState,
  onSelectedMemberChange,
  onAddIsbnChange,
  onAddBook,
  onDeleteBook,
}: UserReadingDashboardBooksSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedBookByMemberId, setSelectedBookByMemberId] = useState<Record<string, string>>({});
  const rememberedSelectedBook = useMemo(() => {
    const remembered = getRememberedBook(selectedMemberId);
    if (remembered && memberBooks.some((book) => book.title === remembered)) {
      return remembered;
    }

    return memberBooks[0]?.title ?? "";
  }, [memberBooks, selectedMemberId]);

  const selectedBookTitle = selectedBookByMemberId[selectedMemberId] ?? rememberedSelectedBook;

  function handleSelectedBookChange(nextBookTitle: string) {
    setSelectedBookByMemberId((previous) => ({
      ...previous,
      [selectedMemberId]: nextBookTitle,
    }));

    if (nextBookTitle.trim().length > 0) {
      rememberSelectedBook(selectedMemberId, nextBookTitle);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-foreground">Books</h3>
          <p className="text-xs text-foreground/70">Add or remove challenge books from this page.</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-line bg-surface-muted px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em]"
          onClick={() => setEditorOpen(true)}
          aria-expanded={editorOpen}
        >
          Edit books
        </button>
      </div>

      <p className="mt-2 text-xs text-foreground/70">Open the editor to add by ISBN or pick from existing titles.</p>

      {editorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 sm:p-6"
          role="dialog"
          aria-label="Edit challenge books"
          onClick={() => setEditorOpen(false)}
        >
          <div
            className="flex max-h-[95dvh] w-full max-w-5xl flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/60">Books editor</p>
                <h3 className="text-xl font-black text-foreground">Manage challenge books</h3>
                <p className="mt-1 text-sm text-foreground/70">Add by ISBN, choose a current title, or remove books.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
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
                  onChange={(event) => onSelectedMemberChange(event.target.value)}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.nickname}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="mt-4">
              <UserReadingBooksEditor
                memberBooks={memberBooks}
                showBookPicker
                selectedBookTitle={selectedBookTitle}
                onBookChange={handleSelectedBookChange}
                addIsbn={addIsbn}
                bookActionMessage={bookActionMessage}
                bookActionState={bookActionState}
                onAddIsbnChange={onAddIsbnChange}
                onAddBook={onAddBook}
                onDeleteBook={onDeleteBook}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
