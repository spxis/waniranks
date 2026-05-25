import Image from "next/image";
import { SUBJECT_TYPE_DISPLAY, SUBJECT_TYPES } from "@/lib/domainConstants";
import { READING_CAMPAIGN, formatCampaignDateLabel } from "@/lib/readingSignoff";

type LeaderboardRow = {
  accountId: string;
  totalYen: number;
  currentStreak: number;
  perfectDays: number;
  nickname: string;
  wkLevel: number;
  learnedKanji: number;
  learnedRadicals: number;
  learnedVocabulary: number;
  currentBookTitle: string;
  currentBookThumbnailUrl: string | null;
  currentBookPage: number | null;
  pagesRemainingForReadingPass: number;
  minutesRemainingForReadingPass: number;
  minutesRemainingForThirtyBonus: number;
  weekCapYen: number;
  todayMaxNormalYen: number;
  todayMinimumNormalYen: number;
  nextDayMaxNormalYenIfPerfectToday: number;
  nextDayMaxNormalYenIfMissToday: number;
  reviewKanjiToday: number;
  reviewVocabularyToday: number;
  reviewRadicalToday: number;
  reviewTotalToday: number;
  zeroReviewsBonusToday: boolean;
};

type MemberSummary = {
  id: string;
  nickname: string;
};

type UserReadingRewardsSummaryProps = {
  daysRemaining: number;
  isLoading: boolean;
  leaderboard: LeaderboardRow[];
  members: MemberSummary[];
  trackedMemberSet: Set<string>;
  showTrackingManager: boolean;
  onToggleTrackedMember: (memberId: string, tracked: boolean) => void;
};

