import { useState } from "react";

import type { ReadingChallengeBookRecord } from "@/lib/readingSignoff";

import UserReadingBooksEditor from "./UserReadingBooksEditor";
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
  const [showEditor, setShowEditor] = useState(false);

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
          onClick={() => setShowEditor((previous) => !previous)}
          aria-expanded={showEditor}
        >
          {showEditor ? "Hide editor" : "Edit books"}
        </button>
      </div>

      {showEditor ? (
        <div className="mt-3 space-y-3">
          {viewerCanChooseMember ? (
            <label className="flex flex-col gap-1">
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

          <UserReadingBooksEditor
            memberBooks={memberBooks}
            addIsbn={addIsbn}
            bookActionMessage={bookActionMessage}
            bookActionState={bookActionState}
            onAddIsbnChange={onAddIsbnChange}
            onAddBook={onAddBook}
            onDeleteBook={onDeleteBook}
          />
        </div>
      ) : null}
    </section>
  );
}
