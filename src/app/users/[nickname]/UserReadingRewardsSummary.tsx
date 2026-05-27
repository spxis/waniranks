import { SUBJECT_TYPE_DISPLAY, SUBJECT_TYPES } from "@/lib/domainConstants";
import { formatCampaignDateLabel } from "@/lib/readingSignoff";
import UserReadingBookCoverImage from "./UserReadingBookCoverImage";

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
  currentBookIsbn: string | null;
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

type UserReadingRewardsSummaryProps = {
  campaignName: string;
  campaignStartDatePst: string;
  campaignGoalDatePst: string;
  campaignTripDatePst: string;
  campaignTargetBaseYen: number;
  daysRemaining: number;
  isLoading: boolean;
  leaderboard: LeaderboardRow[];
};

export default function UserReadingRewardsSummary({
  campaignName,
  campaignStartDatePst,
  campaignGoalDatePst,
  campaignTripDatePst,
  campaignTargetBaseYen,
  daysRemaining,
  isLoading,
  leaderboard,
}: UserReadingRewardsSummaryProps) {
  const teamTotalYen = leaderboard.reduce((sum, row) => sum + row.totalYen, 0);
  const leaderYen = leaderboard[0]?.totalYen ?? 0;
  const leaderRemainingYen = Math.max(0, campaignTargetBaseYen - leaderYen);

  function formatYen(value: number): string {
    return `JPY ${value.toLocaleString("en-US")}`;
  }

  function formatCount(value: number): string {
    return value.toLocaleString("en-US");
  }

  function hasTodayCheckin(row: LeaderboardRow): boolean {
    return row.pagesRemainingForReadingPass < 15
      || row.minutesRemainingForReadingPass < 15
      || row.reviewTotalToday > 0
      || row.zeroReviewsBonusToday;
  }

  return (
    <>
      <section className="rounded-2xl border border-line bg-[linear-gradient(135deg,rgba(15,111,255,0.14),rgba(56,189,248,0.1),rgba(244,114,182,0.12))] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">Japan mission</p>
            <h2 className="mt-1 text-2xl font-black text-foreground sm:text-3xl">
              {campaignTargetBaseYen.toLocaleString("en-US")} yen challenge
            </h2>
            <p className="mt-1 text-sm text-foreground/75">
              {campaignName}: start {formatCampaignDateLabel(campaignStartDatePst)} to goal {formatCampaignDateLabel(campaignGoalDatePst)}.
            </p>
          </div>
          <div className="rounded-xl border border-accent/30 bg-surface/80 px-4 py-3 text-right">
            <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/65">Days to trip</p>
            <p className="text-3xl font-black text-foreground">{daysRemaining}</p>
            <p className="text-xs text-foreground/70">Trip: {formatCampaignDateLabel(campaignTripDatePst)}</p>
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
            Leader to {campaignTargetBaseYen.toLocaleString("en-US")}: <strong className="text-foreground">JPY {leaderRemainingYen.toLocaleString("en-US")}</strong>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-black text-foreground">Rewards leaderboard</h3>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/60">Goal by {formatCampaignDateLabel(campaignGoalDatePst)}</p>
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
            No tracked players yet. Ask an admin to manage tracked players from Admin &gt; Reading check-ins.
          </div>
        ) : null}

        {leaderboard.length > 0 ? (
          <div className="mt-3 space-y-2">
            <div className="space-y-2 sm:hidden">
              {leaderboard.map((row, index) => {
                const checkedInToday = hasTodayCheckin(row);
                const showBook = checkedInToday && row.currentBookTitle !== "-";

                return (
                  <article key={`mobile-${row.accountId}`} className="rounded-lg border border-line bg-surface-muted/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">#{index + 1}</p>
                        <p className="text-base font-black text-foreground">{row.nickname}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground/65">
                          WK {row.wkLevel} • Streak {row.currentStreak}d
                        </p>
                      </div>
                      <p className="text-base font-black text-accent">{formatYen(row.totalYen)}</p>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="inline-flex items-center rounded-full border border-radical bg-radical px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                        {SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.radical].short} {formatCount(row.reviewRadicalToday)}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-kanji bg-kanji px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                        {SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.kanji].short} {formatCount(row.reviewKanjiToday)}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-vocabulary bg-vocabulary px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                        {SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.vocabulary].short} {formatCount(row.reviewVocabularyToday)}
                      </span>
                      {row.zeroReviewsBonusToday ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                          0 reviews confirmed
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2">
                      {checkedInToday ? (
                        <div className="flex min-w-0 items-center gap-1.5" title={row.currentBookTitle}>
                          {showBook ? (
                            <UserReadingBookCoverImage
                              isbn={row.currentBookIsbn ?? undefined}
                              title={row.currentBookTitle}
                              thumbnailUrl={row.currentBookThumbnailUrl}
                              alt=""
                              width={14}
                              height={20}
                              className="h-5 w-3.5 shrink-0 rounded border border-line object-cover"
                            />
                          ) : null}
                          <p className="min-w-0 truncate text-xs font-semibold text-foreground/80">
                            {showBook ? row.currentBookTitle : "Check-in submitted"}
                            {showBook ? (
                              <span className="ml-1 text-[10px] text-foreground/60">(p{row.currentBookPage ?? "-"})</span>
                            ) : null}
                            <span className="ml-1 text-foreground/65">
                              left {row.pagesRemainingForReadingPass}p / {row.minutesRemainingForReadingPass}m
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs font-semibold text-foreground/60">No check-in yet today</p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-line sm:block">
              <table className="w-full min-w-205 text-left text-xs">
                <thead className="bg-surface-muted text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/60">
                  <tr>
                    <th className="px-2.5 py-2">Rank</th>
                    <th className="px-2.5 py-2">Player</th>
                    <th className="px-2.5 py-2">Reviews today</th>
                    <th className="px-2.5 py-2">Reading today</th>
                    <th className="px-2.5 py-2 text-right">Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 bg-surface">
                  {leaderboard.map((row, index) => {
                    const checkedInToday = hasTodayCheckin(row);
                    const showBook = checkedInToday && row.currentBookTitle !== "-";

                    return (
                      <tr key={row.accountId} className="align-top">
                        <td className="px-2.5 py-2 font-black text-foreground">#{index + 1}</td>
                        <td className="px-2.5 py-2">
                          <p className="text-sm font-black text-foreground">{row.nickname}</p>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground/65">
                            WK {row.wkLevel} • Streak {row.currentStreak}d
                          </p>
                        </td>
                        <td className="px-2.5 py-2">
                          <div className="flex flex-wrap gap-1">
                            <span className="inline-flex items-center rounded-full border border-radical bg-radical px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                              {SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.radical].short} {formatCount(row.reviewRadicalToday)}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-kanji bg-kanji px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                              {SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.kanji].short} {formatCount(row.reviewKanjiToday)}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-vocabulary bg-vocabulary px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                              {SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.vocabulary].short} {formatCount(row.reviewVocabularyToday)}
                            </span>
                            {row.zeroReviewsBonusToday ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                                0 reviews confirmed
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2.5 py-2">
                          {checkedInToday ? (
                            <div className="flex min-w-0 items-center gap-1.5" title={row.currentBookTitle}>
                              {showBook ? (
                                <UserReadingBookCoverImage
                                  isbn={row.currentBookIsbn ?? undefined}
                                  title={row.currentBookTitle}
                                  thumbnailUrl={row.currentBookThumbnailUrl}
                                  alt=""
                                  width={14}
                                  height={20}
                                  className="h-5 w-3.5 shrink-0 rounded border border-line object-cover"
                                />
                              ) : null}
                              <p className="min-w-0 truncate text-xs font-semibold text-foreground/80">
                                {showBook ? row.currentBookTitle : "Check-in submitted"}
                                {showBook ? (
                                  <span className="ml-1 text-[10px] text-foreground/60">(p{row.currentBookPage ?? "-"})</span>
                                ) : null}
                                <span className="ml-1 text-foreground/65">
                                  left {row.pagesRemainingForReadingPass}p / {row.minutesRemainingForReadingPass}m
                                </span>
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs font-semibold text-foreground/60">No check-in yet today</p>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-right text-sm font-black text-accent">{formatYen(row.totalYen)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
