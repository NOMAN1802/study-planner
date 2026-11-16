import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";
import { seedDashboard } from "./seed";

const SHOTS = process.env.SHOTS_DIR;

/** Every signed-in screen, reached the way a user would reach it. */
async function appRoutes(page: Page): Promise<{ name: string; url: string }[]> {
  await page.goto("/habits");
  await page.getByRole("link", { name: "Edit Read" }).click();
  await expect(page).toHaveURL(/\/habits\/[0-9a-f-]+\/edit$/);
  const habitEdit = new URL(page.url()).pathname;

  await page.goto("/tasks");
  await page.getByRole("link", { name: "Edit Ship report" }).click();
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+\/edit$/);
  const taskEdit = new URL(page.url()).pathname;

  return [
    { name: "dashboard", url: "/dashboard" },
    { name: "habits", url: "/habits" },
    { name: "habits-archived", url: "/habits?view=archived" },
    { name: "habit-new", url: "/habits/new" },
    { name: "habit-edit", url: habitEdit },
    { name: "tasks", url: "/tasks" },
    { name: "tasks-no-match", url: "/tasks?status=DONE&priority=URGENT" },
    { name: "task-new", url: "/tasks/new" },
    { name: "task-edit", url: taskEdit },
    { name: "task-focus", url: taskEdit.replace(/edit$/, "focus") },
    { name: "planner-day", url: "/planner?view=day" },
    { name: "planner-week", url: "/planner?view=week" },
    { name: "planner-month", url: "/planner?view=month" },
    { name: "settings", url: "/settings" },
    { name: "unknown-url", url: "/no-such-page" },
    { name: "not-found", url: "/habits/00000000-0000-4000-8000-000000000000/edit" },
  ];
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.style.colorScheme = t;
  }, theme);
  // Let colour transitions finish so contrast is measured on the final colours.
  await page.waitForTimeout(200);
}

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const found = results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    nodes: v.nodes
      .slice(0, 4)
      .map(
        (n) =>
          `${n.target.join(" ")} — ${(n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 220)}`,
      ),
  }));
  expect.soft(found, `axe violations on ${label}`).toEqual([]);
}

async function settle(page: Page) {
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
  // Charts measure their container after mount.
  await page.waitForTimeout(400);
}

test.describe("accessibility", () => {
  test.use({ reducedMotion: "reduce" });

  test("auth screens have no violations in light and dark", async ({ page }) => {
    for (const url of ["/login", "/signup"]) {
      await page.goto(url);
      await settle(page);
      for (const theme of ["light", "dark"] as const) {
        await setTheme(page, theme);
        await scan(page, `${url} (${theme})`);
      }
    }
    // Validation errors are part of the screen too.
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await scan(page, "/login with errors");
  });

  test("app screens have no violations in light and dark", async ({ page }) => {
    test.setTimeout(300_000);
    const email = await signUp(page);
    await settle(page);
    await scan(page, "empty dashboard");
    await page.goto("/habits");
    await settle(page);
    await scan(page, "empty habits");
    await page.goto("/tasks");
    await settle(page);
    await scan(page, "empty tasks");

    await seedDashboard(email);
    for (const route of await appRoutes(page)) {
      await page.goto(route.url);
      await settle(page);
      for (const theme of ["light", "dark"] as const) {
        await setTheme(page, theme);
        await scan(page, `${route.name} (${theme})`);
        if (SHOTS) {
          await page.screenshot({ path: `${SHOTS}/${route.name}-${theme}.png`, fullPage: true });
        }
      }
    }
  });

  test("every screen fits a 375px viewport without horizontal scrolling", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 375, height: 740 });
    for (const url of ["/login", "/signup"]) {
      await page.goto(url);
      await settle(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect.soft(overflow, `horizontal overflow on ${url}`).toBeLessThanOrEqual(0);
    }
    const email = await signUp(page);
    await seedDashboard(email);
    for (const route of await appRoutes(page)) {
      await page.goto(route.url);
      await settle(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect.soft(overflow, `horizontal overflow on ${route.name}`).toBeLessThanOrEqual(0);
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/${route.name}-mobile.png`, fullPage: true });
      }
    }
  });

  test("reduced motion: no entrance, transition or tween animation", async ({ page }) => {
    const email = await signUp(page);
    await seedDashboard(email);
    await page.reload();
    await expect(page.getByTestId("ring-daily")).toHaveText("1/2");

    const seconds = (value: string) => Math.max(...value.split(",").map((v) => parseFloat(v)));
    const enter = await page
      .getByTestId("panel-today")
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(seconds(enter)).toBeLessThanOrEqual(0.001);
    const hover = await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Habits" })
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(seconds(hover)).toBeLessThanOrEqual(0.001);

    // The ring must jump to its new value instead of sweeping through intermediate ones.
    const arc = page
      .getByRole("progressbar", { name: "Daily habits completed today" })
      .getByTestId("ring-arc");
    await arc.evaluate((el) => {
      const seen = new Set<string>();
      (window as unknown as { __arc: Set<string> }).__arc = seen;
      new MutationObserver(() => {
        seen.add(
          `${el.getAttribute("stroke-dashoffset")}|${(el as SVGElement).style.strokeDashoffset}`,
        );
      }).observe(el, { attributes: true });
    });
    await page.getByRole("button", { name: "Check in Read" }).click();
    await expect(page.getByTestId("ring-daily")).toHaveText("2/2");
    await page.waitForTimeout(500);
    const steps = await page.evaluate(
      () => (window as unknown as { __arc: Set<string> }).__arc.size,
    );
    expect(steps).toBeGreaterThanOrEqual(1);
    expect(steps).toBeLessThanOrEqual(2);
  });
});

test.describe("motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("entrance and ring animations run for 150–300ms and then stop", async ({ page }) => {
    const email = await signUp(page);
    await seedDashboard(email);
    await page.reload();
    await expect(page.getByTestId("ring-daily")).toHaveText("1/2");

    const panel = page.getByTestId("panel-today");
    const timing = await panel.evaluate((el) => {
      const s = getComputedStyle(el);
      return { duration: parseFloat(s.animationDuration), count: s.animationIterationCount };
    });
    expect(timing.duration).toBeGreaterThanOrEqual(0.15);
    expect(timing.duration).toBeLessThanOrEqual(0.3);
    expect(timing.count).toBe("1");

    // The ring sweeps through intermediate values when a check-in changes it.
    const arc = page
      .getByRole("progressbar", { name: "Daily habits completed today" })
      .getByTestId("ring-arc");
    await arc.evaluate((el) => {
      const seen = new Set<string>();
      (window as unknown as { __arc: Set<string> }).__arc = seen;
      new MutationObserver(() => {
        seen.add(
          `${el.getAttribute("stroke-dashoffset")}|${(el as SVGElement).style.strokeDashoffset}`,
        );
      }).observe(el, { attributes: true });
    });
    await page.getByRole("button", { name: "Check in Read" }).click();
    await expect(page.getByTestId("ring-daily")).toHaveText("2/2");
    await page.waitForTimeout(600);
    const steps = await page.evaluate(
      () => (window as unknown as { __arc: Set<string> }).__arc.size,
    );
    expect(steps).toBeGreaterThan(3);

    // Nothing keeps animating once the page has settled (no looping decoration).
    const running = await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === "running").length,
    );
    expect(running).toBe(0);
  });
});
