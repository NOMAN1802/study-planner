import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { serverActionDone, signUp, taskRow } from "./helpers";
import { seedQuestions } from "./seed";

/**
 * Today's study day in the browser (the account's timezone comes from the browser at
 * signup). Study days start at 18:00, so an evening belongs to the next date.
 */
async function browserToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    if (d.getHours() >= 18) d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("en-CA");
  });
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
    if (new Date(`${await browserToday(page)}T12:00:00Z`).getUTCDay() === 5)
      await expect(items.first()).toContainText("Vocabulary revision: this week's 60 words");
    else await expect(items.first()).toContainText("Words 1–10 · Vocabulary Marathon-1");
    await expect(items.nth(1)).toContainText("Lit 01: Literary Terms");
    await expect(page.getByTestId("ws-today-cycles")).toHaveText(/^0\/(8|16)$/);
    await expect(page.getByTestId("ws-week-cycles")).toHaveText("0/64");
    await expect(page.getByTestId("ws-buffer")).toHaveText(/^[+-]\d+$/);

    // Sections are pages in a sidebar dropdown under Study Station.
    const station = page.getByRole("button", { name: "Study Station" });
    await expect(station).toHaveAttribute("aria-expanded", "true");
    await station.click();
    await expect(page.getByRole("link", { name: "Routine", exact: true })).toBeHidden();
    await station.click();

    // Routine: 64 cycles a week.
    await page.getByRole("link", { name: "Routine", exact: true }).click();
    await expect(page).toHaveURL(/\/work-station\/routine$/);
    await expect(page.getByTestId("ws-routine-total")).toHaveText("64");
    await expect(page.getByTestId("ws-routine-day")).toHaveCount(7);

    // Subjects: 9 in order + daily vocabulary; mark a lecture done.
    await page.getByRole("link", { name: "Subjects", exact: true }).click();
    await expect(page.getByTestId("ws-subject")).toHaveCount(10);
    const english = subjectCard(page, "English Literature + Grammar");
    await expect(english.getByTestId("ws-subject-progress")).toHaveText("0/30");
    // One lecture per video: each part of a split video is its own lecture with one link.
    for (const [title, url] of [
      ["Grammar 1.1: Basic & Gerund Participle (Part-1)", "https://youtu.be/VPCPjHUP3FY"],
      ["Grammar 1.2: Basic & Gerund Participle (Part-2)", "https://youtu.be/3v6N-2270EU"],
    ]) {
      const topic = english.getByTestId("ws-topic").filter({ hasText: title });
      await expect(topic.getByRole("link", { name: /^Lecture/ })).toHaveAttribute("href", url);
    }
    // Each subject has a day-by-day routine: English starts on day 1 with its first lecture.
    const routine = english.getByTestId("ws-subject-routine");
    await routine.getByText("Day-by-day routine").click();
    const firstDay = routine.getByTestId("ws-subject-routine-day").first();
    await expect(firstDay).toContainText("Day 1");
    await expect(firstDay).toContainText("Lit 01: Literary Terms");
    await expect(routine.getByText("Subject final")).toBeVisible();
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
    await expect(page.getByText("87 learning + 14 revision days")).toBeVisible();
    // Start day and plan length can change without losing progress.
    const plan = page.getByRole("form", { name: "Plan settings" });
    const startDay = await plan.getByLabel("First study day").inputValue();
    const nextDay = new Date(Date.parse(`${startDay}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    await plan.getByLabel("First study day").fill(nextDay);
    await plan.getByLabel("Learning days").fill("85");
    await plan.getByLabel("Revision days").fill("15");
    const saved = serverActionDone(page);
    await plan.getByRole("button", { name: "Save plan" }).click();
    await saved;
    await expect(page.getByText("85 learning + 15 revision days")).toBeVisible();
    await expect(plan.getByLabel("First study day")).toHaveValue(nextDay);
    // Holidays: studied like a Friday.
    await plan.getByLabel("Holidays").fill("2026-12-16");
    await plan.getByRole("button", { name: "Add holiday" }).click();
    const savedHoliday = serverActionDone(page);
    await plan.getByRole("button", { name: "Save plan" }).click();
    await savedHoliday;
    await page.reload();
    await expect(
      page.getByRole("form", { name: "Plan settings" }).getByRole("list", { name: "Holiday list" }),
    ).toContainText("Wed 16 Dec");
    await expect(page.getByTestId("ws-lectures-done")).toHaveText("1/164");

    // Office: a task created here comes back here, and shows in Tasks with an Office tag.
    await page.getByRole("link", { name: "Office", exact: true }).click();
    await page.getByRole("link", { name: "New office task" }).click();
    await expect(page.getByRole("heading", { name: "New office task" })).toBeVisible();
    await page.getByLabel("Title").fill("Prepare budget sheet");
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page).toHaveURL(/\/work-station\/office$/, { timeout: 30_000 });
    await expect(taskRow(page, "Prepare budget sheet")).toBeVisible();
    await page.goto("/tasks");
    await expect(taskRow(page, "Prepare budget sheet")).toContainText("Office");
    // Subject timers are not listed as tasks.
    await expect(page.getByTestId("task-row")).toHaveCount(1);

    // Exams: record a weekly exam.
    await page.goto("/work-station/exams");
    const form = page.getByRole("form", { name: "Record exam" });
    await form.getByLabel("Exam").selectOption("WEEKLY");
    await form.getByLabel("Score").fill("40");
    await form.getByLabel("Out of").fill("50");
    await form.getByRole("button", { name: "Save result" }).click();
    await expect(page.getByTestId("ws-exam-score").first()).toHaveText("40/5080%");
  });

  test("a daily exam from the question bank: timed, marked, recorded", async ({ page }) => {
    test.setTimeout(120_000);
    const email = await signUp(page);
    await setUpPlan(page);
    await seedQuestions(email);

    // Nothing ticked done yet: no topics to take a real exam on.
    await page.goto("/work-station/exams");
    const real = page.getByTestId("exam-start-topics");
    await expect(real.getByRole("button", { name: "Start daily exam" })).toBeDisabled();
    // The Today tab's shortcut is locked too.
    await page.goto("/work-station");
    const todayExam = page.getByTestId("today-exam");
    await expect(todayExam.getByRole("button", { name: "Take today's exam" })).toBeDisabled();

    // Tick a lecture done: it becomes a topic, picked by default for today's exam.
    await page.goto("/work-station/subjects");
    const done = serverActionDone(page);
    await subjectCard(page, "English Literature + Grammar")
      .getByRole("checkbox", { name: "Mark Lit 01: Literary Terms as done" })
      .check();
    await done;
    await page.goto("/work-station");
    await expect(todayExam.getByTestId("today-exam-summary")).toHaveText(
      /\d+ questions · 15 min · from 1 lecture done today/,
    );
    await expect(todayExam.getByRole("button", { name: "Take today's exam" })).toBeEnabled();
    await page.goto("/work-station/exams");
    const topic = real.getByRole("checkbox", { name: /Lit 01: Literary Terms/ });
    await expect(topic).toBeChecked();
    await expect(real.getByTestId("exam-start-summary")).toHaveText(
      /\d+ questions · 15 min · real exam/,
    );
    // Untick it: nothing to ask. Tick it again and start.
    await topic.uncheck();
    await expect(real.getByRole("button", { name: "Start daily exam" })).toBeDisabled();
    await topic.check();
    await real.getByRole("button", { name: "Start daily exam" }).click();

    await expect(page).toHaveURL(/\/work-station\/exam\/[0-9a-f-]+$/, { timeout: 30_000 });
    await expect(page.getByTestId("exam-timer")).toHaveText(/1[45]:\d\d/);
    const questions = page.getByTestId("exam-question");
    const count = await questions.count();
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(20);

    // Answer the first question, reload: the choice is kept.
    await questions.first().getByRole("radio").first().check();
    await expect(page.getByTestId("exam-progress")).toContainText(`1/${count} answered`);
    await page.reload();
    await expect(questions.first().getByRole("radio").first()).toBeChecked();

    await page.getByRole("button", { name: "Submit answers" }).first().click();
    await expect(page.getByText(`${count - 1} left blank. Submit?`)).toBeVisible();
    await page.getByRole("button", { name: "Submit", exact: true }).click();

    // Marked straight away, with the right answers shown.
    await expect(page.getByTestId("exam-result-score")).toContainText(`/${count}`, {
      timeout: 30_000,
    });
    await expect(page.getByTestId("exam-review-question")).toHaveCount(count);
    await expect(page.getByLabel("Unanswered")).toHaveCount(count - 1);

    // Recorded under Exams, linking back to the review.
    await page.goto("/work-station/exams");
    const result = page.getByTestId("ws-exam").first();
    await expect(result).toContainText("Daily exam");
    await expect(result.getByTestId("ws-exam-score")).toContainText(`/${count}`);
    await result.getByTestId("ws-exam-open").click();
    await expect(page.getByTestId("exam-result-score")).toBeVisible();

    // The real exam reaches the dashboard.
    await page.goto("/dashboard");
    const panel = page.getByTestId("panel-exams");
    await expect(panel.getByTestId("exam-count")).toHaveText("1 real exam");
    await expect(panel.getByTestId("exam-recent")).toHaveCount(1);
    await expect(panel.getByTestId("exam-recent").first()).toContainText(`/${count}`);

    // Practice: same topic, checked as you go, not saved.
    await page.goto("/work-station/exams");
    const practice = page.getByTestId("practice-start");
    await expect(practice.getByRole("checkbox", { name: /Lit 01: Literary Terms/ })).toBeChecked();
    await practice.getByLabel("Questions").selectOption("10");
    await practice.getByRole("button", { name: "Start practice" }).click();
    await expect(page).toHaveURL(/\/work-station\/practice\?topic=[0-9a-f-]+&n=10$/);
    const first = page.getByTestId("practice-question").first();
    await first.getByRole("button").first().click();
    await expect(first.getByTestId("practice-feedback")).toHaveText(/^(Correct\.|Wrong — )/);
    await expect(page.getByTestId("practice-tally")).toContainText(/1 (correct|wrong)/);

    await page.goto("/dashboard");
    await expect(page.getByTestId("panel-exams").getByTestId("exam-count")).toHaveText(
      "1 real exam",
    );
  });

  test("a study cycle on a lecture counts toward today", async ({ page }) => {
    test.setTimeout(180_000);
    await signUp(page);
    await setUpPlan(page);

    await page.getByRole("link", { name: "Start Lit 01: Literary Terms" }).click();
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]+\/focus\?topic=[0-9a-f-]+$/);
    await expect(page.getByTestId("focus-topic")).toContainText("Lit 01: Literary Terms");
    await expect(page.getByRole("link", { name: "Study Station" }).first()).toBeVisible();

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
    await expect(page.getByTestId("ws-today-cycles")).toHaveText(/^1\/(8|16)$/);
    // The auto-started break is still running.
    await expect(page.getByRole("link", { name: "Open timer" })).toBeVisible();
    await page.goto("/work-station/subjects");
    await expect(
      subjectCard(page, "English Literature + Grammar")
        .getByTestId("ws-topic")
        .filter({ hasText: "Lit 01: Literary Terms" }),
    ).toContainText("1 cycle spent");

    await page.goto("/dashboard");
    await expect(page.getByTestId("study-today")).toHaveText(/^1\/(8|16)$/);
    await expect(page.getByTestId("study-week")).toHaveText("1/64");
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
      await page.goto(tab === "today" ? "/work-station" : `/work-station/${tab}`);
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