export default function UserReadingRewardsSummary({
  daysRemaining,
  isLoading,
  leaderboard,
  members,
  trackedMemberSet,
  showTrackingManager,
  onToggleTrackedMember,
}: UserReadingRewardsSummaryProps) {
  const teamTotalYen = leaderboard.reduce((sum, row) => sum + row.totalYen, 0);
  const leaderYen = leaderboard[0]?.totalYen ?? 0;
  const leaderRemainingYen = Math.max(0, READING_CAMPAIGN.maxYen - leaderYen);

  function formatYen(value: number): string {
    return `JPY ${value.toLocaleString("en-US")}`;
  }

  function formatCount(value: number): string {
    return value.toLocaleString("en-US");
  }

  return (
    <>
      <section className="rounded-2xl border border-line bg-[linear-gradient(135deg,rgba(15,111,255,0.14),rgba(56,189,248,0.1),rgba(244,114,182,0.12))] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">Japan mission</p>
            <h2 className="mt-1 text-2xl font-black text-foreground sm:text-3xl">40,000 yen challenge</h2>
            <p className="mt-1 text-sm text-foreground/75">
              Start {formatCampaignDateLabel(READING_CAMPAIGN.startDatePst)} to goal {formatCampaignDateLabel(READING_CAMPAIGN.goalDatePst)}.
            </p>
          </div>
          <div className="rounded-xl border border-accent/30 bg-surface/80 px-4 py-3 text-right">
            <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/65">Days to trip</p>
            <p className="text-3xl font-black text-foreground">{daysRemaining}</p>
            <p className="text-xs text-foreground/70">Trip: {formatCampaignDateLabel(READING_CAMPAIGN.tripDatePst)}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface/70 px-3 py-2 text-xs font-semibold text-foreground/75">
            Team earned: <strong className="text-foreground">JPY {teamTotalYen.toLocaleString("en-US")}</strong>
          </div>
          <div className="rounded-xl border border-line bg-surface/70 px-3 py-2 text-xs font-semibold text-foreground/75">
            Leader earned: <strong className="text-foreground">JPY {leaderYen.toLocaleString("en-US")}</strong>
          </div>
          <div className="rounded-xl border border-line bg-surface/70 px-3 py-2 text-xs font-semibold text-foreground/75">
            Leader to 40,000: <strong className="text-foreground">JPY {leaderRemainingYen.toLocaleString("en-US")}</strong>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-black text-foreground">Tracked players</h3>
          <p className="text-xs text-foreground/65">Admins can choose who appears in this challenge leaderboard.</p>
        </div>
        {showTrackingManager ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((member) => {
              const tracked = trackedMemberSet.has(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onToggleTrackedMember(member.id, !tracked)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
                    tracked
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-line bg-surface-muted text-foreground/60"
                  }`}
                >
                  {member.nickname}: {tracked ? "on" : "off"}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-xs text-foreground/60">
            You can view this roster, but only admin accounts can change tracked players.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-black text-foreground">Money leaderboard</h3>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/60">Goal by {formatCampaignDateLabel(READING_CAMPAIGN.goalDatePst)}</p>
        </div>
        <p className="mt-2 text-xs text-foreground/65">
          Fast scan: reading status + kanji reviewed + total yen.
        </p>

        {isLoading && leaderboard.length === 0 ? (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-5 text-sm font-semibold text-foreground/70">
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
            <span>Loading leaderboard...</span>
          </div>
        ) : null}

        {!isLoading && leaderboard.length === 0 ? (
          <div className="mt-3 rounded-lg border border-line bg-surface-muted px-3 py-5 text-center text-sm font-semibold text-foreground/65">
            No tracked players yet. Turn players on above to start the leaderboard.
          </div>
        ) : null}

        {leaderboard.length > 0 ? (
          <ol className="mt-3 space-y-1.5">
            {leaderboard.map((row, index) => (
              <li key={row.accountId} className="rounded-lg border border-line bg-surface-muted/60 px-2.5 py-2">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
                  <div className="col-start-1 row-start-1 min-w-0 flex items-center gap-2">
                    <span className="inline-flex rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-black text-foreground">
                      #{index + 1}
                    </span>
                    <p className="text-sm font-black text-foreground">{row.nickname}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground/65">WK {row.wkLevel}</p>
                    <p className="text-[11px] font-semibold text-foreground/70">Streak {row.currentStreak}d</p>
                  </div>
                  <p className="col-start-2 row-start-1 text-right text-sm font-black text-accent sm:col-start-3 sm:row-span-2">{formatYen(row.totalYen)}</p>

                  <div className="col-span-2 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <div className="overflow-x-auto pb-0.5 sm:overflow-visible sm:pb-0">
                      <div className="flex min-w-max items-center gap-1.5 sm:min-w-0 sm:flex-wrap">
                        <span className="inline-flex items-center rounded-full border border-radical bg-radical px-3 py-1 text-xs font-bold uppercase tracking-widest whitespace-nowrap text-white">
                          {SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.radical].short}
                          <span className="ml-0.5 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">
                            ({formatCount(row.reviewRadicalToday)})
                          </span>
                        </span>
                        <span className="inline-flex items-center rounded-full border border-kanji bg-kanji px-3 py-1 text-xs font-bold uppercase tracking-widest whitespace-nowrap text-white">
                          {SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.kanji].short}
                          <span className="ml-0.5 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">
                            ({formatCount(row.reviewKanjiToday)})
                          </span>
                        </span>
                        <span className="inline-flex items-center rounded-full border border-vocabulary bg-vocabulary px-3 py-1 text-xs font-bold uppercase tracking-widest whitespace-nowrap text-white">
                          {SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.vocabulary].short}
                          <span className="ml-0.5 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">
                            ({formatCount(row.reviewVocabularyToday)})
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-1 flex min-w-0 items-center gap-1.5" title={row.currentBookTitle}>
                      {row.currentBookThumbnailUrl ? (
                        <Image
                          src={row.currentBookThumbnailUrl}
                          alt=""
                          width={14}
                          height={20}
                          className="h-5 w-3.5 shrink-0 rounded border border-line object-cover"
                        />
                      ) : null}
                      <p className="min-w-0 truncate text-xs font-semibold text-foreground/80">
                        {row.currentBookTitle}
                        <span className="ml-0.5 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">
                          (p{row.currentBookPage ?? "-"})
                        </span>
                        <span className="text-foreground/65"> - left {row.pagesRemainingForReadingPass}p / {row.minutesRemainingForReadingPass}m</span>
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </>
  );
}
