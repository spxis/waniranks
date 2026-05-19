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
let accessibleStudyUser: string | null = null;

const USER_ACCESS_GATE_TEXT = "You do not have access to that user page yet.";

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

  for (const user of smokeUsers) {
    const probe = await request.get(`/users/${encodeURIComponent(user)}?tab=study&mode=review`);
    if (!probe.ok()) {
      continue;
    }

    const html = await probe.text();
    if (!html.includes(USER_ACCESS_GATE_TEXT)) {
      accessibleStudyUser = user;
      break;
    }
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
        if (page.url().includes("/join?access=denied")) {
          await expect(page.getByRole("heading", { name: "Join UmaKuma" })).toBeVisible();
          return;
        }

        await expect(page.locator("h1")).toContainText(/.+/);
        const accessGate = page.getByText(USER_ACCESS_GATE_TEXT);
        if ((await accessGate.count()) > 0) {
          await expect(accessGate).toBeVisible();
          return;
        }

        const explorerTabs = page.getByRole("tablist", { name: "Explorer tabs" });
        await expect(
          explorerTabs.getByRole("tab", { name: tab.label, exact: true }),
        ).toHaveAttribute("aria-selected", "true");
      });
    }
  }
});

test("user history page loads", async ({ browser, baseURL }) => {
  const user = smokeUsers[0] ?? fallbackUsers[0];
  const url = `${baseURL}/users/${encodeURIComponent(user)}/history`;

  await assertPageLoads(browser, url, async (page) => {
    if (page.url().includes("/join?access=denied")) {
      await expect(page.getByRole("heading", { name: "Join UmaKuma" })).toBeVisible();
      return;
    }

    await expect(page.getByRole("link", { name: "Back to user page" })).toBeVisible();
    await expect(page.getByText(/Study Submission History/i)).toBeVisible();
  });
});

test("user read history tab loads", async ({ browser, baseURL }) => {
  const user = smokeUsers[0] ?? fallbackUsers[0];
  const url = `${baseURL}/users/${encodeURIComponent(user)}?dashboard=read&read=history`;

  await assertPageLoads(browser, url, async (page) => {
    if (page.url().includes("/join?access=denied")) {
      await expect(page.getByRole("heading", { name: "Join UmaKuma" })).toBeVisible();
      return;
    }

    const tablist = page.getByRole("tablist", { name: "Read panel tabs" });
    await expect(tablist.getByRole("tab", { name: "History", exact: true })).toHaveAttribute("aria-selected", "true");
  });
});

test("study keeps all type filter on reload", async ({ browser, baseURL }) => {
  test.skip(!accessibleStudyUser, "No accessible user page for study filter checks in this environment.");
  const user = accessibleStudyUser ?? smokeUsers[0] ?? fallbackUsers[0];
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
  test.skip(!accessibleStudyUser, "No accessible user page for study filter checks in this environment.");
  const user = accessibleStudyUser ?? smokeUsers[0] ?? fallbackUsers[0];
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
  test.skip(!accessibleStudyUser, "No accessible user page for study filter checks in this environment.");
  const user = accessibleStudyUser ?? smokeUsers[0] ?? fallbackUsers[0];
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
  test.skip(!accessibleStudyUser, "No accessible user page for study filter checks in this environment.");
  const user = accessibleStudyUser ?? smokeUsers[0] ?? fallbackUsers[0];
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

test("study review all-level type count matches total queue", async ({ browser, baseURL }) => {
  test.skip(!accessibleStudyUser, "No accessible user page for study filter checks in this environment.");
  const user = accessibleStudyUser ?? smokeUsers[0] ?? fallbackUsers[0];
  const url = `${baseURL}/users/${encodeURIComponent(user)}?tab=study&mode=review&srs=all&type=all&recent=0#explorer`;

  await assertPageLoads(browser, url, async (page) => {
    const summary = page.getByText(/Showing\s+\d+\s+matching items\s+·\s+\d+\s+total in queue/i).first();
    await expect(summary).toBeVisible();

    const summaryText = (await summary.textContent()) ?? "";
    const totalMatch = summaryText.match(/·\s*(\d+)\s+total in queue/i);
    expect(totalMatch?.[1], "total in queue value should be present").toBeTruthy();
    const totalInQueue = Number(totalMatch?.[1]);

    const allTypeButton = page.getByRole("button", { name: /^All\s+Levels\s+\(\d+\)$/i });
    await expect(allTypeButton).toBeVisible();
    const allTypeLabel = (await allTypeButton.textContent()) ?? "";
    const allTypeMatch = allTypeLabel.match(/\((\d+)\)/);
    expect(allTypeMatch?.[1], "all type count should be present").toBeTruthy();
    const allTypeCount = Number(allTypeMatch?.[1]);

    expect(allTypeCount, "default review all-type count should match total queue count").toBe(totalInQueue);
  });
});

test("study review keeps recent and hide-locked toggles on reload", async ({ browser, baseURL }) => {
  test.skip(!accessibleStudyUser, "No accessible user page for study filter checks in this environment.");
  const user = accessibleStudyUser ?? smokeUsers[0] ?? fallbackUsers[0];
  const url = `${baseURL}/users/${encodeURIComponent(user)}?tab=study&mode=review&srs=all&type=all&recent=0#explorer`;

  await assertPageLoads(browser, url, async (page) => {
    const hideLockedButton = page.getByRole("button", { name: /^Hide Locked$/i });
    const recentOnlyButton = page.getByRole("button", { name: /^Recent Only$/i });

    await expect(hideLockedButton).toBeVisible();
    await expect(recentOnlyButton).toBeVisible();

    await hideLockedButton.click();
    await expect(page.getByRole("button", { name: /^Show Locked$/i })).toBeVisible();

    await recentOnlyButton.click();

    await expect.poll(() => {
      const params = new URL(page.url()).searchParams;
      return { recent: params.get("recent"), hideLocked: params.get("hideLocked") };
    }).toEqual({ recent: "1", hideLocked: "1" });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {
      // Some pages keep lightweight polling alive; proceed with assertions.
    });

    const params = new URL(page.url()).searchParams;
    expect(params.get("recent"), "recent toggle should persist after reload").toBe("1");
    expect(params.get("hideLocked"), "hideLocked toggle should persist after reload").toBe("1");
  });
});

test("study lesson mode hides review-only filters", async ({ browser, baseURL }) => {
  test.skip(!accessibleStudyUser, "No accessible user page for study filter checks in this environment.");
  const user = accessibleStudyUser ?? smokeUsers[0] ?? fallbackUsers[0];
  const url = `${baseURL}/users/${encodeURIComponent(user)}?tab=study&mode=review&srs=all&type=all#explorer`;

  await assertPageLoads(browser, url, async (page) => {
    const lessonModeButton = page.getByRole("tab", { name: /^Lessons\s+\((\d+|\.\.\.)\)$/i });
    await expect(lessonModeButton).toBeVisible();
    await lessonModeButton.click();

    await expect.poll(() => new URL(page.url()).searchParams.get("mode")).toBe("lesson");
    await expect(lessonModeButton).toHaveAttribute("aria-selected", "true");

    await expect(page.getByRole("button", { name: /^All SRS Stages$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Recent Only$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Hide|Show) Locked$/i })).toHaveCount(0);
  });
});
