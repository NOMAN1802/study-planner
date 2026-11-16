import { expect, test, type Page } from "@playwright/test";
import { createHabit, createTask, habitRow, signUp, taskRow } from "./helpers";

/** Seconds left on the timer, parsed from "mm:ss". */
async function secondsLeft(page: Page): Promise<number> {
  const text = (await page.getByTestId("timer-remaining").textContent()) ?? "";
  const [m, s] = text.split(":").map(Number);
  return m * 60 + s;
}

async function setOneMinuteTimer(page: Page) {
  const settings = page.getByRole("form", { name: "Timer settings" });
  await settings.getByLabel("Focus (min)").fill("1");
  await settings.getByLabel("Short break (min)").fill("1");
  await settings.getByRole("button", { name: "Save timer settings" }).click();
  await expect(settings.getByRole("status")).toHaveText(/Saved/);
  await expect(page.getByTestId("timer-remaining")).toHaveText("01:00");
}

test.describe("pomodoro", () => {
  test("a short focus session stays accurate across reloads and credits the task and habit", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signUp(page);
    await createHabit(page, { name: "Deep work", targetMinutes: 1 });
    await createTask(page, { title: "Write report", targetMinutes: 30, habit: "Deep work" });

    await taskRow(page, "Write report")
      .getByRole("link", { name: "Focus on Write report" })
      .click();
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+\/focus$/);
    await expect(page.getByTestId("task-actual")).toHaveText("0/30 min focused");
    await setOneMinuteTimer(page);

    // The server stamps the start somewhere between these two instants.
    const clickedAt = Date.now();
    await page.getByRole("button", { name: "Start focus" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    const confirmedAt = Date.now();

    // Let a few seconds pass, then reload mid-session.
    await page.waitForTimeout(4000);
    const beforeReload = await secondsLeft(page);
    const readAt = Date.now();
    await page.reload();
    await expect(page.getByTestId("timer-phase")).toHaveText("Focus");
    const afterReload = await secondsLeft(page);
    const rereadAt = Date.now();

    // 1) Continuity: the reading after reload matches the reading before it,
    //    minus the wall-clock time that passed (±1.5s for display rounding).
    const drift = beforeReload - (rereadAt - readAt) / 1000 - afterReload;
    expect(Math.abs(drift)).toBeLessThanOrEqual(1.5);

    // 2) Absolute: consistent with the start time bracketed above.
    const minLeft = 60 - (rereadAt - clickedAt) / 1000 - 1;
    const maxLeft = 60 - (rereadAt - confirmedAt) / 1000 + 1;
    expect(afterReload).toBeGreaterThanOrEqual(Math.floor(minLeft));
    expect(afterReload).toBeLessThanOrEqual(Math.ceil(maxLeft));

    // Pause freezes the clock, including across a reload.
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByTestId("timer-phase")).toHaveText("Focus · paused");
    const paused = await secondsLeft(page);
    await page.waitForTimeout(2500);
    expect(await secondsLeft(page)).toBe(paused);
    await page.reload();
    await expect(page.getByTestId("timer-phase")).toHaveText("Focus · paused");
    expect(Math.abs((await secondsLeft(page)) - paused)).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    // Wait for the phase to end on its own.
    await expect(page.getByTestId("timer-phase")).toHaveText("Focus complete", { timeout: 75_000 });
    await expect(page.getByRole("button", { name: "Start short break" })).toBeVisible();
    await expect(page.getByTestId("task-actual")).toHaveText("1/30 min focused");
    await expect(page.getByTestId("session-item").first()).toContainText("Focus");
    await expect(page.getByTestId("session-item").first()).toContainText("1 min");

    // Credited to the task list and the linked habit (minutes target of 1 → done).
    await page.goto("/tasks");
    await expect(taskRow(page, "Write report")).toContainText("1/30 min");
    await page.goto("/habits");
    const habit = habitRow(page, "Deep work");
    await expect(habit.getByTestId("habit-count")).toHaveText("1/1 min");
    await expect(habit.getByTestId("current-streak")).toHaveText("1");
  });

  test("skipping moves on to the break and credits no partial minute", async ({ page }) => {
    await signUp(page);
    await createTask(page, { title: "Inbox zero" });
    await taskRow(page, "Inbox zero").getByRole("link", { name: "Focus on Inbox zero" }).click();
    await expect(page.getByTestId("timer-remaining")).toHaveText("25:00");

    await page.getByRole("button", { name: "Start focus" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByTestId("timer-phase")).toHaveText("Ready for short break");
    await expect(page.getByTestId("timer-remaining")).toHaveText("05:00");
    await expect(page.getByTestId("session-item")).toHaveCount(1);
    await expect(page.getByTestId("session-item").first()).toContainText("0 min");
    await expect(page.getByTestId("task-actual")).toHaveText("0 min focused");
  });

  test("only one timer can run at a time", async ({ page }) => {
    await signUp(page);
    await createTask(page, { title: "First" });
    await createTask(page, { title: "Second" });

    await taskRow(page, "First").getByRole("link", { name: "Focus on First" }).click();
    await page.getByRole("button", { name: "Start focus" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    await page.goto("/tasks");
    await taskRow(page, "Second").getByRole("link", { name: "Focus on Second" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "A timer is running on" }),
    ).toContainText("First");
    await expect(page.getByRole("button", { name: "Start focus" })).toBeDisabled();
  });
});
