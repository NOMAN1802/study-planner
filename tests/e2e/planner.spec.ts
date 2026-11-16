import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHabit, createTask, serverActionDone, signUp } from "./helpers";

// Tall viewport so the whole working day is on screen for pointer drags.
test.use({ viewport: { width: 1280, height: 1400 } });

const HOUR_PX = 48;
const DAY = "2030-01-15"; // a Tuesday
const block = (page: Page, name: RegExp | string) =>
  page.getByRole("button", { name }).and(page.getByTestId("planner-block"));
const paletteItem = (page: Page, title: string) =>
  page.getByTestId("palette-item").filter({ has: page.getByText(title, { exact: true }) });

async function dropAt(page: Page, item: Locator, column: Locator, hour: number) {
  const done = serverActionDone(page);
  await item.dragTo(column, { targetPosition: { x: 30, y: hour * HOUR_PX + 2 } });
  await done;
  await settled(page);
}

/** The optimistic block is swapped for the saved one; wait until that has happened. */
async function settled(page: Page) {
  await expect(page.locator('[data-testid="planner-block"][data-block-id^="temp-"]')).toHaveCount(
    0,
  );
}

test.describe("planner", () => {
  test("drag a task into the day view; it persists and renders in day, week and month views", async ({
    page,
  }) => {
    await signUp(page);
    await createTask(page, { title: "Write report", targetMinutes: 90 });

    await page.goto(`/planner?view=day&date=${DAY}`);
    await expect(page.getByTestId("planner-range")).toHaveText("Tuesday 15 January 2030");
    await expect(page.getByText("Nothing planned in this day.")).toBeVisible();

    await dropAt(
      page,
      paletteItem(page, "Write report"),
      page.getByTestId(`day-column-${DAY}`),
      10,
    );
    await expect(block(page, "Write report, 10:00–11:30")).toBeVisible();

    // Persists across reload.
    await page.reload();
    await expect(block(page, "Write report, 10:00–11:30")).toBeVisible();

    // Week view: in Tuesday's column.
    await page.getByRole("link", { name: "week" }).click();
    await expect(page.getByTestId("planner-range")).toHaveText("14 – 20 Jan 2030");
    await expect(
      page.getByTestId(`day-column-${DAY}`).getByTestId("planner-block"),
    ).toHaveAccessibleName("Write report, 10:00–11:30");
    await expect(
      page.getByTestId("day-column-2030-01-16").getByTestId("planner-block"),
    ).toHaveCount(0);

    // Month view: a chip on the 15th.
    await page.getByRole("link", { name: "month" }).click();
    await expect(page.getByTestId("planner-range")).toHaveText("January 2030");
    await expect(
      page.getByTestId(`month-cell-${DAY}`).getByTestId("planner-block"),
    ).toHaveAccessibleName("Write report, 10:00–11:30");
    await expect(page.getByTestId("planner-block")).toHaveCount(1);
  });

  test("move and resize by pointer, then flag and resolve overlaps from the keyboard", async ({
    page,
  }) => {
    await signUp(page);
    await createTask(page, { title: "Write report" });
    await createHabit(page, { name: "Read", targetMinutes: 30 });
    await page.goto(`/planner?view=day&date=${DAY}`);
    const column = page.getByTestId(`day-column-${DAY}`);

    await dropAt(page, paletteItem(page, "Write report"), column, 9);
    const task = block(page, /^Write report, /);
    await expect(task).toHaveAccessibleName("Write report, 09:00–10:00");

    // Pointer move: down by 1h15m.
    let saved = serverActionDone(page);
    const box = (await task.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 10 + 1.25 * HOUR_PX, { steps: 8 });
    await page.mouse.up();
    await saved;
    await expect(task).toHaveAccessibleName("Write report, 10:15–11:15");

    // Pointer resize: drag the bottom edge down 30 minutes.
    saved = serverActionDone(page);
    const handle = task.getByTestId("resize-handle");
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 0.5 * HOUR_PX, { steps: 6 });
    await page.mouse.up();
    await saved;
    await expect(task).toHaveAccessibleName("Write report, 10:15–11:45");

    // Place a habit with the keyboard-friendly path: pick, then choose a slot.
    await page.getByRole("button", { name: "Schedule Read" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Choose a slot for" })).toBeVisible();
    saved = serverActionDone(page);
    await page.getByRole("button", { name: "Place Read at 11:00" }).click();
    await saved;
    await settled(page);
    const habit = block(page, /^Read, /);
    await expect(habit).toHaveAccessibleName("Read, 11:00–11:30, overlaps another block");
    await expect(task).toHaveAccessibleName("Write report, 10:15–11:45, overlaps another block");
    await expect(page.getByText("2 blocks · 2 overlapping")).toBeVisible();

    // Keyboard: move the habit 45 minutes later, which clears the overlap…
    await habit.focus();
    for (let i = 0; i < 3; i += 1) {
      saved = serverActionDone(page);
      await page.keyboard.press("ArrowDown");
      await saved;
    }
    await expect(habit).toHaveAccessibleName("Read, 11:45–12:15");
    await expect(task).toHaveAccessibleName("Write report, 10:15–11:45");
    // …then Shift+ArrowDown lengthens it.
    saved = serverActionDone(page);
    await page.keyboard.press("Shift+ArrowDown");
    await saved;
    await expect(habit).toHaveAccessibleName("Read, 11:45–12:30");

    await page.reload();
    await expect(block(page, /^Read, /)).toHaveAccessibleName("Read, 11:45–12:30");
    await expect(block(page, /^Write report, /)).toHaveAccessibleName("Write report, 10:15–11:45");

    // Delete from the details panel.
    await block(page, /^Read, /).click();
    await expect(page.getByTestId("block-details")).toContainText("Read");
    saved = serverActionDone(page);
    await page.getByRole("button", { name: "Delete block" }).click();
    await saved;
    await page.reload();
    await expect(page.getByTestId("planner-block")).toHaveCount(1);
  });

  test("week view: drag across days; month view: move a chip to another day keeping its time", async ({
    page,
  }) => {
    await signUp(page);
    await createTask(page, { title: "Plan sprint" });
    await page.goto(`/planner?view=week&date=${DAY}`);

    await dropAt(page, paletteItem(page, "Plan sprint"), page.getByTestId(`day-column-${DAY}`), 14);
    const task = block(page, /^Plan sprint, /);
    await expect(page.getByTestId(`day-column-${DAY}`).getByTestId("planner-block")).toHaveCount(1);

    // Pointer drag one column to the right (Wednesday), same time.
    const saved = serverActionDone(page);
    const from = (await task.boundingBox())!;
    const wed = (await page.getByTestId("day-column-2030-01-16").boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + 10);
    await page.mouse.down();
    await page.mouse.move(wed.x + wed.width / 2, from.y + 10, { steps: 8 });
    await page.mouse.up();
    await saved;
    await expect(
      page.getByTestId("day-column-2030-01-16").getByTestId("planner-block"),
    ).toHaveAccessibleName("Plan sprint, 14:00–15:00");

    // Month view: drag the chip from the 16th to the 20th.
    await page.getByRole("link", { name: "month" }).click();
    const moved = serverActionDone(page);
    await page
      .getByTestId("month-cell-2030-01-16")
      .getByTestId("planner-block")
      .dragTo(page.getByTestId("month-cell-2030-01-20"));
    await moved;
    await page.reload();
    await expect(
      page.getByTestId("month-cell-2030-01-20").getByTestId("planner-block"),
    ).toHaveAccessibleName("Plan sprint, 14:00–15:00");
    await expect(
      page.getByTestId("month-cell-2030-01-16").getByTestId("planner-block"),
    ).toHaveCount(0);
  });
});
