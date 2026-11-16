import { expect, test } from "@playwright/test";
import { createHabit, createTask, serverActionDone, signUp, taskRow } from "./helpers";

test.describe("tasks", () => {
  test("full lifecycle: create, edit, complete, reopen, delete", async ({ page }) => {
    await signUp(page);
    await createHabit(page, { name: "Deep work" });

    await page.goto("/tasks");
    await expect(page.getByText("No tasks yet")).toBeVisible();

    // Create
    await createTask(page, {
      title: "Write report",
      priority: "High",
      due: "2030-01-15T09:30",
      targetMinutes: 90,
      habit: "Deep work",
      note: "Include Q4 numbers",
    });
    const row = taskRow(page, "Write report");
    await expect(row.getByTestId("task-status")).toHaveText("To do");
    await expect(row.getByTestId("task-priority")).toHaveText("High");
    await expect(row.getByTestId("task-due")).toHaveText("15 Jan 2030 09:30");
    await expect(row).toContainText("0/90 min");
    await expect(row).toContainText("Deep work");
    await expect(row).toContainText("Include Q4 numbers");

    // Edit (due date round-trips through the user's timezone)
    await row.getByRole("link", { name: "Edit Write report" }).click();
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+\/edit$/);
    await expect(page.getByLabel("Due")).toHaveValue("2030-01-15T09:30");
    await expect(page.getByLabel("Linked habit")).toHaveValue(/.+/);
    await page.getByLabel("Title").fill("Write final report");
    await page.getByLabel("Status", { exact: true }).selectOption("IN_PROGRESS");
    await page.getByText("Urgent", { exact: true }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/tasks$/);
    const edited = taskRow(page, "Write final report");
    await expect(edited.getByTestId("task-status")).toHaveText("In progress");
    await expect(edited.getByTestId("task-priority")).toHaveText("Urgent");

    // Complete: it leaves the default "Open" view…
    await edited.getByRole("checkbox", { name: "Mark Write final report as done" }).check();
    await expect(page.getByText("No tasks match these filters")).toBeVisible();

    // …and shows under Done.
    await page.getByLabel("Status", { exact: true }).selectOption("DONE");
    await expect(page).toHaveURL(/status=DONE/);
    const done = taskRow(page, "Write final report");
    await expect(done.getByTestId("task-status")).toHaveText("Done");
    await expect(done.getByRole("checkbox")).toBeChecked();

    // Reopen
    await done.getByRole("checkbox", { name: "Mark Write final report as not done" }).uncheck();
    await expect(page.getByText("No tasks match these filters")).toBeVisible();
    await page.getByLabel("Status", { exact: true }).selectOption("all");
    await expect(taskRow(page, "Write final report").getByTestId("task-status")).toHaveText(
      "To do",
    );

    // Delete needs confirmation
    const toDelete = taskRow(page, "Write final report");
    await toDelete.getByRole("button", { name: "Delete Write final report" }).click();
    await toDelete.getByRole("button", { name: "Keep" }).click();
    await expect(toDelete).toBeVisible();
    await toDelete.getByRole("button", { name: "Delete Write final report" }).click();
    const deleted = serverActionDone(page);
    await toDelete.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByTestId("task-row")).toHaveCount(0);
    await deleted;

    await page.reload();
    await expect(page.getByText("No tasks yet")).toBeVisible();
  });

  test("filters and sorting", async ({ page }) => {
    await signUp(page);
    await createTask(page, { title: "Alpha low", priority: "Low" });
    await createTask(page, { title: "Bravo urgent", priority: "Urgent", due: "2030-01-15T09:30" });
    await createTask(page, {
      title: "Charlie overdue",
      priority: "Medium",
      due: "2020-01-01T09:00",
    });

    const titles = page.getByTestId("task-row").getByRole("heading");
    // Default: due date ascending, undated last.
    await expect(titles).toHaveText(["Charlie overdue", "Bravo urgent", "Alpha low"]);
    await expect(taskRow(page, "Charlie overdue").getByTestId("task-due")).toHaveText(
      /^Overdue · /,
    );

    await page.getByLabel("Sort", { exact: true }).selectOption("priority");
    await expect(titles).toHaveText(["Bravo urgent", "Charlie overdue", "Alpha low"]);

    await page.getByLabel("Sort", { exact: true }).selectOption("title");
    await expect(titles).toHaveText(["Alpha low", "Bravo urgent", "Charlie overdue"]);

    await page.getByLabel("Priority", { exact: true }).selectOption("URGENT");
    await expect(titles).toHaveText(["Bravo urgent"]);

    await page.getByLabel("Priority", { exact: true }).selectOption("all");
    await page.getByLabel("Due", { exact: true }).selectOption("overdue");
    await expect(titles).toHaveText(["Charlie overdue"]);

    await page.getByLabel("Due", { exact: true }).selectOption("none");
    await expect(titles).toHaveText(["Alpha low"]);

    // Filters live in the URL, so they survive a reload.
    await page.reload();
    await expect(page.getByLabel("Due", { exact: true })).toHaveValue("none");
    await expect(titles).toHaveText(["Alpha low"]);

    await page.getByRole("link", { name: "Reset", exact: true }).click();
    await expect(titles).toHaveCount(3);
  });

  test("another user's task is not reachable", async ({ page, browser }) => {
    await signUp(page);
    await createTask(page, { title: "Secret" });
    await taskRow(page, "Secret").getByRole("link", { name: "Edit Secret" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("Secret");
    const editUrl = page.url();

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signUp(otherPage);
    await otherPage.goto(editUrl);
    await expect(otherPage.getByRole("heading", { name: "Not found" })).toBeVisible();
    await other.close();
  });
});
