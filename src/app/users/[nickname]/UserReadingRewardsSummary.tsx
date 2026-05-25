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

  const subjectPillClassByType = {
    [SUBJECT_TYPES.radical]: "subject-pill--radical",
    [SUBJECT_TYPES.kanji]: "subject-pill--kanji",
    [SUBJECT_TYPES.vocabulary]: "subject-pill--vocabulary",
  } as const;

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
          Compact player cards with chip-style progress metrics.
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
          <ol className="mt-3 space-y-2">
            {leaderboard.map((row, index) => {
              const subjectProgress = [
                {
                  type: SUBJECT_TYPES.kanji,
                  label: SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.kanji].singular,
                  learned: row.learnedKanji,
                  today: row.reviewKanjiToday,
                },
                {
                  type: SUBJECT_TYPES.radical,
                  label: SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.radical].plural,
                  learned: row.learnedRadicals,
                  today: row.reviewRadicalToday,
                },
                {
                  type: SUBJECT_TYPES.vocabulary,
                  label: SUBJECT_TYPE_DISPLAY[SUBJECT_TYPES.vocabulary].plural,
                  learned: row.learnedVocabulary,
                  today: row.reviewVocabularyToday,
                },
              ] as const;

              return (
              <li
                key={row.accountId}
                className="rounded-xl border border-line bg-surface px-3 py-3 shadow-[0_10px_24px_rgba(15,111,255,0.06)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full border border-line bg-surface-muted px-2 py-0.5 text-[11px] font-black text-foreground">
                        #{index + 1}
                      </span>
                      <p className="text-sm font-black text-foreground">{row.nickname}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-foreground/65">WK {row.wkLevel}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-line bg-surface-muted px-2.5 py-2 text-right">
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-foreground/60">Total earned</p>
                    <p className="text-lg font-black text-accent">{formatYen(row.totalYen)}</p>
                    <div className="mt-1 flex flex-wrap justify-end gap-1">
                      <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-foreground/75">
                        Streak {row.currentStreak}d
                      </span>
                      <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-foreground/75">
                        Perfect {row.perfectDays}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {subjectProgress.map((metric) => (
                    <article key={metric.type} className="rounded-lg border border-line bg-surface-muted px-2 py-2">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`subject-pill ${subjectPillClassByType[metric.type]}`}>{metric.label}</span>
                        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-foreground/70">
                          Learned
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`subject-pill ${subjectPillClassByType[metric.type]}`}>{formatCount(metric.learned)}</span>
                        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-foreground/75">
                          Today {formatCount(metric.today)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-2 grid gap-2 lg:grid-cols-3">
                  <div className="rounded-md border border-line bg-surface px-2 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-foreground/65">Check-in</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {row.currentBookThumbnailUrl ? (
                        <Image
                          src={row.currentBookThumbnailUrl}
                          alt=""
                          width={16}
                          height={22}
                          className="h-5 w-4 shrink-0 rounded border border-line object-cover"
                        />
                      ) : null}
                      <p className="min-w-0 truncate text-xs font-semibold text-foreground" title={row.currentBookTitle}>
                        {row.currentBookTitle}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-foreground/75">
                      Page {row.currentBookPage ?? "-"} • left {row.pagesRemainingForReadingPass}p / {row.minutesRemainingForReadingPass}m
                    </p>
                  </div>

                  <div className="rounded-md border border-line bg-surface px-2 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-foreground/65">Today / tomorrow base</p>
                    <p className="mt-1 text-xs font-semibold text-foreground/85">
                      Today {formatYen(row.todayMinimumNormalYen)} to {formatYen(row.todayMaxNormalYen)}
                    </p>
                    <p className="text-xs text-foreground/75">
                      Tomorrow reset {formatYen(row.nextDayMaxNormalYenIfMissToday)} • perfect {formatYen(row.nextDayMaxNormalYenIfPerfectToday)}
                    </p>
                  </div>

                  <div className="rounded-md border border-line bg-surface px-2 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-foreground/65">Bonus and cap</p>
                    <p className="mt-1 text-xs font-semibold text-foreground/85">Week cap {formatYen(row.weekCapYen)}</p>
                    <p className="text-xs text-foreground/75">
                      {row.minutesRemainingForThirtyBonus === 0
                        ? `30m bonus ready (+${formatYen(READING_CAMPAIGN.minutesBonusYen)})`
                        : `${row.minutesRemainingForThirtyBonus}m to +${formatYen(READING_CAMPAIGN.minutesBonusYen)}`}
                    </p>
                    <p className="text-xs text-foreground/70">
                      15p bonus +{formatYen(READING_CAMPAIGN.pagesBonusYen)}
                      {row.zeroReviewsBonusToday ? " • zero-review bonus ready" : row.reviewTotalToday > 0 ? ` • ${row.reviewTotalToday} reviews today` : ""}
                    </p>
                  </div>
                </div>
              </li>
              );
            })}
          </ol>
        ) : null}
      </section>
    </>
  );
}
