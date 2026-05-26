export type CampaignStatus = "draft" | "active" | "completed" | "archived";

export type CampaignRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: CampaignStatus;
  currencyCode: "JPY";
  startDatePst: string;
  goalDatePst: string;
  tripDatePst: string;
  targetBaseYen: number;
  scoringRules: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CampaignForm = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: CampaignStatus;
  currencyCode: "JPY";
  startDatePst: string;
  goalDatePst: string;
  tripDatePst: string;
  targetBaseYen: number;
  scoringRulesText: string;
};

export type CampaignsResponse = {
  campaigns: CampaignRecord[];
  error?: string;
};

export type CampaignMutationResponse = {
  campaign: CampaignRecord;
  error?: string;
};
