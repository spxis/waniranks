import { describe, expect, it } from "vitest";

import {
  clampMonthKeyToBounds,
  resolveCampaignMonthBounds,
  resolveReadingCampaignOptions,
  resolveSelectedReadingCampaignId,
} from "./UserReadingSignoffPanel.campaigns";

describe("UserReadingSignoffPanel campaign helpers", () => {
  it("falls back to default challenge campaign option", () => {
    const campaigns = resolveReadingCampaignOptions(undefined, "fallback-id");

    expect(campaigns).toHaveLength(1);
    expect(campaigns[0]?.id).toBe("fallback-id");
  });

  it("selects server campaign id when available", () => {
    const campaigns = [
      {
        id: "campaign-a",
        name: "Campaign A",
        status: "active",
        startDatePst: "2026-06-01",
        goalDatePst: "2026-07-01",
      },
      {
        id: "campaign-b",
        name: "Campaign B",
        status: "draft",
        startDatePst: "2026-08-01",
        goalDatePst: "2026-09-01",
      },
    ];

    const selected = resolveSelectedReadingCampaignId({
      currentCampaignId: "campaign-a",
      serverCampaignId: "campaign-b",
      campaigns,
    });

    expect(selected).toBe("campaign-b");
  });

  it("resolves month bounds from selected campaign", () => {
    const bounds = resolveCampaignMonthBounds({
      selectedCampaignId: "campaign-b",
      campaigns: [
        {
          id: "campaign-a",
          name: "Campaign A",
          status: "active",
          startDatePst: "2026-06-01",
          goalDatePst: "2026-07-01",
        },
        {
          id: "campaign-b",
          name: "Campaign B",
          status: "draft",
          startDatePst: "2026-09-10",
          goalDatePst: "2026-11-08",
        },
      ],
    });

    expect(bounds).toEqual({
      startMonthKey: "2026-09",
      goalMonthKey: "2026-11",
    });
  });

  it("clamps month keys to campaign bounds", () => {
    const bounds = {
      startMonthKey: "2026-06",
      goalMonthKey: "2026-08",
    };

    expect(clampMonthKeyToBounds("2026-05", bounds)).toBe("2026-06");
    expect(clampMonthKeyToBounds("2026-07", bounds)).toBe("2026-07");
    expect(clampMonthKeyToBounds("2026-09", bounds)).toBe("2026-08");
  });
});
