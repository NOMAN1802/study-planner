import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_PASSWORD, serverActionDone, signUp, uniqueEmail } from "./helpers";

/** The focused element must show a focus indicator (outline, or a ring on form fields). */
async function expectFocusIndicator(page: Page) {
  const visible = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    return outline || s.boxShadow !== "none";
  });
  expect(visible, "focused element has a visible focus indicator").toBe(true);
}

/** Presses Tab until `target` has focus. Nothing else moves focus: no mouse, no .focus(). */
async function tabTo(page: Page, target: Locator, max = 80) {
  await expect(target).toBeVisible();
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) {
      await expectFocusIndicator(page);
      return;
    }
  }
  throw new Error(`Tab never reached ${target}`);
}

test.describe("keyboard only", () => {
  test("sign up, track a habit, finish a task, plan a block and sign out without a mouse", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // ---- Sign up ----
    await page.goto("/signup");
    await tabTo(page, page.getByLabel("Email"));
    await page.keyboard.type(uniqueEmail("kbd"));
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();
    await page.keyboard.type(E2E_PASSWORD);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

    // ---- Skip link is the first stop and jumps past the navigation ----
    await page.reload();
    await expect(page.getByText("Nothing to track yet")).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();

    // ---- Habit: create and check in ----
    await tabTo(page, page.getByRole("link", { name: "Go to habits" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/habits$/);
    await tabTo(page, page.getByRole("link", { name: "Create your first habit" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/habits\/new$/);
    await tabTo(page, page.getByLabel("Name"));
    await page.keyboard.type("Walk");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/habits$/, { timeout: 30_000 });

    let saved = serverActionDone(page);
    await tabTo(page, page.getByRole("button", { name: "Check in Walk" }));
    await page.keyboard.press("Space");
    await saved;
    await expect(page.getByRole("button", { name: "Walk done today" })).toBeDisabled();
    await expect(page.getByTestId("current-streak")).toHaveText("1");

    // ---- Task: create and complete ----
    await tabTo(
      page,
      page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Tasks" }),
    );
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/tasks$/);
    await tabTo(page, page.getByRole("link", { name: "Create your first task" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/tasks\/new$/);
    await tabTo(page, page.getByLabel("Title"));
    await page.keyboard.type("Write tests");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/tasks$/, { timeout: 30_000 });

    saved = serverActionDone(page);
    await tabTo(page, page.getByRole("checkbox", { name: "Mark Write tests as done" }));
    await page.keyboard.press("Space");
    await saved;
    await expect(
      page.getByRole("checkbox", { name: "Mark Write tests as not done" }),
    ).toBeChecked();

    // ---- Planner: pick an item, then choose a slot ----
    await tabTo(
      page,
      page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Planner" }),
    );
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/planner/);
    await tabTo(page, page.getByRole("button", { name: "Schedule Walk" }));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Schedule Walk" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    saved = serverActionDone(page);
    await tabTo(page, page.getByRole("button", { name: /^Place Walk at / }).first(), 200);
    await page.keyboard.press("Enter");
    await saved;
    await expect(page.getByRole("button", { name: /^Walk, \d\d:\d\d–\d\d:\d\d/ })).toBeVisible();

    // ---- Theme and sign out ----
    await tabTo(page, page.getByRole("button", { name: "Switch to dark mode" }));
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await tabTo(page, page.getByRole("button", { name: "Sign out" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
  });

  test("the mobile menu opens, traps nothing, and closes from the keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await signUp(page);
    const nav = page.getByRole("navigation", { name: "Primary" });
    const menu = page.getByRole("button", { name: "Open menu" });

    // Closed: the off-screen links are not reachable.
    await expect(nav).toBeHidden();

    await tabTo(page, menu);
    await page.keyboard.press("Enter");
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeFocused();
    await expect(menu).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(nav).toBeHidden();

    await page.keyboard.press("Enter");
    await tabTo(page, nav.getByRole("link", { name: "Habits" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/habits$/);
    await expect(nav).toBeHidden();
  });
});
