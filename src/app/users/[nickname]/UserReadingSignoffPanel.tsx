"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import {
  READING_CAMPAIGN,
  buildCalendarCells,
  campaignDaysRemaining,
  computeReadingLeaderboard,
  dayKey,
  formatMonthLabel,
  getTodayDateInputValue,
  initials,
  isCampaignDate,
  normalizeIsbn,
  shiftMonth,
  toMonthKey,
  type ReadingChallengeBookRecord,
  type ReadingSignoffRecord,
} from "@/lib/readingSignoff";
import UserReadingCheckinModal from "./UserReadingCheckinModal";
import UserReadingRewardsSummary from "./UserReadingRewardsSummary";

type Member = {
  id: string;
  nickname: string;
  wkUsername: string;
};

type ReadingSignoffResponse = {
  members: Member[];
  viewerCanChooseMember: boolean;
  challengeBooks: ReadingChallengeBookRecord[];
  signoffs: ReadingSignoffRecord[];
};

type UserReadingSignoffPanelProps = {
  accountId: string;
};

type FormState = {
  signoffDatePst: string;
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
};

function createFormState(dateKey: string, entry: ReadingSignoffRecord | null): FormState {
  return {
    signoffDatePst: dateKey,
    bookTitle: entry?.bookTitle ?? "",
    pagesRead: entry?.pagesRead ?? 10,
    minutesRead: entry?.minutesRead ?? 20,
    didWanikaniReviews: entry?.didWanikaniReviews ?? false,
  };
}

