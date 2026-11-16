import { expect, type Page } from "@playwright/test";

export const E2E_PASSWORD = "e2e-password-123";

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Creates a fresh account and lands on the dashboard. */
export async function signUp(page: Page, email = uniqueEmail()) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  return email;
}

type NewHabit = {
  name: string;
  frequency?: "Hourly" | "Daily" | "Weekly" | "Monthly";
  targetCount?: number;
  targetMinutes?: number;
};

export async function createHabit(page: Page, habit: NewHabit) {
  await page.goto("/habits/new");
  await page.getByLabel("Name").fill(habit.name);
  if (habit.frequency) await page.getByText(habit.frequency, { exact: true }).click();
  if (habit.targetCount)
    await page.getByLabel("Target count per period").fill(String(habit.targetCount));
  if (habit.targetMinutes)
    await page.getByLabel("Target minutes per period").fill(String(habit.targetMinutes));
  await page.getByRole("button", { name: "Create habit" }).click();
  await expect(page).toHaveURL(/\/habits$/, { timeout: 30_000 });
  await expect(habitRow(page, habit.name)).toBeVisible();
}

export function habitRow(page: Page, name: string) {
  return page
    .getByTestId("habit-row")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

type NewTask = {
  title: string;
  priority?: "Low" | "Medium" | "High" | "Urgent";
  due?: string; // datetime-local value
  targetMinutes?: number;
  habit?: string;
  note?: string;
};

export async function createTask(page: Page, task: NewTask) {
  await page.goto("/tasks/new");
  await page.getByLabel("Title").fill(task.title);
  if (task.priority) await page.getByText(task.priority, { exact: true }).click();
  if (task.due) await page.getByLabel("Due").fill(task.due);
  if (task.targetMinutes) await page.getByLabel("Target minutes").fill(String(task.targetMinutes));
  if (task.habit) await page.getByLabel("Linked habit").selectOption({ label: task.habit });
  if (task.note) await page.getByLabel("Note").fill(task.note);
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page).toHaveURL(/\/tasks$/, { timeout: 30_000 });
  await expect(taskRow(page, task.title)).toBeVisible();
}

export function taskRow(page: Page, title: string) {
  return page
    .getByTestId("task-row")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

/**
 * Resolves when the next server action POST completes. Start it *before* the
 * click that triggers the action; await it before reloading or navigating,
 * otherwise the in-flight request can be cancelled.
 */
export function serverActionDone(page: Page) {
  return page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
  );
}
