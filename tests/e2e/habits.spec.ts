import { expect, test } from "@playwright/test";
import { createHabit, habitRow, serverActionDone, signUp } from "./helpers";

test.describe("habits", () => {
  test("create a daily habit with a count target and check in to completion", async ({ page }) => {
    await signUp(page);
    await page.goto("/habits");
    await expect(page.getByText("No habits yet")).toBeVisible();

    await createHabit(page, { name: "Read", targetCount: 2 });
    const row = habitRow(page, "Read");
    await expect(row.getByTestId("habit-count")).toHaveText("0/2");
    await expect(row.getByTestId("current-streak")).toHaveText("0");

    await row.getByRole("button", { name: "Check in Read" }).click();
    await expect(row.getByTestId("habit-count")).toHaveText("1/2");
    await expect(row.getByTestId("current-streak")).toHaveText("0");

    await row.getByRole("button", { name: "Check in Read" }).click();
    await expect(row.getByTestId("habit-count")).toHaveText("2/2");
    // Once the target is met the button is inert; corrections go through the log panel.
    await expect(row.getByRole("button", { name: "Read done today" })).toBeDisabled();
    await expect(row.getByTestId("current-streak")).toHaveText("1");

    // Persisted, not just optimistic.
    await page.reload();
    const reloaded = habitRow(page, "Read");
    await expect(reloaded.getByTestId("habit-count")).toHaveText("2/2");
    await expect(reloaded.getByTestId("current-streak")).toHaveText("1");
    await expect(reloaded.getByTestId("best-streak")).toHaveText("1");
  });

  test("log minutes and a note for the current period", async ({ page }) => {
    await signUp(page);
    await createHabit(page, { name: "Meditate", targetMinutes: 10 });
    const row = habitRow(page, "Meditate");
    await expect(row.getByTestId("habit-count")).toHaveText("0/10 min");

    await row.getByRole("button", { name: "Check in Meditate" }).click(); // "Log time" opens the panel
    const form = page.getByRole("form", { name: "Log Meditate for today" });
    await form.getByLabel("Minutes").fill("12");
    await form.getByLabel("Note").fill("Quiet morning");
    await form.getByRole("button", { name: "Save" }).click();

    await expect(form).toBeHidden();
    await expect(row.getByTestId("habit-count")).toHaveText("12/10 min");
    await expect(row.getByTestId("habit-note")).toContainText("Quiet morning");
    await expect(row.getByTestId("current-streak")).toHaveText("1");

    // Clearing everything removes the check-in.
    await row.getByRole("button", { name: "Log details for Meditate" }).click();
    await form.getByLabel("Count").fill("0");
    await form.getByLabel("Minutes").fill("0");
    await form.getByLabel("Note").fill("");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(row.getByTestId("habit-count")).toHaveText("0/10 min");
    await expect(row.getByTestId("current-streak")).toHaveText("0");
  });

  test("edit, reorder, archive and restore", async ({ page }) => {
    await signUp(page);
    await createHabit(page, { name: "Alpha" });
    await createHabit(page, { name: "Bravo", frequency: "Weekly" });

    const names = page.getByTestId("habit-row").getByRole("heading");
    await expect(names).toHaveText(["Alpha", "Bravo"]);

    // Wait for the reorder server action to finish before reloading; a reload
    // mid-request would cancel it.
    const saved = serverActionDone(page);
    await habitRow(page, "Bravo").getByRole("button", { name: "Move Bravo up" }).click();
    await expect(names).toHaveText(["Bravo", "Alpha"]);
    await saved;
    await expect(page.getByRole("list", { name: "Habits" })).not.toHaveAttribute(
      "aria-busy",
      "true",
    );
    await page.reload();
    await expect(names).toHaveText(["Bravo", "Alpha"]);

    await habitRow(page, "Alpha").getByRole("link", { name: "Edit Alpha" }).click();
    await expect(page.getByLabel("Name")).toHaveValue("Alpha");
    await page.getByLabel("Name").fill("Alpha two");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/habits$/);
    await expect(names).toHaveText(["Bravo", "Alpha two"]);

    await habitRow(page, "Bravo").getByRole("button", { name: "Archive Bravo" }).click();
    await expect(names).toHaveText(["Alpha two"]);

    await page.getByRole("link", { name: "archived" }).click();
    const archived = page.getByTestId("archived-row");
    await expect(archived).toHaveCount(1);
    await expect(archived).toContainText("Bravo");
    await archived.getByRole("button", { name: "Restore Bravo" }).click();
    await expect(archived).toHaveCount(0);

    await page.getByRole("link", { name: "active" }).click();
    await expect(names).toHaveText(["Alpha two", "Bravo"]);
  });

  test("validates the habit form and supports hourly active hours", async ({ page }) => {
    await signUp(page);
    await page.goto("/habits/new");
    await page.getByRole("button", { name: "Create habit" }).click();
    await expect(page.getByText("Name is required")).toBeVisible();
    await expect(page).toHaveURL(/\/habits\/new$/);

    await page.getByLabel("Name").fill("Water");
    await page.getByText("Hourly", { exact: true }).click();
    await expect(page.getByRole("group", { name: "Active hours" })).toBeVisible();
    await page.getByText("Create habit", { exact: true }).click();
    await expect(habitRow(page, "Water")).toContainText("Hourly");
  });

  test("another user's habit is not reachable", async ({ page, browser }) => {
    await signUp(page);
    await createHabit(page, { name: "Private" });
    await habitRow(page, "Private").getByRole("link", { name: "Edit Private" }).click();
    await expect(page).toHaveURL(/\/habits\/[0-9a-f-]+\/edit$/);
    await expect(page.getByLabel("Name")).toHaveValue("Private");
    const editUrl = page.url();

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signUp(otherPage);
    await otherPage.goto(editUrl);
    await expect(otherPage.getByRole("heading", { name: "Not found" })).toBeVisible();
    await expect(otherPage.getByLabel("Name")).toHaveCount(0);
    await other.close();
  });
});
