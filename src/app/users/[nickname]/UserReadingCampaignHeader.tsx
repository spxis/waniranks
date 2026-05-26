import type { Dispatch, SetStateAction } from "react";

import type { ReadingCampaignOption } from "./UserReadingSignoffPanel.types";

type Props = {
  campaigns: ReadingCampaignOption[];
  selectedCampaignId: string;
  onCampaignChange: Dispatch<SetStateAction<string>>;
};

function campaignRangeLabel(campaign: ReadingCampaignOption): string {
  return `${campaign.startDatePst} to ${campaign.goalDatePst}`;
}

export default function UserReadingCampaignHeader({
  campaigns,
  selectedCampaignId,
  onCampaignChange,
}: Props) {
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null;

  return (
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

      <label className="flex min-w-72 flex-col gap-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground/70">
        Campaign
        <select
          value={selectedCampaignId}
          onChange={(event) => onCampaignChange(event.target.value)}
          className="h-10 rounded border border-line bg-surface px-3 text-sm font-semibold text-foreground"
          disabled={campaigns.length <= 1}
        >
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name} ({campaignRangeLabel(campaign)})
            </option>
          ))}
        </select>
        {selectedCampaign ? <span className="normal-case text-[11px]">{campaignRangeLabel(selectedCampaign)}</span> : null}
      </label>
    </header>
  );
}
