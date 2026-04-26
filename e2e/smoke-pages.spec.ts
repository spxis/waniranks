import { expect, test, type Browser } from "@playwright/test";

type TabDef = {
  key: "study" | "level" | "jlpt";
  label: string;
};

const tabs: TabDef[] = [
  { key: "study", label: "Study" },
  { key: "level", label: "WaniKani Explorer" },
  { key: "jlpt", label: "JLPT Explorer" },
];

const fallbackUsers = ["johnmorrisdotca"];
let smokeUsers = [...fallbackUsers];

function extractUsernames(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidateRows = (payload as { rows?: unknown; leaderboard?: unknown }).rows
    ?? (payload as { rows?: unknown; leaderboard?: unknown }).leaderboard
    ?? payload;

  if (!Array.isArray(candidateRows)) {
    return [];
  }

  const users: string[] = [];
  for (const row of candidateRows) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const candidate = (row as { wkUsername?: unknown; username?: unknown; nickname?: unknown }).wkUsername
      ?? (row as { wkUsername?: unknown; username?: unknown; nickname?: unknown }).username
      ?? (row as { wkUsername?: unknown; username?: unknown; nickname?: unknown }).nickname;

    if (typeof candidate === "string" && candidate.trim().length > 0) {
      users.push(candidate.trim());
    }

    if (users.length >= 3) {
      break;
    }
  }

  return users;
}

async function assertPageLoads(
  browser: Browser,
  url: string,
  checks: (page: import("@playwright/test").Page) => Promise<void>,
): Promise<void> {
  const page = await browser.newPage();
  const badResponses: string[] = [];
  const pageErrors: string[] = [];

  page.on("response", (response) => {
    const status = response.status();
    if (status >= 500) {
      badResponses.push(`${status} ${response.url()}`);
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {
    // Some pages keep lightweight polling alive; proceed with assertions.
  });

  await expect(page.getByText("This page couldn't load")).toHaveCount(0);
  await expect(page.getByText("Internal Server Error")).toHaveCount(0);

  await checks(page);

  expect(pageErrors, `page errors for ${url}`).toEqual([]);
  expect(badResponses, `500+ responses for ${url}`).toEqual([]);

  await page.close();
}

test.beforeAll(async ({ request }) => {
  const response = await request.get("/api/leaderboard");
  if (!response.ok()) {
    return;
  }

  const payload = (await response.json()) as unknown;
  const extracted = extractUsernames(payload);
  if (extracted.length > 0) {
    smokeUsers = extracted;
  }
});

test("home page loads", async ({ browser, baseURL }) => {
  const url = `${baseURL}/`;
  await assertPageLoads(browser, url, async (page) => {
    await expect(page.locator("body")).toContainText("UmaKuma");
  });
});

test("news reader page loads", async ({ browser, baseURL }) => {
  const url = `${baseURL}/news`;
  await assertPageLoads(browser, url, async (page) => {
    await expect(page.getByRole("heading", { name: "Read News" })).toBeVisible();
  });
});

test("user drilldown tabs load", async ({ browser, baseURL }) => {
  for (const user of smokeUsers) {
    for (const tab of tabs) {
      const url = `${baseURL}/users/${encodeURIComponent(user)}?tab=${tab.key}#explorer`;
      await assertPageLoads(browser, url, async (page) => {
        await expect(page.locator("h1")).toContainText(/.+/);
        const explorerTabs = page.getByRole("tablist", { name: "Explorer tabs" });
        await expect(
          explorerTabs.getByRole("tab", { name: tab.label, exact: true }),
        ).toHaveAttribute("aria-selected", "true");
      });
    }
  }
});
