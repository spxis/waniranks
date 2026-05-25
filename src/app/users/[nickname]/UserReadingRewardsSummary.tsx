import { READING_CAMPAIGN, formatCampaignDateLabel } from "@/lib/readingSignoff";

type LeaderboardRow = {
  accountId: string;
  totalYen: number;
  currentStreak: number;
  perfectDays: number;
  nickname: string;
};

type UserReadingRewardsSummaryProps = {
  daysRemaining: number;
  leaderboard: LeaderboardRow[];
};

export default function UserReadingRewardsSummary({ daysRemaining, leaderboard }: UserReadingRewardsSummaryProps) {
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
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/65">Days to trip</p>
            <p className="text-3xl font-black text-foreground">{daysRemaining}</p>
            <p className="text-xs text-foreground/70">Trip: {formatCampaignDateLabel(READING_CAMPAIGN.tripDatePst)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-black text-foreground">Money leaderboard</h3>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/60">Goal by {formatCampaignDateLabel(READING_CAMPAIGN.goalDatePst)}</p>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.08em] text-foreground/65">
                <th className="px-2 py-2">Rank</th>
                <th className="px-2 py-2">Kid</th>
                <th className="px-2 py-2">Total earned</th>
                <th className="px-2 py-2">Current streak</th>
                <th className="px-2 py-2">Perfect days</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, index) => (
                <tr key={row.accountId} className="border-b border-line/60 text-foreground/85">
                  <td className="px-2 py-2 font-black">#{index + 1}</td>
                  <td className="px-2 py-2 font-semibold">{row.nickname}</td>
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
