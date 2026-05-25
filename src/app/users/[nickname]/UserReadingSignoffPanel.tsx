"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import {
  READING_CAMPAIGN,
  READING_BOOK_OPTIONS,
  buildCalendarCells,
  campaignDaysRemaining,
  computeReadingLeaderboard,
  dayKey,
  formatMonthLabel,
  getTodayDateInputValue,
  initials,
  isCampaignDate,
  shiftMonth,
  toMonthKey,
  type ReadingSignoffRecord,
} from "@/lib/readingSignoff";
import UserReadingRewardsSummary from "./UserReadingRewardsSummary";

type Member = {
  id: string;
  nickname: string;
  wkUsername: string;
};

type ReadingSignoffResponse = {
  members: Member[];
  signoffs: ReadingSignoffRecord[];
};

type UserReadingSignoffPanelProps = {
  accountId: string;
};

type FormState = {
  signoffDatePst: string;
  bookTitle: (typeof READING_BOOK_OPTIONS)[number];
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
};

export default function UserReadingSignoffPanel({ accountId }: UserReadingSignoffPanelProps) {
  const today = getTodayDateInputValue();
  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [modalMemberId, setModalMemberId] = useState<string>(accountId);
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
  const signoffs = useMemo(() => data?.signoffs ?? [], [data?.signoffs]);
  const todayMonthKey = today.slice(0, 7);
  const daysRemaining = campaignDaysRemaining(today);

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

  const modalMember = members.find((member) => member.id === modalMemberId) ?? null;
  const modalDate = form?.signoffDatePst ?? today;
  const modalExistingEntry = signoffByDayAndMember.get(modalDate)?.get(modalMemberId) ?? null;

  function openCheckinModal(input: {
    memberId: string;
    signoffDatePst: string;
    entry: ReadingSignoffRecord | undefined;
  }) {
    const entry = input.entry;
    setModalMemberId(input.memberId);
    setForm({
      signoffDatePst: input.signoffDatePst,
      bookTitle: (entry?.bookTitle as (typeof READING_BOOK_OPTIONS)[number]) ?? READING_BOOK_OPTIONS[0],
      pagesRead: entry?.pagesRead ?? 10,
      minutesRead: entry?.minutesRead ?? 20,
      didWanikaniReviews: entry?.didWanikaniReviews ?? false,
    });
    setSubmitState("idle");
    setSubmitMessage("");
    setModalOpen(true);
  }

  async function submitSignoff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }

    setSubmitState("saving");
    setSubmitMessage("");

    try {
      const response = await fetch("/api/reading-signoffs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          accountId: modalMemberId,
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
            Click a kid on any day to open the check-in modal and mark nightly activities.
          </p>
          <p className="mt-1 text-xs text-foreground/60">
            You can edit both today and previous dates.
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
                      <button
                        key={`${key}-${member.id}`}
                        type="button"
                        onClick={() => openCheckinModal({ memberId: member.id, signoffDatePst: key, entry })}
                        className={`flex w-full items-center justify-between rounded border px-1 py-0.5 text-[10px] font-semibold transition hover:brightness-95 ${statusClass}`}
                        disabled={!isInsideCampaign}
                      >
                        <span>{initials(member.nickname)}</span>
                        <span>
                          {hasReading ? "R" : "-"}/{waniDone ? "W" : "-"}
                        </span>
                      </button>
                    );
                  })}
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
          In each day cell, tap a kid badge to open their check-in modal. The badge shows activity status as R/W, and today is highlighted.
        </p>
      </section>

      {modalOpen && form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6">
          <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-4 shadow-2xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/60">Nightly check-in</p>
                <h3 className="text-xl font-black text-foreground">
                  {modalMember?.nickname ?? "Kid"} on {form.signoffDatePst}
                </h3>
                <p className="mt-1 text-sm text-foreground/70">
                  Tap activity buttons, answer details, then save.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-xl border border-line bg-surface-muted px-3 py-2 text-left"
                onClick={() => {
                  setForm((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      pagesRead: Math.max(1, prev.pagesRead),
                      minutesRead: Math.max(10, prev.minutesRead),
                    };
                  });
                }}
              >
                <p className="text-sm font-black text-foreground">Reading check-in</p>
                <p className="text-xs text-foreground/70">Marks reading with current pages/minutes values.</p>
              </button>
              <button
                type="button"
                className="rounded-xl border border-line bg-surface-muted px-3 py-2 text-left"
                onClick={() => {
                  setForm((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      didWanikaniReviews: true,
                    };
                  });
                }}
              >
                <p className="text-sm font-black text-foreground">WaniKani reviews to 0</p>
                <p className="text-xs text-foreground/70">Checks off WaniKani completion for the night.</p>
              </button>
            </div>

            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submitSignoff}>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Date</span>
                <input
                  type="date"
                  className="h-10 rounded-lg border border-line bg-surface-muted px-3 text-sm"
                  value={form.signoffDatePst}
                  onChange={(event) => {
                    const next = event.target.value;
                    setForm((prev) => {
                      if (!prev) return prev;
                      return { ...prev, signoffDatePst: next };
                    });
                  }}
                  required
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Book</span>
                <select
                  className="h-10 rounded-lg border border-line bg-surface-muted px-3 text-sm"
                  value={form.bookTitle}
                  onChange={(event) => {
                    setForm((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        bookTitle: event.target.value as (typeof READING_BOOK_OPTIONS)[number],
                      };
                    });
                  }}
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
                  onChange={(event) => {
                    setForm((prev) => {
                      if (!prev) return prev;
                      return { ...prev, pagesRead: Number(event.target.value) };
                    });
                  }}
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
                  onChange={(event) => {
                    setForm((prev) => {
                      if (!prev) return prev;
                      return { ...prev, minutesRead: Number(event.target.value) };
                    });
                  }}
                  required
                />
              </label>

              <label className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.didWanikaniReviews}
                  onChange={(event) => {
                    setForm((prev) => {
                      if (!prev) return prev;
                      return { ...prev, didWanikaniReviews: event.target.checked };
                    });
                  }}
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
      ) : null}
    </section>
  );
}
