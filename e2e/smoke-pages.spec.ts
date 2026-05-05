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

test("study keeps all type filter on reload", async ({ browser, baseURL }) => {
  const user = smokeUsers[0] ?? fallbackUsers[0];
  const url = `${baseURL}/users/${encodeURIComponent(user)}?tab=study&srs=all&jlpt=all&review=all&sticky=0&recent=0#explorer`;

  await assertPageLoads(browser, url, async (page) => {
    const allTypeButton = page.getByRole("button", { name: /^All\s+(Levels|L\d+)\s+\(\d+\)$/i });
    await expect(allTypeButton).toBeVisible();

    await allTypeButton.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("type")).not.toBe("radical");
    await page.waitForTimeout(150);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {
      // Some pages keep lightweight polling alive; proceed with assertions.
    });

    const typeFilter = new URL(page.url()).searchParams.get("type");
    expect(typeFilter, "type filter should stay all/empty after reload").not.toBe("radical");
  });
});

test("study keeps explicit level and vocab type on reload", async ({ browser, baseURL }) => {
  const user = smokeUsers[0] ?? fallbackUsers[0];
  const url = `${baseURL}/users/${encodeURIComponent(user)}?tab=study&level=10&type=vocabulary&srs=all&jlpt=all&review=all&sticky=0&recent=0#explorer`;

  await assertPageLoads(browser, url, async (page) => {
    const levelButton = page.getByRole("button", { name: /^L10$/i });
    const vocabButton = page.getByRole("button", { name: /^vocab\s*\(\d+\)$/i });

    await expect(levelButton).toBeVisible();
    await expect(vocabButton).toBeVisible();

    await expect(levelButton).toHaveClass(/bg-accent/);
    await expect(vocabButton).toHaveClass(/bg-vocabulary/);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {
      // Some pages keep lightweight polling alive; proceed with assertions.
    });

    const params = new URL(page.url()).searchParams;
    expect(params.get("level"), "level should stay pinned to L10").toBe("10");
    expect(params.get("type"), "type should stay pinned to vocabulary").toBe("vocabulary");

    await expect(levelButton).toHaveClass(/bg-accent/);
    await expect(vocabButton).toHaveClass(/bg-vocabulary/);
  });
});

test("study keeps srs stage filter on reload", async ({ browser, baseURL }) => {
  const user = smokeUsers[0] ?? fallbackUsers[0];
  const url = `${baseURL}/users/${encodeURIComponent(user)}?tab=study&level=6&type=kanji&srs=guru&srsStage=6&jlpt=all&review=all&sticky=0&recent=0#explorer`;

  await assertPageLoads(browser, url, async (page) => {
    const guruButton = page.getByRole("button", { name: /^guru\s*\(\d+\)$/i });
    const srs6Button = page.getByRole("button", { name: /^SRS\s*6\s*\(\d+\)$/i });

    await expect(guruButton).toBeVisible();
    await expect(srs6Button).toBeVisible();
    await expect(guruButton).toHaveClass(/bg-accent/);
    await expect(srs6Button).toHaveClass(/bg-accent/);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {
      // Some pages keep lightweight polling alive; proceed with assertions.
    });

    const params = new URL(page.url()).searchParams;
    expect(params.get("srs"), "srs should stay guru").toBe("guru");
    expect(params.get("srsStage"), "srsStage should stay 6").toBe("6");

    await expect(guruButton).toHaveClass(/bg-accent/);
    await expect(srs6Button).toHaveClass(/bg-accent/);
  });
});

test("study keeps srsStage on fresh reload for full query shape", async ({ browser, baseURL }) => {
  const user = smokeUsers[0] ?? fallbackUsers[0];
  const url = `${baseURL}/users/${encodeURIComponent(user)}?mode=review&levels=17&subject=209&jlpt=all&review=all&sticky=0&srs=guru&type=kanji&level=17&srsStage=6&recent=0`;

  await assertPageLoads(browser, url, async (page) => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {
      // Some pages keep lightweight polling alive; proceed with assertions.
    });

    const params = new URL(page.url()).searchParams;
    expect(params.get("srs"), "srs should remain guru after reload").toBe("guru");
    expect(params.get("level"), "level should remain 17 after reload").toBe("17");
    expect(params.get("type"), "type should remain kanji after reload").toBe("kanji");
    expect(params.get("srsStage"), "srsStage should remain 6 after reload").toBe("6");
  });
});
