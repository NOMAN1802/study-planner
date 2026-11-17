import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { serverActionDone, signUp, taskRow } from "./helpers";

/** Today's date in the browser (the account's timezone comes from the browser at signup). */
async function browserToday(page: Page): Promise<string> {
  return page.evaluate(() => new Date().toLocaleDateString("en-CA"));
}

async function setUpPlan(page: Page) {
  await page.goto("/work-station");
  await expect(page.getByRole("heading", { name: "Set up your BCS study plan" })).toBeVisible();
  await expect(page.getByText("164 lectures")).toBeVisible();
  await page.getByLabel("First study day").fill(await browserToday(page));
  await page.getByRole("button", { name: "Create study plan" }).click();
  await expect(page.getByRole("heading", { name: "BCS Preliminary" })).toBeVisible({
    timeout: 30_000,
  });
}

function subjectCard(page: Page, name: string) {
  return page.getByTestId("ws-subject").filter({ hasText: name });
}

test.describe("work-station", () => {
  test("sets up the BCS plan, tracks lectures, office tasks, routine and exams", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await signUp(page);
    await setUpPlan(page);

    // Today: vocabulary first, then the first English lectures.
    await expect(page.getByRole("heading", { name: "Up next today" })).toBeVisible();
    const items = page.getByTestId("ws-item");
    // Vocabulary: 10 new words Saturday–Thursday, the week's revision on Friday.
    if (new Date().getDay() === 5)
      await expect(items.first()).toContainText("Vocabulary revision: this week's 60 words");
    else await expect(items.first()).toContainText("Words 1–10 · Vocabulary 1.1 (Part-1)");
    await expect(items.nth(1)).toContainText("Lit 01: Literary Terms");
    await expect(page.getByTestId("ws-today-cycles")).toHaveText(/^0\/(7|14)$/);
    await expect(page.getByTestId("ws-week-cycles")).toHaveText("0/56");
    await expect(page.getByTestId("ws-buffer")).toHaveText(/^\+\d+$/);

    // Routine: 56 cycles a week.
    await page.getByRole("link", { name: "Routine", exact: true }).click();
    await expect(page.getByTestId("ws-routine-total")).toHaveText("56");
    await expect(page.getByTestId("ws-routine-day")).toHaveCount(7);

    // Subjects: 9 in order + daily vocabulary; mark a lecture done.
    await page.getByRole("link", { name: "Subjects", exact: true }).click();
    await expect(page.getByTestId("ws-subject")).toHaveCount(10);
    const english = subjectCard(page, "English Literature + Grammar");
    await expect(english.getByTestId("ws-subject-progress")).toHaveText("0/30");
    const done = serverActionDone(page);
    await english.getByRole("checkbox", { name: "Mark Lit 01: Literary Terms as done" }).check();
    await done;
    await page.reload();
    await expect(
      subjectCard(page, "English Literature + Grammar").getByTestId("ws-subject-progress"),
    ).toHaveText("1/30");

    // Plan: lecture count and subject order.
    await page.getByRole("link", { name: "Plan", exact: true }).click();
    await expect(page.getByTestId("ws-lectures-done")).toHaveText("1/164");
    await expect(page.getByTestId("ws-plan-subject").first()).toContainText(
      "English Literature + Grammar",
    );
    await expect(page.getByTestId("ws-plan-subject").nth(2)).toContainText("Math + Mental Ability");
    await expect(page.getByText("75 learning + 25 revision days")).toBeVisible();
    // Plan length can change without losing progress.
    const plan = page.getByRole("form", { name: "Plan length" });
    await plan.getByLabel("Learning days").fill("80");
    await plan.getByLabel("Revision days").fill("20");
    const saved = serverActionDone(page);
    await plan.getByRole("button", { name: "Save plan length" }).click();
    await saved;
    await expect(page.getByText("80 learning + 20 revision days")).toBeVisible();
    await expect(page.getByTestId("ws-lectures-done")).toHaveText("1/164");

    // Office: a task created here comes back here, and shows in Tasks with an Office tag.
    await page.getByRole("link", { name: "Office", exact: true }).click();
    await page.getByRole("link", { name: "New office task" }).click();
    await expect(page.getByRole("heading", { name: "New office task" })).toBeVisible();
    await page.getByLabel("Title").fill("Prepare budget sheet");
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page).toHaveURL(/\/work-station\?tab=office$/, { timeout: 30_000 });
    await expect(taskRow(page, "Prepare budget sheet")).toBeVisible();
    await page.goto("/tasks");
    await expect(taskRow(page, "Prepare budget sheet")).toContainText("Office");
    // Subject timers are not listed as tasks.
    await expect(page.getByTestId("task-row")).toHaveCount(1);

    // Exams: record a weekly exam.
    await page.goto("/work-station?tab=exams");
    const form = page.getByRole("form", { name: "Record exam" });
    await form.getByLabel("Exam").selectOption("WEEKLY");
    await form.getByLabel("Score").fill("40");
    await form.getByLabel("Out of").fill("50");
    await form.getByRole("button", { name: "Save result" }).click();
    await expect(page.getByTestId("ws-exam-score").first()).toHaveText("40/5080%");
  });

  test("a study cycle on a lecture counts toward today", async ({ page }) => {
    test.setTimeout(180_000);
    await signUp(page);
    await setUpPlan(page);

    await page.getByRole("link", { name: "Start Lit 01: Literary Terms" }).click();
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+\/focus\?topic=[0-9a-f-]+$/);
    await expect(page.getByTestId("focus-topic")).toContainText("Lit 01: Literary Terms");
    await expect(page.getByRole("link", { name: "Work-Station" }).first()).toBeVisible();

    // The subject timer is pre-set to 50/10; shorten it for the test.
    const settings = page.getByRole("form", { name: "Timer settings" });
    await expect(settings.getByLabel("Focus (min)")).toHaveValue("50");
    await expect(settings.getByLabel("Short break (min)")).toHaveValue("10");
    await settings.getByLabel("Focus (min)").fill("1");
    await settings.getByRole("button", { name: "Save timer settings" }).click();
    await expect(settings.getByRole("status")).toHaveText(/Saved/);

    await page.getByRole("button", { name: "Start focus" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    // Auto-start is on, so the break begins by itself when focus ends.
    await expect(page.getByTestId("timer-phase")).toHaveText(/Short break/, { timeout: 80_000 });

    await page.goto("/work-station");
    await expect(page.getByTestId("ws-today-cycles")).toHaveText(/^1\/(7|14)$/);
    // The auto-started break is still running.
    await expect(page.getByRole("link", { name: "Open timer" })).toBeVisible();
    await page.goto("/work-station?tab=subjects");
    await expect(
      subjectCard(page, "English Literature + Grammar")
        .getByTestId("ws-topic")
        .filter({ hasText: "Lit 01: Literary Terms" }),
    ).toContainText("1 cycle spent");

    await page.goto("/dashboard");
    await expect(page.getByTestId("study-today")).toHaveText(/^1\/(7|14)$/);
    await expect(page.getByTestId("study-week")).toHaveText("1/56");
  });
});

test.describe("work-station accessibility", () => {
  test.use({ reducedMotion: "reduce" });

  test("every tab has no accessibility violations in light and dark", async ({ page }) => {
    test.setTimeout(150_000);
    await signUp(page);
    await page.goto("/work-station");
    await expect(page.getByRole("heading", { name: "Set up your BCS study plan" })).toBeVisible();
    await page.waitForTimeout(300);
    await scan(page, "work-station setup");
    await setUpPlan(page);
    for (const tab of ["today", "plan", "subjects", "exams", "office", "routine"]) {
      await page.goto(tab === "today" ? "/work-station" : `/work-station?tab=${tab}`);
      await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((t) => {
          document.documentElement.classList.toggle("dark", t === "dark");
          document.documentElement.style.colorScheme = t;
        }, theme);
        await page.waitForTimeout(300);
        await scan(page, `work-station ${tab} (${theme})`);
      }
    }
  });
});

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
