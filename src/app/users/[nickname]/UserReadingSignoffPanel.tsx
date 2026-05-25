"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import {
  getStoredJson,
  setStoredJson,
} from "@/lib/clientStorage";
import {
  buildCalendarCells,
  campaignDaysRemaining,
  computeReadingLeaderboard,
  getTodayDateInputValue,
  normalizeIsbn,
  toMonthKey,
  type ReadingChallengeBookRecord,
  type ReadingSignoffEntryRecord,
  type ReadingSignoffRecord,
} from "@/lib/readingSignoff";
import UserReadingCalendar from "./UserReadingCalendar";
import UserReadingCheckinModal from "./UserReadingCheckinModal";
import UserReadingRewardsSummary from "./UserReadingRewardsSummary";
import {
  createFormState,
  type FormState,
  type ReadingSignoffResponse,
  type UserReadingSignoffPanelProps,
} from "./UserReadingSignoffPanel.types";

export default function UserReadingSignoffPanel({ accountId }: UserReadingSignoffPanelProps) {
  const today = getTodayDateInputValue();
  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDateKey, setModalDateKey] = useState(today);
  const [form, setForm] = useState<FormState | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(accountId);
  const [addIsbn, setAddIsbn] = useState("");
  const [bookActionMessage, setBookActionMessage] = useState("");
  const [modalDirty, setModalDirty] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string>("");

  const swrKey = `/api/reading-signoffs?month=${encodeURIComponent(monthKey)}`;
  const { data, mutate, isLoading } = useSWR<ReadingSignoffResponse>(
    swrKey,
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      const payload = (await response.json()) as ReadingSignoffResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load reading signoffs.");
      }
      return payload;
    },
    { revalidateOnFocus: true },
  );

  const members = useMemo(() => data?.members ?? [], [data?.members]);
  const viewerCanChooseMember = data?.viewerCanChooseMember ?? false;
  const trackedMemberAccountIds = useMemo(() => data?.trackedMemberAccountIds ?? [], [data?.trackedMemberAccountIds]);
  const signoffs = useMemo(() => data?.signoffs ?? [], [data?.signoffs]);
  const signoffEntries = useMemo(() => data?.signoffEntries ?? [], [data?.signoffEntries]);
  const challengeBooks = useMemo(() => data?.challengeBooks ?? [], [data?.challengeBooks]);
  const latestSignoffs = useMemo(() => data?.latestSignoffs ?? [], [data?.latestSignoffs]);
  const [viewerTrackedMemberIds, setViewerTrackedMemberIds] = useState<string[] | null>(null);
  const todayMonthKey = today.slice(0, 7);
  const daysRemaining = campaignDaysRemaining(today);

  const trackedStorageKey = `reading-tracked-members:${accountId}`;
  const serverDefaultTrackedMemberIds = useMemo(
    () => (trackedMemberAccountIds.length === 0 ? members.map((member) => member.id) : trackedMemberAccountIds),
    [members, trackedMemberAccountIds],
  );

  useEffect(() => {
    if (members.length === 0) {
      return;
    }

    setViewerTrackedMemberIds((prev) => {
      const validMemberIds = new Set(members.map((member) => member.id));
      if (prev === null) {
        const stored = getStoredJson<string[]>(trackedStorageKey, serverDefaultTrackedMemberIds);
        return stored.filter((id) => validMemberIds.has(id));
      }

      return prev.filter((id) => validMemberIds.has(id));
    });
  }, [members, serverDefaultTrackedMemberIds, trackedStorageKey]);

  useEffect(() => {
    if (viewerTrackedMemberIds === null) {
      return;
    }

    setStoredJson(trackedStorageKey, viewerTrackedMemberIds);
  }, [trackedStorageKey, viewerTrackedMemberIds]);

  const trackedMemberSet = useMemo(() => {
    if (!viewerTrackedMemberIds) {
      return new Set(serverDefaultTrackedMemberIds);
    }

    return new Set(viewerTrackedMemberIds);
  }, [serverDefaultTrackedMemberIds, viewerTrackedMemberIds]);

  const trackedMembers = useMemo(
    () => members.filter((member) => trackedMemberSet.has(member.id)),
    [members, trackedMemberSet],
  );

  const latestSignoffByAccountId = useMemo(
    () => new Map(latestSignoffs.map((row) => [row.accountId, row])),
    [latestSignoffs],
  );

  const booksByAccountId = useMemo(() => {
    const map = new Map<string, ReadingChallengeBookRecord[]>();
    for (const book of challengeBooks) {
      const list = map.get(book.accountId) ?? [];
      list.push(book);
      map.set(book.accountId, list);
    }
    return map;
  }, [challengeBooks]);

  function toggleTrackedMember(memberId: string, tracked: boolean) {
    setViewerTrackedMemberIds((prev) => {
      const current = new Set(prev ?? serverDefaultTrackedMemberIds);
      if (tracked) {
        current.add(memberId);
      } else {
        current.delete(memberId);
      }

      return Array.from(current);
    });
  }

  const signoffByDayAndMember = useMemo(() => {
    const byDayAndMember = new Map<string, Map<string, ReadingSignoffRecord>>();
    for (const signoff of signoffs) {
      const dayMap = byDayAndMember.get(signoff.signoffDatePst) ?? new Map<string, ReadingSignoffRecord>();
      dayMap.set(signoff.accountId, signoff);
      byDayAndMember.set(signoff.signoffDatePst, dayMap);
    }
    return byDayAndMember;
  }, [signoffs]);

  const signoffEntriesByDayAndMember = useMemo(() => {
    const byDayAndMember = new Map<string, Map<string, ReadingSignoffEntryRecord[]>>();
    for (const entry of signoffEntries) {
      const dayMap = byDayAndMember.get(entry.signoffDatePst) ?? new Map<string, ReadingSignoffEntryRecord[]>();
      const list = dayMap.get(entry.accountId) ?? [];
      list.push(entry);
      dayMap.set(entry.accountId, list);
      byDayAndMember.set(entry.signoffDatePst, dayMap);
    }

    return byDayAndMember;
  }, [signoffEntries]);

  const todayStatsByAccountId = useMemo(() => {
    const map = new Map<string, {
      pagesRead: number;
      minutesRead: number;
      reviewCorrect: number;
      reviewIncorrect: number;
      reviewSuccessPercent: number | null;
    }>();

    const byMember = signoffByDayAndMember.get(today) ?? new Map<string, ReadingSignoffRecord>();
    const byMemberEntries = signoffEntriesByDayAndMember.get(today) ?? new Map<string, ReadingSignoffEntryRecord[]>();

    for (const member of trackedMembers) {
      const daySignoff = byMember.get(member.id);
      const entries = byMemberEntries.get(member.id) ?? [];
      const reviewCorrect = entries.reduce((sum, entry) => sum + entry.reviewCorrect, 0);
      const reviewIncorrect = entries.reduce((sum, entry) => sum + entry.reviewIncorrect, 0);
      const reviewWork = reviewCorrect + reviewIncorrect;

      map.set(member.id, {
        pagesRead: daySignoff?.pagesRead ?? 0,
        minutesRead: daySignoff?.minutesRead ?? 0,
        reviewCorrect,
        reviewIncorrect,
        reviewSuccessPercent: reviewWork > 0 ? Math.round((reviewCorrect / reviewWork) * 100) : null,
      });
    }

    return map;
  }, [signoffByDayAndMember, signoffEntriesByDayAndMember, today, trackedMembers]);

  const leaderboard = useMemo(() => {
    const rows = computeReadingLeaderboard(trackedMembers, signoffs).map((row) => {
      const member = trackedMembers.find((candidate) => candidate.id === row.accountId);
      const latestSignoff = latestSignoffByAccountId.get(row.accountId);
      return {
        ...row,
        nickname: member?.nickname ?? row.accountId,
        wkLevel: member?.wkLevel ?? 0,
        learnedKanji: member?.learnedKanji ?? 0,
        learnedRadicals: member?.learnedRadicals ?? 0,
        learnedVocabulary: member?.learnedVocabulary ?? 0,
        currentBookTitle: latestSignoff?.bookTitle ?? "-",
        currentBookPage: latestSignoff?.pagesRead ?? null,
        pagesRemainingForReadingPass: Math.max(0, 15 - (todayStatsByAccountId.get(row.accountId)?.pagesRead ?? 0)),
        minutesRemainingForReadingPass: Math.max(0, 15 - (todayStatsByAccountId.get(row.accountId)?.minutesRead ?? 0)),
        reviewCorrectToday: todayStatsByAccountId.get(row.accountId)?.reviewCorrect ?? 0,
        reviewIncorrectToday: todayStatsByAccountId.get(row.accountId)?.reviewIncorrect ?? 0,
        reviewSuccessPercentToday: todayStatsByAccountId.get(row.accountId)?.reviewSuccessPercent ?? null,
      };
    });

    return rows.sort((a, b) => b.totalYen - a.totalYen);
  }, [latestSignoffByAccountId, signoffs, todayStatsByAccountId, trackedMembers]);

  const calendarCells = useMemo(() => buildCalendarCells(monthKey), [monthKey]);

  function findEntry(memberId: string, dateKey: string): ReadingSignoffRecord | null {
    return signoffByDayAndMember.get(dateKey)?.get(memberId) ?? null;
  }

  function booksForMember(memberId: string): ReadingChallengeBookRecord[] {
    return booksByAccountId.get(memberId) ?? [];
  }

  const modalMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const accountMember = members.find((member) => member.id === accountId) ?? null;
  const modalDate = form?.signoffDatePst ?? modalDateKey;
  const modalExistingEntry = findEntry(selectedMemberId, modalDate);

  function setModalMember(memberId: string, dateKey: string) {
    const memberBooks = booksForMember(memberId);
    const existingEntry = findEntry(memberId, dateKey);
    setSelectedMemberId(memberId);
    setForm({
      ...createFormState(dateKey, existingEntry),
      bookTitle: existingEntry?.bookTitle ?? memberBooks[0]?.title ?? "",
    });
    setBookActionMessage("");
  }

  function openCheckinModal(dateKey: string) {
    const defaultMemberId = members.some((member) => member.id === accountId)
      ? accountId
      : members[0]?.id ?? accountId;
    setModalDateKey(dateKey);
    setModalMember(defaultMemberId, dateKey);
    setSubmitState("idle");
    setSubmitMessage("");
    setAddIsbn("");
    setModalDirty(false);
    setModalOpen(true);
  }

  function requestCloseModal() {
    if (!modalDirty) {
      setModalOpen(false);
      return;
    }

    const shouldClose = window.confirm("Discard your unsaved check-in changes?");
    if (shouldClose) {
      setModalOpen(false);
      setModalDirty(false);
    }
  }

  function updateForm(mutator: (input: FormState) => FormState) {
    setForm((prev) => (prev ? mutator(prev) : prev));
  }

  async function addBookByIsbn() {
    setBookActionMessage("");
    const normalizedIsbn = normalizeIsbn(addIsbn);
    if (!normalizedIsbn) {
      setBookActionMessage("Enter a valid ISBN-10 or ISBN-13.");
      return;
    }

    try {
      const response = await fetch("/api/reading-books", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: selectedMemberId,
          isbn: normalizedIsbn,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not add that book yet.");
      }

      setBookActionMessage("Book added.");
      setAddIsbn("");
      await mutate();
    } catch (error) {
      setBookActionMessage(error instanceof Error ? error.message : "Could not add that book yet.");
    }
  }

  async function deleteBook(bookId: string) {
    setBookActionMessage("");

    try {
      const response = await fetch("/api/reading-books", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: selectedMemberId,
          bookId,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not delete that book.");
      }

      setBookActionMessage("Book removed.");
      await mutate();
    } catch (error) {
      setBookActionMessage(error instanceof Error ? error.message : "Could not delete that book.");
    }
  }

  async function submitSignoff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }

    setSubmitState("saving");
    setSubmitMessage("");

    try {
      if (booksForMember(selectedMemberId).length < 3) {
        throw new Error("Add at least 3 books before saving check-in.");
      }

      if (!form.bookTitle.trim()) {
        throw new Error("Pick a book from the collection before saving.");
      }

      const response = await fetch("/api/reading-signoffs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          accountId: selectedMemberId,
          signoffDatePst: form.signoffDatePst,
          bookTitle: form.bookTitle.trim(),
          pagesRead: form.pagesRead,
          minutesRead: form.minutesRead,
          didWanikaniReviews: form.didWanikaniReviews,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save reading signoff.");
      }

      setMonthKey(form.signoffDatePst.slice(0, 7));
      setSubmitState("saved");
      setSubmitMessage("Check-in saved.");
      setModalDirty(false);
      await mutate();
      window.setTimeout(() => {
        setModalOpen(false);
      }, 250);
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(error instanceof Error ? error.message : "Could not save reading signoff.");
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface-muted p-4 sm:p-6">
      <UserReadingRewardsSummary
        daysRemaining={daysRemaining}
        leaderboard={leaderboard}
        members={members}
        trackedMemberSet={trackedMemberSet}
        showTrackingManager={true}
        onToggleTrackedMember={toggleTrackedMember}
      />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-foreground">Read check-ins</h2>
          <p className="mt-1 text-sm text-foreground/75">
            Use one daily check-in button to update reading and WaniKani progress.
          </p>
          <p className="mt-1 text-xs text-foreground/60">
            Every player needs 3 challenge books saved in the modal.
          </p>
        </div>
      </header>

      <UserReadingCalendar
        monthKey={monthKey}
        today={today}
        todayMonthKey={todayMonthKey}
        isLoading={isLoading}
        trackedMembers={trackedMembers}
        calendarCells={calendarCells}
        signoffByDayAndMember={signoffByDayAndMember}
        signoffEntriesByDayAndMember={signoffEntriesByDayAndMember}
        onMonthChange={setMonthKey}
        onOpenCheckinModal={openCheckinModal}
      />

      <section className="rounded-xl border border-line bg-surface p-3">
        <h3 className="text-base font-black text-foreground">How to use</h3>
        <p className="mt-2 text-sm text-foreground/75">
          Use the day button to open one check-in modal. If you are an admin, you can pick any user there. Everyone must set 3 challenge books.
        </p>
      </section>

      <UserReadingCheckinModal
        open={modalOpen}
        form={form}
        members={members}
        selectedMemberId={selectedMemberId}
        selectedMemberName={modalMember?.nickname ?? accountMember?.nickname ?? members[0]?.nickname ?? "Player"}
        viewerCanChooseMember={viewerCanChooseMember}
        memberBooks={booksForMember(selectedMemberId)}
        addIsbn={addIsbn}
        bookActionMessage={bookActionMessage}
        submitState={submitState}
        submitMessage={submitMessage}
        isDirty={modalDirty || addIsbn.trim().length > 0}
        modalExistingEntry={modalExistingEntry}
        onRequestClose={requestCloseModal}
        onSubmit={submitSignoff}
        onMemberChange={(nextMemberId) => {
          setModalDirty(true);
          setModalMember(nextMemberId, modalDate);
        }}
        onAddIsbnChange={(value) => {
          setAddIsbn(value);
          setModalDirty(true);
        }}
        onAddBook={addBookByIsbn}
        onDeleteBook={deleteBook}
        onQuickReading={() => {
          setModalDirty(true);
          updateForm((prev) => ({ ...prev, pagesRead: Math.max(1, prev.pagesRead), minutesRead: Math.max(10, prev.minutesRead) }));
        }}
        onQuickWaniKani={() => {
          setModalDirty(true);
          updateForm((prev) => ({ ...prev, didWanikaniReviews: true }));
        }}
        onDateChange={(nextDate) => {
          setModalDirty(true);
          updateForm((prev) => ({ ...prev, signoffDatePst: nextDate }));
        }}
        onBookChange={(nextBook) => {
          setModalDirty(true);
          updateForm((prev) => ({ ...prev, bookTitle: nextBook }));
        }}
        onPagesChange={(nextPages) => {
          setModalDirty(true);
          updateForm((prev) => ({ ...prev, pagesRead: nextPages }));
        }}
        onMinutesChange={(nextMinutes) => {
          setModalDirty(true);
          updateForm((prev) => ({ ...prev, minutesRead: nextMinutes }));
        }}
        onDidReviewsChange={(nextDidReviews) => {
          setModalDirty(true);
          updateForm((prev) => ({ ...prev, didWanikaniReviews: nextDidReviews }));
        }}
      />
    </section>
  );
}
