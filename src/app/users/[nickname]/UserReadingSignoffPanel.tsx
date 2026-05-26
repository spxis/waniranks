"use client";
import { useEffect, useMemo, useState, type SetStateAction } from "react";
import useSWR from "swr";
import { getStoredJson, setStoredJson } from "@/lib/clientStorage";
import { ACTIVE_READING_CHALLENGE } from "@/lib/readingChallengeRules";
import { getReadingDailyEarningsForecast } from "@/lib/readingEarnings";
import { READING_CAMPAIGN, buildCalendarCells, campaignDaysRemaining, computeReadingLeaderboard, getTodayDateInputValue, type ReadingChallengeBookRecord, type ReadingSignoffEntryRecord, type ReadingSignoffRecord } from "@/lib/readingSignoff";
import UserReadingCampaignHeader from "./UserReadingCampaignHeader";
import UserReadingCalendar from "./UserReadingCalendar";
import UserReadingCheckinModal from "./UserReadingCheckinModal";
import UserReadingRewardsSummary from "./UserReadingRewardsSummary";
import { applyReadingCheckinMode, getRememberedReadingCheckinMode, rememberReadingCheckinMode, type ReadingCheckinMode } from "./UserReadingSignoffPanel.mode";
import { addReadingBookByIsbn, deleteReadingBookById, getRememberedBook, rememberSelectedBook } from "./UserReadingSignoffPanel.books";
import { createFormState, type FormState, type ReadingCampaignOption, type ReadingSignoffResponse, type TodayStats, type UserReadingSignoffPanelProps } from "./UserReadingSignoffPanel.types";
export default function UserReadingSignoffPanel({
  accountId,
  initialMonthKey,
  initialData,
}: UserReadingSignoffPanelProps) {
  const today = getTodayDateInputValue();
  const campaigns = useMemo<ReadingCampaignOption[]>(() => [{
    id: ACTIVE_READING_CHALLENGE.id,
    name: ACTIVE_READING_CHALLENGE.name,
    startDatePst: ACTIVE_READING_CHALLENGE.startDatePst,
    goalDatePst: ACTIVE_READING_CHALLENGE.goalDatePst,
  }], []);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(ACTIVE_READING_CHALLENGE.id);
  const campaignStartMonthKey = READING_CAMPAIGN.startDatePst.slice(0, 7);
  const campaignGoalMonthKey = READING_CAMPAIGN.goalDatePst.slice(0, 7);
  const clampMonthToCampaign = (value: string): string => (value < campaignStartMonthKey ? campaignStartMonthKey : value > campaignGoalMonthKey ? campaignGoalMonthKey : value);
  const resolvedInitialMonthKey = clampMonthToCampaign(initialMonthKey ?? today.slice(0, 7));
  const monthStorageKey = `reading-calendar-month:${accountId}`;
  const [monthKey, setMonthKey] = useState(() => clampMonthToCampaign(getStoredJson<string>(monthStorageKey, resolvedInitialMonthKey)));
  const setBoundedMonthKey = (nextMonth: SetStateAction<string>) =>
    setMonthKey((prevMonth) => clampMonthToCampaign(typeof nextMonth === "function" ? nextMonth(prevMonth) : nextMonth));
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDateKey, setModalDateKey] = useState(today);
  const [form, setForm] = useState<FormState | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(accountId);
  const [addIsbn, setAddIsbn] = useState("");
  const [bookActionMessage, setBookActionMessage] = useState("");
  const [bookActionState, setBookActionState] = useState<"idle" | "adding" | "deleting">("idle");
  const [modalDirty, setModalDirty] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string>("");
  const swrKey = `/api/reading-signoffs?month=${encodeURIComponent(monthKey)}&challengeId=${encodeURIComponent(selectedCampaignId)}`;
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
    {
      fallbackData: monthKey === resolvedInitialMonthKey ? (initialData ?? undefined) : undefined,
      keepPreviousData: true,
      revalidateOnFocus: true,
      revalidateOnMount: !initialData,
    },
  );
  const members = useMemo(() => data?.members ?? [], [data?.members]);
  const viewerCanChooseMember = data?.viewerCanChooseMember ?? false;
  const trackedMemberAccountIds = useMemo(() => data?.trackedMemberAccountIds ?? [], [data?.trackedMemberAccountIds]);
  const signoffs = useMemo(() => data?.signoffs ?? [], [data?.signoffs]);
  const signoffEntries = useMemo(() => data?.signoffEntries ?? [], [data?.signoffEntries]);
  const reviewQueues = useMemo(() => data?.reviewQueues ?? [], [data?.reviewQueues]);
  const challengeBooks = useMemo(() => data?.challengeBooks ?? [], [data?.challengeBooks]);
  const latestSignoffs = useMemo(() => data?.latestSignoffs ?? [], [data?.latestSignoffs]);
  const [viewerTrackedMemberIds, setViewerTrackedMemberIds] = useState<string[] | null>(null);
  const todayMonthKey = today.slice(0, 7);
  const daysRemaining = campaignDaysRemaining(today);
  const trackedStorageKey = `reading-tracked-members:${accountId}`;
  const serverDefaultTrackedMemberIds = useMemo(() => (trackedMemberAccountIds.length === 0 ? members.map((member) => member.id) : trackedMemberAccountIds), [members, trackedMemberAccountIds]);

  useEffect(() => {
    setStoredJson(monthStorageKey, monthKey);
  }, [monthKey, monthStorageKey]);
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

  const trackedMembers = useMemo(() => members.filter((member) => trackedMemberSet.has(member.id)), [members, trackedMemberSet]);
  const latestSignoffByAccountId = useMemo(() => new Map(latestSignoffs.map((row) => [row.accountId, row])), [latestSignoffs]);

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

  const dailyForecastByAccountId = useMemo(
    () =>
      new Map(
        trackedMembers.map((member) => [
          member.id,
          getReadingDailyEarningsForecast({
            accountId: member.id,
            signoffs,
            todayDateKey: today,
          }),
        ]),
      ),
    [signoffs, today, trackedMembers],
  );

  const reviewQueueByAccountId = useMemo(
    () => new Map(reviewQueues.map((row) => [row.accountId, row])),
    [reviewQueues],
  );

  const todayStatsByAccountId = useMemo(() => {
    const map = new Map<string, TodayStats>();

    const byMember = signoffByDayAndMember.get(today) ?? new Map<string, ReadingSignoffRecord>();
    const byMemberEntries = signoffEntriesByDayAndMember.get(today) ?? new Map<string, ReadingSignoffEntryRecord[]>();

    for (const member of trackedMembers) {
      const daySignoff = byMember.get(member.id);
      const entries = byMemberEntries.get(member.id) ?? [];
      const reviewKanji = entries.reduce((sum, entry) => sum + entry.reviewCorrect, 0);
      const reviewVocabulary = entries.reduce((sum, entry) => sum + entry.reviewIncorrect, 0);
      const reviewRadical = entries.reduce((sum, entry) => sum + (entry.reviewSuccessPercent ?? 0), 0);
      const reviewTotal = entries.reduce((sum, entry) => sum + entry.reviewWorkDone, 0);
      const fallbackTotal = daySignoff?.reviewsLeft ?? 0;
      const effectiveTotal = reviewTotal > 0 || entries.length > 0 ? reviewTotal : fallbackTotal;

      map.set(member.id, {
        pagesRead: daySignoff?.pagesRead ?? 0,
        minutesRead: daySignoff?.minutesRead ?? 0,
        reviewKanji,
        reviewVocabulary,
        reviewRadical,
        reviewTotal: effectiveTotal,
        zeroReviewsBonus: Boolean(daySignoff?.didWanikaniReviews && effectiveTotal === 0),
      });
    }

    return map;
  }, [signoffByDayAndMember, signoffEntriesByDayAndMember, today, trackedMembers]);

  const leaderboard = useMemo(() => {
    const rows = computeReadingLeaderboard(trackedMembers, signoffs, today).map((row) => {
      const member = trackedMembers.find((candidate) => candidate.id === row.accountId);
      const latestSignoff = latestSignoffByAccountId.get(row.accountId);
      const forecast = dailyForecastByAccountId.get(row.accountId);
      const currentBookThumbnailUrl = (booksByAccountId.get(row.accountId) ?? []).find((book) => book.title === (latestSignoff?.bookTitle ?? ""))?.thumbnailUrl ?? null;
      return {
        ...row,
        nickname: member?.nickname ?? row.accountId,
        wkLevel: member?.wkLevel ?? 0,
        learnedKanji: member?.learnedKanji ?? 0,
        learnedRadicals: member?.learnedRadicals ?? 0,
        learnedVocabulary: member?.learnedVocabulary ?? 0,
        currentBookTitle: latestSignoff?.bookTitle ?? "-",
        currentBookThumbnailUrl,
        currentBookPage: latestSignoff?.pagesRead ?? null,
        pagesRemainingForReadingPass: Math.max(0, 15 - (todayStatsByAccountId.get(row.accountId)?.pagesRead ?? 0)),
        minutesRemainingForReadingPass: Math.max(0, 15 - (todayStatsByAccountId.get(row.accountId)?.minutesRead ?? 0)),
        minutesRemainingForThirtyBonus: Math.max(0, 31 - (todayStatsByAccountId.get(row.accountId)?.minutesRead ?? 0)),
        weekCapYen: forecast?.weekCapYen ?? 0,
        todayMaxNormalYen: forecast?.todayMaxNormalYen ?? 0,
        todayMinimumNormalYen: forecast?.todayMinimumNormalYen ?? 0,
        nextDayMaxNormalYenIfPerfectToday: forecast?.nextDayMaxNormalYenIfPerfectToday ?? 0,
        nextDayMaxNormalYenIfMissToday: forecast?.nextDayMaxNormalYenIfMissToday ?? 0,
        reviewKanjiToday: todayStatsByAccountId.get(row.accountId)?.reviewKanji ?? 0,
        reviewVocabularyToday: todayStatsByAccountId.get(row.accountId)?.reviewVocabulary ?? 0,
        reviewRadicalToday: todayStatsByAccountId.get(row.accountId)?.reviewRadical ?? 0,
        reviewTotalToday: todayStatsByAccountId.get(row.accountId)?.reviewTotal ?? 0,
        zeroReviewsBonusToday: todayStatsByAccountId.get(row.accountId)?.zeroReviewsBonus ?? false,
      };
    });

    return rows.sort((a, b) => b.totalYen - a.totalYen);
  }, [booksByAccountId, dailyForecastByAccountId, latestSignoffByAccountId, signoffs, today, todayStatsByAccountId, trackedMembers]);

  const calendarCells = useMemo(() => buildCalendarCells(monthKey), [monthKey]);

  function findEntry(memberId: string, dateKey: string): ReadingSignoffRecord | null {
    return signoffByDayAndMember.get(dateKey)?.get(memberId) ?? null;
  }

  function booksForMember(memberId: string): ReadingChallengeBookRecord[] {
    return booksByAccountId.get(memberId) ?? [];
  }

  const modalMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const accountMember = members.find((member) => member.id === accountId) ?? null;
  const selectedReviewQueue = reviewQueueByAccountId.get(selectedMemberId) ?? {
    accountId: selectedMemberId,
    radical: 0,
    kanji: 0,
    vocabulary: 0,
    total: 0,
  };
  const modalDate = form?.signoffDatePst ?? modalDateKey;
  const modalExistingEntry = findEntry(selectedMemberId, modalDate);

  function setModalMember(memberId: string, dateKey: string) {
    const existingEntry = findEntry(memberId, dateKey);
    const memberBooks = booksForMember(memberId);
    const rememberedBook = getRememberedBook(memberId);
    const rememberedMode = getRememberedReadingCheckinMode(memberId);
    const resolvedBookTitle = existingEntry?.bookTitle
      ?? (rememberedBook && memberBooks.some((book) => book.title === rememberedBook)
        ? rememberedBook
        : memberBooks[0]?.title ?? "");
    const baseForm = {
      ...createFormState(dateKey, existingEntry),
      bookTitle: resolvedBookTitle,
    };
    const nextForm = rememberedMode ? applyReadingCheckinMode(baseForm, rememberedMode) : baseForm;

    setSelectedMemberId(memberId);
    setForm(nextForm);
    if (nextForm.bookTitle) {
      rememberSelectedBook(memberId, nextForm.bookTitle);
    }
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
    setModalOpen(false);
    setModalDirty(false);
  }

  function updateForm(mutator: (input: FormState) => FormState) {
    setForm((prev) => (prev ? mutator(prev) : prev));
  }

  async function addBookByIsbn() {
    setBookActionMessage("");

    try {
      setBookActionState("adding");
      const message = await addReadingBookByIsbn({
        accountId: selectedMemberId,
        rawIsbn: addIsbn,
      });
      setBookActionMessage(message);
      setAddIsbn("");
      await mutate();
    } catch (error) {
      setBookActionMessage(error instanceof Error ? error.message : "Could not add that book yet.");
    } finally {
      setBookActionState("idle");
    }
  }

  async function deleteBook(bookId: string) {
    setBookActionMessage("");

    try {
      setBookActionState("deleting");
      const message = await deleteReadingBookById({ accountId: selectedMemberId, bookId });
      setBookActionMessage(message);
      await mutate();
    } catch (error) {
      setBookActionMessage(error instanceof Error ? error.message : "Could not delete that book.");
    } finally {
      setBookActionState("idle");
    }
  }

  async function submitSignoff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }

    const hasReadingActivity = form.pagesRead > 0 || form.minutesRead > 0;
    const hasWaniKaniActivity = form.didWanikaniReviews;
    const isWaniKaniOnlyCheckin = !hasReadingActivity && hasWaniKaniActivity;

    setSubmitState("saving");
    setSubmitMessage("");

    try {
      if (!hasReadingActivity && !hasWaniKaniActivity) {
        throw new Error("Choose reading activity, WaniKani activity, or both before saving.");
      }

      if (hasReadingActivity && booksForMember(selectedMemberId).length < 3) {
        throw new Error("Add at least 3 books before saving check-in.");
      }

      if (hasReadingActivity && !form.bookTitle.trim()) {
        throw new Error("Pick a book from the collection before saving.");
      }

      const fallbackBookTitle = modalExistingEntry?.bookTitle ?? booksForMember(selectedMemberId)[0]?.title ?? "Reviews only";
      const submittedBookTitle = isWaniKaniOnlyCheckin
        ? "WaniKani only"
        : form.bookTitle.trim() || fallbackBookTitle;

      if (!isWaniKaniOnlyCheckin && submittedBookTitle.trim().length > 0) {
        rememberSelectedBook(selectedMemberId, submittedBookTitle);
      }

      const response = await fetch("/api/reading-signoffs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          accountId: selectedMemberId,
          challengeId: selectedCampaignId,
          signoffDatePst: form.signoffDatePst,
          bookTitle: submittedBookTitle,
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

  function updateCheckinMode(mode: ReadingCheckinMode) {
    rememberReadingCheckinMode(selectedMemberId, mode);
    setModalDirty(true);
    updateForm((prev) => applyReadingCheckinMode(prev, mode));
  }

  function updateFormField(mutator: (input: FormState) => FormState) {
    setModalDirty(true);
    updateForm(mutator);
  }
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface-muted p-4 sm:p-6">
      <UserReadingRewardsSummary
        daysRemaining={daysRemaining}
        isLoading={isLoading}
        leaderboard={leaderboard}
        members={members}
        trackedMemberSet={trackedMemberSet}
        showTrackingManager={true}
        onToggleTrackedMember={toggleTrackedMember}
      />

      <UserReadingCampaignHeader
        campaigns={campaigns}
        selectedCampaignId={selectedCampaignId}
        onCampaignChange={setSelectedCampaignId}
      />

      <UserReadingCalendar
        monthKey={monthKey}
        today={today}
        todayMonthKey={todayMonthKey}
        isLoading={isLoading}
        trackedMembers={trackedMembers}
        challengeBooks={challengeBooks}
        calendarCells={calendarCells}
        signoffByDayAndMember={signoffByDayAndMember}
        signoffEntriesByDayAndMember={signoffEntriesByDayAndMember}
        viewerCanChooseMember={viewerCanChooseMember}
        onMonthChange={setBoundedMonthKey}
        onOpenCheckinModal={openCheckinModal}
      />

      <UserReadingCheckinModal
        open={modalOpen}
        form={form}
        members={members}
        selectedMemberId={selectedMemberId}
        selectedMemberName={modalMember?.nickname ?? accountMember?.nickname ?? members[0]?.nickname ?? "Player"}
        viewerCanChooseMember={viewerCanChooseMember}
        allowSignoffDateEdit={viewerCanChooseMember}
        maxSignoffDatePst={today}
        memberBooks={booksForMember(selectedMemberId)}
        addIsbn={addIsbn}
        bookActionMessage={bookActionMessage}
        bookActionState={bookActionState}
        submitState={submitState}
        submitMessage={submitMessage}
        isDirty={modalDirty || addIsbn.trim().length > 0}
        selectedReviewQueue={selectedReviewQueue}
        modalExistingEntry={modalExistingEntry}
        onRequestClose={requestCloseModal}
        onSubmit={submitSignoff}
        onMemberChange={(nextMemberId) => {
          setModalDirty(true);
          setModalMember(nextMemberId, modalDate);
        }}
        onSignoffDateChange={(nextDateKey) => updateFormField((prev) => ({ ...prev, signoffDatePst: nextDateKey }))}
        onAddIsbnChange={(value) => {
          setAddIsbn(value);
          setModalDirty(true);
        }}
        onAddBook={addBookByIsbn}
        onDeleteBook={deleteBook}
        onQuickReading={() => updateCheckinMode("reading")}
        onQuickWaniKani={() => updateCheckinMode("wanikani")}
        onQuickBoth={() => updateCheckinMode("both")}
        onBookChange={(nextBook) => {
          rememberSelectedBook(selectedMemberId, nextBook);
          updateFormField((prev) => ({ ...prev, bookTitle: nextBook }));
        }}
        onPagesChange={(nextPages) => updateFormField((prev) => ({ ...prev, pagesRead: nextPages }))}
        onMinutesChange={(nextMinutes) => updateFormField((prev) => ({ ...prev, minutesRead: nextMinutes }))}
      />
    </section>
  );
}
