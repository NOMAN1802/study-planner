import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";

/** Local calendar day `n` days from now (the browser runs in the same timezone). */
function dayKey(n = 0) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const found = results.violations.map((v) => ({
    rule: v.id,
    nodes: v.nodes
      .slice(0, 4)
      .map(
        (n) =>
          `${n.target.join(" ")} — ${(n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 220)}`,
      ),
  }));
  expect.soft(found, `axe violations on ${label}`).toEqual([]);
}

test.describe("daily habits", () => {
  test.use({ reducedMotion: "reduce" });

  test("add the set, tick prayers and habits, back-fill a day, and see it in the report, tracker and dashboard", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const today = dayKey();
    const yesterday = dayKey(-1);
    await signUp(page);

    // ---- Add the daily set ----
    await page.goto("/habits/daily");
    await expect(page.getByRole("heading", { name: "No daily habits yet" })).toBeVisible();
    await page.getByRole("button", { name: "Add my daily set" }).click();
    const list = page.getByRole("list", { name: "Daily habits" });
    await expect(list.getByTestId("daily-habit")).toHaveCount(10);
    await expect(page.getByTestId("daily-done")).toHaveText("0 / 10");
    await expect(page.getByTestId("study-hours")).toHaveText("0 / 7 h");

    // ---- Tick all five prayers and Quran ----
    for (const prayer of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
      const box = page.getByRole("checkbox", { name: prayer, exact: true });
      const saved = page.waitForResponse((r) => r.request().method() === "POST");
      await box.check();
      await saved;
      await expect(box).toBeChecked();
    }
    let saved = page.waitForResponse((r) => r.request().method() === "POST");
    await page.getByRole("checkbox", { name: "Read Quran 10 min" }).check();
    await saved;
    await expect(page.getByTestId("daily-done")).toHaveText("2 / 10");
    await expect(page.getByTestId("daily-score")).toHaveText("20%");

    // Ticks survive a reload.
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Isha", exact: true })).toBeChecked();
    await expect(page.getByTestId("daily-done")).toHaveText("2 / 10");

    // The study habit can't be ticked by hand.
    await expect(page.getByRole("checkbox", { name: /Study at least/ })).toHaveCount(0);

    // ---- Day note ----
    await page.getByLabel("Note for the day").fill("Good start");
    saved = page.waitForResponse((r) => r.request().method() === "POST");
    await page.getByRole("button", { name: "Save note" }).click();
    await saved;
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

    // ---- Back-fill yesterday ----
    await page.getByRole("link", { name: "Previous day" }).click();
    await expect(page).toHaveURL(new RegExp(`date=${yesterday}$`));
    await expect(page.getByRole("checkbox", { name: "Exercise 5 min" })).not.toBeChecked();
    saved = page.waitForResponse((r) => r.request().method() === "POST");
    await page.getByRole("checkbox", { name: "Exercise 5 min" }).check();
    await saved;
    // No next day after today.
    await page.getByRole("link", { name: "Next day" }).click();
    await expect(page.getByTestId("daily-date")).toHaveText("Today");
    await expect(page.getByRole("link", { name: "Next day" })).toHaveCount(0);

    // ---- Report: yesterday (exercise only counts from its first tick) and today ----
    await page.goto(`/habits/report?range=custom&from=${yesterday}&to=${today}`);
    // (2 + 1) ticks of (10 + 1) possible.
    await expect(page.getByTestId("kpi-completion")).toHaveText("27%");
    // Day scores 100% and 20%.
    await expect(page.getByTestId("kpi-average")).toHaveText("60%");
    await expect(page.getByTestId("kpi-perfect")).toHaveText("1");
    await expect(page.getByTestId("kpi-prayer")).toHaveText("100%");
    await expect(page.getByTestId("report-habit")).toHaveCount(10);
    await expect(page.getByText("Good start")).toBeVisible();

    // The range filter switches ranges and keeps them in the URL.
    const ranges = page.getByRole("navigation", { name: "Report range" });
    await ranges.getByRole("link", { name: "Yearly" }).click();
    await expect(page).toHaveURL(/range=year/);
    await expect(page.getByTestId("range-label").first()).toHaveText(today.slice(0, 4));
    await ranges.getByRole("link", { name: "Daily" }).click();
    await expect(page).toHaveURL(/range=day/);
    await expect(page.getByTestId("kpi-completion")).toHaveText("20%");

    // ---- Tracker grid: tick a cell, the row score follows ----
    await page.goto(`/habits/tracker?range=custom&from=${yesterday}&to=${today}`);
    const row = page.locator(`[data-testid="tracker-row"][data-day="${today}"]`);
    await expect(row.getByTestId("tracker-score")).toHaveText("20%");
    const sugar = row.getByRole("button", { name: /^No sugar,/ });
    await expect(sugar).toHaveAttribute("aria-pressed", "false");
    saved = page.waitForResponse((r) => r.request().method() === "POST");
    await sugar.click();
    await saved;
    await expect(row.getByTestId("tracker-score")).toHaveText("30%");
    await page.reload();
    await expect(
      page
        .locator(`[data-testid="tracker-row"][data-day="${today}"]`)
        .getByRole("button", { name: /^No sugar,/ }),
    ).toHaveAttribute("aria-pressed", "true");

    // ---- Dashboard card and the habits list ----
    await page.goto("/dashboard");
    await expect(page.getByTestId("habit-week-today")).toHaveText("30%");
    await page.goto("/habits");
    await expect(page.getByRole("link", { name: "Tick on Daily" })).toHaveCount(2); // prayer, study
    await expect(page.getByRole("button", { name: "Add my daily set" })).toHaveCount(0);

    // ---- Accessibility in both themes ----
    for (const url of [
      "/habits/daily",
      `/habits/tracker?range=custom&from=${yesterday}&to=${today}`,
      `/habits/report?range=custom&from=${yesterday}&to=${today}`,
      "/habits/report?range=year",
    ]) {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((t) => {
          document.documentElement.classList.toggle("dark", t === "dark");
          document.documentElement.style.colorScheme = t;
        }, theme);
        await page.waitForTimeout(400);
        await scan(page, `${url} (${theme})`);
      }
    }
  });

  test("the checklist fits a phone screen", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await signUp(page);
    await page.goto("/habits/daily");
    await page.getByRole("button", { name: "Add my daily set" }).click();
    await expect(page.getByTestId("daily-habit")).toHaveCount(10);
    for (const url of ["/habits/daily", "/habits/tracker", "/habits/report"]) {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${url} scrolls sideways`).toBeLessThanOrEqual(0);
    }
  });
});
