import { spawnSync } from "node:child_process";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { formatMinutes } from "../../src/lib/dashboard";
import { serverActionDone, signUp } from "./helpers";
import { seedDashboard } from "./seed";

const row = (page: Page, testId: string, name: string) =>
  page.getByTestId(testId).filter({ hasText: name });

const heatCell = (page: Page, date: string) =>
  page.locator(`[data-testid="heatmap-cell"][data-date="${date}"]`);

async function expectStreak(page: Page, name: string, current: number, best: number) {
  const r = row(page, "streak-row", name);
  await expect(r.getByTestId("streak-current")).toHaveText(String(current));
  await expect(r.getByTestId("streak-best")).toHaveText(String(best));
}

async function expectFocus(panel: Locator, range: "Day" | "Week" | "Month", minutes: number) {
  await panel.getByRole("button", { name: range, exact: true }).click();
  await expect(panel.getByRole("button", { name: range, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(panel.getByTestId("focus-total")).toHaveText(formatMinutes(minutes));
}

test.describe("dashboard", () => {
  test("every number matches the seeded data, and quick actions update them", async ({ page }) => {
    const email = await signUp(page);
    await expect(page.getByText("Nothing to track yet")).toBeVisible();

    const seed = await seedDashboard(email);
    await page.reload();

    // ---- Today panel ----
    await expect(page.getByTestId("today-summary")).toHaveText("2 habits · 2 tasks left");
    const habits = page.getByTestId("today-habit");
    await expect(habits).toHaveCount(3);
    await expect(row(page, "today-habit", "Read").getByTestId("today-habit-count")).toHaveText(
      "1/2",
    );
    await expect(
      row(page, "today-habit", "Stretch").getByRole("button", { name: "Stretch done today" }),
    ).toBeDisabled();
    await expect(row(page, "today-habit", "Review").getByTestId("today-habit-count")).toHaveText(
      "0/1",
    );

    const tasks = page.getByTestId("today-task");
    await expect(tasks).toHaveCount(3); // "Someday" has no due date
    await expect(tasks.locator("p").first()).toHaveText("Old bug");
    await expect(row(page, "today-task", "Old bug").getByTestId("today-task-due")).toContainText(
      "Overdue",
    );
    await expect(row(page, "today-task", "Ship report").getByTestId("today-task-due")).toHaveText(
      "Today 23:59",
    );
    await expect(
      page.getByRole("checkbox", { name: "Mark Plan sprint as not done" }),
    ).toBeChecked();

    // ---- Rings ----
    await expect(page.getByTestId("ring-daily")).toHaveText("1/2");
    await expect(page.getByTestId("ring-tasks")).toHaveText("1/2");
    await expect(page.getByTestId("ring-habit")).toHaveCount(2); // weekly "Review" has no daily ring
    await expect(page.getByRole("progressbar", { name: "Read progress today" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    await expect(page.getByRole("progressbar", { name: "Stretch progress today" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );

    // ---- Streaks (sorted by current streak) ----
    await expect(page.getByTestId("streak-row")).toHaveCount(3);
    await expect(page.getByTestId("streak-row").first()).toContainText("Read");
    await expectStreak(page, "Read", 3, 3);
    await expectStreak(page, "Stretch", 2, 2);
    await expectStreak(page, "Review", 0, 0);

    // ---- Heatmap ----
    const expectedCounts = [1, 2, 1, 1, 0, 1, 0]; // today, yesterday, …
    for (const [i, count] of expectedCounts.entries()) {
      await expect(heatCell(page, seed.days[i])).toHaveAttribute("data-count", String(count));
    }
    await expect(heatCell(page, seed.days[1])).toHaveAttribute("data-level", "4");
    await expect(heatCell(page, seed.days[4])).toHaveAttribute("data-level", "0");
    await expect(page.getByTestId("heatmap-total")).toHaveText("6");
    await expect(page.getByTestId("heatmap-days")).toHaveText("5");

    // ---- Focus minutes ----
    const focus = page.getByTestId("panel-focus");
    await expect(focus.getByRole("button", { name: "Week", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(focus.getByTestId("focus-total")).toHaveText(formatMinutes(seed.focus.week));
    await expectFocus(focus, "Day", seed.focus.day);
    await expectFocus(focus, "Month", seed.focus.month);
    await expectFocus(focus, "Week", seed.focus.week);
    expect(seed.focus.day).toBeGreaterThanOrEqual(10);

    // ---- Target vs. actual ----
    const time = page.getByTestId("task-time-row");
    await expect(time).toHaveCount(3); // "Old bug" has no target
    await expect(time.getByRole("link")).toHaveText(["Ship report", "Someday", "Plan sprint"]);
    await expect(time.getByTestId("task-time-value")).toHaveText([
      "45/60 min",
      "0/20 min",
      "40/30 min",
    ]);
    await expect(
      row(page, "task-time-row", "Plan sprint").getByTestId("task-time-over"),
    ).toHaveText("+10 over");

    // ---- Quick check-in updates every dependent number ----
    let saved = serverActionDone(page);
    await row(page, "today-habit", "Read").getByRole("button", { name: "Check in Read" }).click();
    await saved;
    await expect(row(page, "today-habit", "Read").getByTestId("today-habit-count")).toHaveText(
      "2/2",
    );
    await expect(page.getByTestId("ring-daily")).toHaveText("2/2");
    await expectStreak(page, "Read", 4, 4);
    await expect(heatCell(page, seed.days[0])).toHaveAttribute("data-count", "2");
    await expect(page.getByTestId("heatmap-total")).toHaveText("7");
    await expect(page.getByTestId("today-summary")).toHaveText("1 habit · 2 tasks left");

    // ---- Completing a task due today ----
    saved = serverActionDone(page);
    await page.getByRole("checkbox", { name: "Mark Ship report as done" }).click();
    await saved;
    await expect(page.getByTestId("ring-tasks")).toHaveText("2/2");
    await expect(page.getByTestId("today-summary")).toHaveText("1 habit · 1 task left");

    // Persisted, not just optimistic.
    await page.reload();
    await expect(page.getByTestId("ring-daily")).toHaveText("2/2");
    await expect(page.getByTestId("ring-tasks")).toHaveText("2/2");
    await expectStreak(page, "Read", 4, 4);
    await expect(
      page.getByRole("checkbox", { name: "Mark Ship report as not done" }),
    ).toBeChecked();
  });

  test("the demo seed script fills an empty account and refuses to overwrite it", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const email = await signUp(page);
    const seed = (...args: string[]) =>
      spawnSync("pnpm", ["--silent", "db:seed", email, ...args], { encoding: "utf8" });

    const first = seed();
    expect(first.stdout).toMatch(/Seeded .*: 5 habits \(\d+ check-ins\), 6 tasks/);
    expect(first.status).toBe(0);

    await page.reload();
    await expect(page.getByTestId("streak-row")).toHaveCount(5);
    const read = page.getByTestId("streak-row").filter({ hasText: "Read" });
    await expect(read.getByTestId("streak-current")).toHaveText("6");
    await expect(
      page.getByTestId("today-task").filter({ hasText: "Send October invoices" }),
    ).toContainText("Overdue");
    await expect(page.getByTestId("task-time-row").first()).toBeVisible();
    await page.goto("/planner?view=week");
    await expect(page.getByTestId("planner-block").first()).toBeVisible();

    // A second run must not touch existing data unless --reset is given.
    const second = seed();
    expect(second.status).toBe(1);
    expect(second.stderr).toContain("--reset");
    const third = seed("--reset");
    expect(third.status).toBe(0);
    await page.goto("/habits");
    await expect(page.getByTestId("habit-row")).toHaveCount(5);
  });
});
