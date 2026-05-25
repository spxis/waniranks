import {
  READING_CAMPAIGN,
  dayKey,
  formatMonthLabel,
  isCampaignDate,
  shiftMonth,
  type ReadingSignoffEntryRecord,
  type ReadingSignoffRecord,
} from "@/lib/readingSignoff";
import type { Dispatch, SetStateAction } from "react";

import type { Member } from "./UserReadingSignoffPanel.types";

type UserReadingCalendarProps = {
  monthKey: string;
  today: string;
  todayMonthKey: string;
  isLoading: boolean;
  trackedMembers: Member[];
  calendarCells: Array<number | null>;
  signoffByDayAndMember: Map<string, Map<string, ReadingSignoffRecord>>;
  signoffEntriesByDayAndMember: Map<string, Map<string, ReadingSignoffEntryRecord[]>>;
  onMonthChange: Dispatch<SetStateAction<string>>;
  onOpenCheckinModal: (dateKey: string) => void;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function UserReadingCalendar({
  monthKey,
  today,
  todayMonthKey,
  isLoading,
  trackedMembers,
  calendarCells,
  signoffByDayAndMember,
  signoffEntriesByDayAndMember,
  onMonthChange,
  onOpenCheckinModal,
}: UserReadingCalendarProps) {
  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-black text-foreground">Group calendar</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]"
            onClick={() => onMonthChange((prev) => shiftMonth(prev, -1))}
          >
            Prev
          </button>
          <p className="min-w-[9rem] text-center text-sm font-bold text-foreground/80">{formatMonthLabel(monthKey)}</p>
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]"
            onClick={() => onMonthChange((prev) => shiftMonth(prev, 1))}
          >
            Next
          </button>
          <button
            type="button"
            className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em]"
            onClick={() => onMonthChange(todayMonthKey)}
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/60">
        {WEEKDAY_LABELS.map((weekday) => (
          <div key={weekday}>{weekday}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((day, index) => {
          if (!day) {
            return <div key={`blank-${index}`} className="min-h-[7.5rem] rounded-lg border border-dashed border-line/50 bg-surface-muted/60" />;
          }

          const key = dayKey(monthKey, day);
          const byMember = signoffByDayAndMember.get(key) ?? new Map<string, ReadingSignoffRecord>();
          const byMemberEntries = signoffEntriesByDayAndMember.get(key) ?? new Map<string, ReadingSignoffEntryRecord[]>();
          const activeMembers = trackedMembers.filter((member) => byMemberEntries.has(member.id) || byMember.has(member.id));
          const isToday = key === today;
          const isBeforeToday = key < today;
          const isCampaignStart = key === READING_CAMPAIGN.startDatePst;
          const isCampaignGoal = key === READING_CAMPAIGN.goalDatePst;
          const isInsideCampaign = isCampaignDate(key);
          const canCheckIn = isInsideCampaign && !isBeforeToday;

          return (
            <div
              key={key}
              className={`min-h-[7.5rem] rounded-lg border bg-surface p-1 ${
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
                  {activeMembers.map((member) => {
                    const entries = byMemberEntries.get(member.id) ?? [];
                    const totalReviewKanji = entries.reduce((sum, entry) => sum + entry.reviewCorrect, 0);
                    const totalReviewVocabulary = entries.reduce((sum, entry) => sum + entry.reviewIncorrect, 0);
                    const totalReviewRadical = entries.reduce((sum, entry) => sum + (entry.reviewSuccessPercent ?? 0), 0);
                    const totalReviewWork = entries.reduce((sum, entry) => sum + entry.reviewWorkDone, 0);
                    return (
                      <div
                        key={`${key}-${member.id}`}
                        className="rounded border border-emerald-300 bg-emerald-100 px-1 py-1 text-[10px] font-semibold text-emerald-800"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate">{member.nickname}</span>
                          <span>{entries.length} logs</span>
                        </div>
                        {entries.length > 0 ? (
                          <div className="mt-0.5 space-y-0.5 text-[9px] font-semibold text-emerald-900/90">
                            {entries.map((entry) => (
                              <div key={entry.id} className="truncate">
                                +{entry.pagesRead}p {entry.minutesRead}m {entry.didWanikaniReviews ? "WK" : "Read"}
                              </div>
                            ))}
                            {entries.length > 0 ? (
                              <div className="truncate">
                                Reviews K {totalReviewKanji} / V {totalReviewVocabulary} / R {totalReviewRadical}
                                {totalReviewWork === 0 ? " (+0 bonus)" : ""}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {activeMembers.length === 0 ? (
                    <div className="rounded border border-line bg-surface-muted px-1 py-0.5 text-[10px] font-semibold text-foreground/55">
                      No activity
                    </div>
                  ) : null}
                </div>
                {canCheckIn ? (
                  <button
                    type="button"
                    onClick={() => onOpenCheckinModal(key)}
                    className="mt-1 inline-flex w-full items-center justify-center rounded border border-line bg-surface-muted px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition hover:bg-surface"
                  >
                    Check in
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {isLoading ? <p className="text-sm text-foreground/70">Loading calendar...</p> : null}
    </section>
  );
}
