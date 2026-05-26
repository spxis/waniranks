import { ACTIVE_READING_CHALLENGE } from "@/lib/readingChallengeRules";

import type { CampaignForm, CampaignRecord, CampaignStatus } from "./AdminCampaignManager.types";

export const CAMPAIGN_STATUS_OPTIONS: CampaignStatus[] = ["draft", "active", "completed", "archived"];

const DEFAULT_SCORING_RULES_TEXT = JSON.stringify(ACTIVE_READING_CHALLENGE.scoringRules, null, 2);

export function createDefaultCampaignForm(): CampaignForm {
  return {
    id: "",
    slug: "",
    name: "",
    description: "",
    status: "draft",
    currencyCode: "JPY",
    startDatePst: ACTIVE_READING_CHALLENGE.startDatePst,
    goalDatePst: ACTIVE_READING_CHALLENGE.goalDatePst,
    tripDatePst: ACTIVE_READING_CHALLENGE.tripDatePst,
    targetBaseYen: ACTIVE_READING_CHALLENGE.targetBaseYen,
    scoringRulesText: DEFAULT_SCORING_RULES_TEXT,
  };
}

export function campaignToForm(campaign: CampaignRecord): CampaignForm {
  return {
    id: campaign.id,
    slug: campaign.slug,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    currencyCode: campaign.currencyCode,
    startDatePst: campaign.startDatePst,
    goalDatePst: campaign.goalDatePst,
    tripDatePst: campaign.tripDatePst,
    targetBaseYen: campaign.targetBaseYen,
    scoringRulesText: JSON.stringify(campaign.scoringRules, null, 2),
  };
}

export function parseScoringRules(scoringRulesText: string): Record<string, unknown> {
  const parsed = JSON.parse(scoringRulesText) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Scoring rules JSON must be an object.");
  }

  return parsed as Record<string, unknown>;
}

export function shouldConfirmActivation(args: {
  nextStatus: CampaignStatus;
  currentCampaignId?: string;
  campaigns: CampaignRecord[];
}): boolean {
  if (args.nextStatus !== "active") {
    return false;
  }

  return args.campaigns.some((campaign) => campaign.status === "active" && campaign.id !== args.currentCampaignId);
}
