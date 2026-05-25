import Image from "next/image";
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
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-6xl text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.08em] text-foreground/65">
                <th className="px-2 py-2">Rank</th>
                <th className="px-2 py-2">Player</th>
                <th className="px-2 py-2">WK level</th>
                <th className="px-2 py-2">Kanji learned</th>
                <th className="px-2 py-2">Radicals learned</th>
                <th className="px-2 py-2">Vocab learned</th>
                <th className="px-2 py-2">Current book</th>
                <th className="px-2 py-2">Page</th>
                <th className="px-2 py-2">Reading left</th>
                <th className="px-2 py-2">Today / Next base</th>
                <th className="px-2 py-2">Bonus progress</th>
                <th className="px-2 py-2">Reviews today</th>
                <th className="px-2 py-2">Cumulative earned</th>
                <th className="px-2 py-2">Current streak</th>
                <th className="px-2 py-2">Perfect days</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-2 py-6">
                    <div className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground/70">
                      <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
                      <span>Loading leaderboard...</span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!isLoading && leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-2 py-6 text-center text-sm font-semibold text-foreground/65">
                    No tracked players yet. Turn players on above to start the leaderboard.
                  </td>
                </tr>
              ) : null}
              {leaderboard.map((row, index) => (
                <tr key={row.accountId} className="border-b border-line/60 text-foreground/85">
                  <td className="px-2 py-2 font-black">#{index + 1}</td>
                  <td className="px-2 py-2 font-semibold">{row.nickname}</td>
                  <td className="px-2 py-2">{row.wkLevel}</td>
                  <td className="px-2 py-2">{row.learnedKanji}</td>
                  <td className="px-2 py-2">{row.learnedRadicals}</td>
                  <td className="px-2 py-2">{row.learnedVocabulary}</td>
                  <td className="px-2 py-2 max-w-48" title={row.currentBookTitle}>
                    <div className="flex items-center gap-1.5">
                      {row.currentBookThumbnailUrl ? (
                        <Image
                          src={row.currentBookThumbnailUrl}
                          alt=""
                          width={16}
                          height={22}
                          className="h-5 w-4 shrink-0 rounded border border-line object-cover"
                        />
                      ) : null}
                      <span className="block min-w-0 truncate">{row.currentBookTitle}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2">{row.currentBookPage ?? "-"}</td>
                  <td className="px-2 py-2">
                    {row.pagesRemainingForReadingPass}p / {row.minutesRemainingForReadingPass}m
                  </td>
                  <td className="px-2 py-2 text-xs font-semibold text-foreground/80">
                    <p>Today max JPY {row.todayMaxNormalYen}</p>
                    <p>Today min JPY {row.todayMinimumNormalYen}</p>
                    <p>Next max JPY {row.nextDayMaxNormalYenIfPerfectToday}</p>
                    <p className="text-foreground/65">Reset next JPY {row.nextDayMaxNormalYenIfMissToday}</p>
                  </td>
                  <td className="px-2 py-2 text-xs font-semibold text-foreground/80">
                    <p>Week cap JPY {row.weekCapYen}</p>
                    <p>
                      {row.minutesRemainingForThirtyBonus === 0
                        ? `30m+ bonus ready (+JPY ${READING_CAMPAIGN.minutesBonusYen})`
                        : `${row.minutesRemainingForThirtyBonus}m to +JPY ${READING_CAMPAIGN.minutesBonusYen}`}
                    </p>
                    <p className="text-foreground/65">15p bonus: +JPY {READING_CAMPAIGN.pagesBonusYen}</p>
                  </td>
                  <td className="px-2 py-2">
                    Kanji {row.reviewKanjiToday} / Vocab {row.reviewVocabularyToday} / Radicals {row.reviewRadicalToday}
                    {row.zeroReviewsBonusToday ? " (+0 bonus)" : row.reviewTotalToday > 0 ? ` (${row.reviewTotalToday} total)` : ""}
                  </td>
                  <td className="px-2 py-2 font-black text-accent">JPY {row.totalYen.toLocaleString("en-US")}</td>
                  <td className="px-2 py-2">{row.currentStreak} days</td>
                  <td className="px-2 py-2">{row.perfectDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