export default function UserReadingSignoffPanel({ accountId }: UserReadingSignoffPanelProps) {
  const today = getTodayDateInputValue();
  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDateKey, setModalDateKey] = useState(today);
  const [form, setForm] = useState<FormState | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(accountId);
  const [addIsbn, setAddIsbn] = useState("");
  const [bookActionMessage, setBookActionMessage] = useState("");
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
  const signoffs = useMemo(() => data?.signoffs ?? [], [data?.signoffs]);
  const challengeBooks = useMemo(() => data?.challengeBooks ?? [], [data?.challengeBooks]);
  const todayMonthKey = today.slice(0, 7);
  const daysRemaining = campaignDaysRemaining(today);

  const booksByAccountId = useMemo(() => {
    const map = new Map<string, ReadingChallengeBookRecord[]>();
    for (const book of challengeBooks) {
      const list = map.get(book.accountId) ?? [];
      list.push(book);
      map.set(book.accountId, list);
    }
    return map;
  }, [challengeBooks]);

  const leaderboard = useMemo(() => {
    const rows = computeReadingLeaderboard(members, signoffs).map((row) => {
      const member = members.find((candidate) => candidate.id === row.accountId);
      return {
        ...row,
        nickname: member?.nickname ?? row.accountId,
      };
    });

    return rows.sort((a, b) => b.totalYen - a.totalYen);
  }, [members, signoffs]);

  const signoffByDayAndMember = useMemo(() => {
    const byDayAndMember = new Map<string, Map<string, ReadingSignoffRecord>>();
    for (const signoff of signoffs) {
      const dayMap = byDayAndMember.get(signoff.signoffDatePst) ?? new Map<string, ReadingSignoffRecord>();
      dayMap.set(signoff.accountId, signoff);
      byDayAndMember.set(signoff.signoffDatePst, dayMap);
    }
    return byDayAndMember;
  }, [signoffs]);

  const calendarCells = useMemo(() => buildCalendarCells(monthKey), [monthKey]);

  function findEntry(memberId: string, dateKey: string): ReadingSignoffRecord | null {
    return signoffByDayAndMember.get(dateKey)?.get(memberId) ?? null;
  }

  function booksForMember(memberId: string): ReadingChallengeBookRecord[] {
    return booksByAccountId.get(memberId) ?? [];
  }

  const modalMember = members.find((member) => member.id === selectedMemberId) ?? null;
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
    setModalDateKey(dateKey);
    setModalMember(accountId, dateKey);
    setSubmitState("idle");
    setSubmitMessage("");
    setAddIsbn("");
    setModalOpen(true);
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
          bookTitle: form.bookTitle,
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
      <UserReadingRewardsSummary daysRemaining={daysRemaining} leaderboard={leaderboard} />

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

      <section className="space-y-3 rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-black text-foreground">Group calendar</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]"
              onClick={() => setMonthKey((prev) => shiftMonth(prev, -1))}
            >
              Prev
            </button>
            <p className="min-w-[9rem] text-center text-sm font-bold text-foreground/80">{formatMonthLabel(monthKey)}</p>
            <button
              type="button"
              className="rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]"
              onClick={() => setMonthKey((prev) => shiftMonth(prev, 1))}
            >
              Next
            </button>
            <button
              type="button"
              className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]"
              onClick={() => setMonthKey(todayMonthKey)}
            >
              Today
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/60">
          {[
            "Sun",
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat",
          ].map((weekday) => (
            <div key={weekday}>{weekday}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((day, index) => {
            if (!day) {
              return <div key={`blank-${index}`} className="min-h-[6rem] rounded-lg border border-dashed border-line/50 bg-surface-muted/60" />;
            }

            const key = dayKey(monthKey, day);
            const byMember = signoffByDayAndMember.get(key) ?? new Map<string, ReadingSignoffRecord>();
            const isToday = key === today;
            const isCampaignStart = key === READING_CAMPAIGN.startDatePst;
            const isCampaignGoal = key === READING_CAMPAIGN.goalDatePst;
            const isInsideCampaign = isCampaignDate(key);

            return (
              <div
                key={key}
                className={`min-h-[6rem] rounded-lg border bg-surface p-1 ${
                  isToday
                    ? "border-accent shadow-[inset_0_0_0_1px_rgba(15,111,255,0.35)]"
                    : isCampaignGoal
                      ? "border-emerald-500 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.4)]"
                      : isCampaignStart
                        ? "border-fuchsia-500 shadow-[inset_0_0_0_1px_rgba(217,70,239,0.3)]"
                        : "border-line"
                }`}
              >
                <p className="flex items-center justify-between text-xs font-black text-foreground">
                  <span>{day}</span>
                  <span className="flex items-center gap-1">
                    {isCampaignStart ? (
                      <span className="rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-fuchsia-700">Start</span>
                    ) : null}
                    {isCampaignGoal ? (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-emerald-700">Goal</span>
                    ) : null}
                    {isToday ? (
                      <span className="rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-accent">Today</span>
                    ) : null}
                  </span>
                </p>
                <div className="mt-1 space-y-1">
                  <div className="space-y-1">
                    {members.map((member) => {
                      const entry = byMember.get(member.id);
                      const hasReading = Boolean(entry && entry.pagesRead > 0 && entry.minutesRead > 0);
                      const waniDone = Boolean(entry?.didWanikaniReviews);
                      const statusClass = entry
                        ? hasReading && waniDone
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-amber-100 text-amber-900 border-amber-300"
                        : "bg-surface-muted text-foreground/55 border-line";
                      return (
                        <div
                          key={`${key}-${member.id}`}
                          className={`flex w-full items-center justify-between rounded border px-1 py-0.5 text-[10px] font-semibold ${statusClass}`}
                        >
                          <span>{initials(member.nickname)}</span>
                          <span>
                            {hasReading ? "R" : "-"}/{waniDone ? "W" : "-"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => openCheckinModal(key)}
                    className="mt-1 inline-flex w-full items-center justify-center rounded border border-line bg-surface-muted px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition hover:bg-surface"
                    disabled={!isInsideCampaign}
                  >
                    Check in
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {isLoading ? <p className="text-sm text-foreground/70">Loading calendar...</p> : null}
      </section>

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
        selectedMemberName={modalMember?.nickname ?? "Kid"}
        viewerCanChooseMember={viewerCanChooseMember}
        memberBooks={booksForMember(selectedMemberId)}
        addIsbn={addIsbn}
        bookActionMessage={bookActionMessage}
        submitState={submitState}
        submitMessage={submitMessage}
        modalExistingEntry={modalExistingEntry}
        onClose={() => setModalOpen(false)}
        onSubmit={submitSignoff}
        onMemberChange={(nextMemberId) => setModalMember(nextMemberId, modalDate)}
        onAddIsbnChange={setAddIsbn}
        onAddBook={addBookByIsbn}
        onDeleteBook={deleteBook}
        onQuickReading={() => updateForm((prev) => ({ ...prev, pagesRead: Math.max(1, prev.pagesRead), minutesRead: Math.max(10, prev.minutesRead) }))}
        onQuickWaniKani={() => updateForm((prev) => ({ ...prev, didWanikaniReviews: true }))}
        onDateChange={(nextDate) => updateForm((prev) => ({ ...prev, signoffDatePst: nextDate }))}
        onBookChange={(nextBook) => updateForm((prev) => ({ ...prev, bookTitle: nextBook }))}
        onPagesChange={(nextPages) => updateForm((prev) => ({ ...prev, pagesRead: nextPages }))}
        onMinutesChange={(nextMinutes) => updateForm((prev) => ({ ...prev, minutesRead: nextMinutes }))}
        onDidReviewsChange={(nextDidReviews) => updateForm((prev) => ({ ...prev, didWanikaniReviews: nextDidReviews }))}
      />
    </section>
  );
}
