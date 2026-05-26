import { ACTIVE_READING_CHALLENGE } from "@/lib/readingChallengeRules";
import { READING_CAMPAIGN } from "@/lib/readingSignoff";

import type { ReadingCampaignOption } from "./UserReadingSignoffPanel.types";

export function resolveReadingCampaignOptions(
  campaigns: ReadingCampaignOption[] | undefined,
  fallbackCampaignId: string,
): ReadingCampaignOption[] {
  if (campaigns?.length) {
    return campaigns.map((campaign) => ({
      ...campaign,
      tripDatePst: campaign.tripDatePst ?? ACTIVE_READING_CHALLENGE.tripDatePst,
      targetBaseYen: campaign.targetBaseYen ?? ACTIVE_READING_CHALLENGE.targetBaseYen,
    }));
  }

  return [
    {
      id: fallbackCampaignId,
      name: ACTIVE_READING_CHALLENGE.name,
      status: ACTIVE_READING_CHALLENGE.status,
      startDatePst: READING_CAMPAIGN.startDatePst,
      goalDatePst: READING_CAMPAIGN.goalDatePst,
      tripDatePst: ACTIVE_READING_CHALLENGE.tripDatePst,
      targetBaseYen: ACTIVE_READING_CHALLENGE.targetBaseYen,
    },
  ];
}

export function resolveSelectedReadingCampaignId({
  currentCampaignId,
  serverCampaignId,
  campaigns,
}: {
  currentCampaignId: string;
  serverCampaignId?: string;
  campaigns: ReadingCampaignOption[];
}): string {
  if (serverCampaignId) {
    return serverCampaignId;
  }

  if (campaigns.some((campaign) => campaign.id === currentCampaignId)) {
    return currentCampaignId;
  }

  return campaigns[0]?.id ?? currentCampaignId;
}

export function resolveCampaignMonthBounds(args: {
  campaigns?: ReadingCampaignOption[];
  selectedCampaignId: string;
}): { startMonthKey: string; goalMonthKey: string } {
  const selectedCampaign = args.campaigns?.find((campaign) => campaign.id === args.selectedCampaignId) ?? null;
  const startDatePst = selectedCampaign?.startDatePst ?? READING_CAMPAIGN.startDatePst;
  const goalDatePst = selectedCampaign?.goalDatePst ?? READING_CAMPAIGN.goalDatePst;

  return {
    startMonthKey: startDatePst.slice(0, 7),
    goalMonthKey: goalDatePst.slice(0, 7),
  };
}

export function clampMonthKeyToBounds(
  monthKey: string,
  bounds: { startMonthKey: string; goalMonthKey: string },
): string {
  return monthKey < bounds.startMonthKey
    ? bounds.startMonthKey
    : monthKey > bounds.goalMonthKey
      ? bounds.goalMonthKey
      : monthKey;
}
