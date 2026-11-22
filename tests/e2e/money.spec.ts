import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { signUp } from "./helpers";

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

/** Clicks a submit button and waits for its server action to finish. */
async function submit(page: Page, button: Locator) {
  const done = page.waitForResponse(
    (r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"]),
  );
  await button.click();
  await done;
}

test.describe("money", () => {
  test.use({ reducedMotion: "reduce" });

  test("income, expenses, transfer, borrow & lend, savings, budgets and the report add up", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await signUp(page);

    // ---- Defaults on first visit ----
    await page.goto("/money");
    await expect(page.getByTestId("balance-Cash")).toHaveText("৳0");
    await expect(page.getByTestId("balance-bKash")).toHaveText("৳0");
    await expect(page.getByTestId("balance-Bank")).toHaveText("৳0");

    // ---- Accounts & budgets: Cash starts with ৳1,000; Food gets a ৳500 budget ----
    await page.goto("/money/settings");
    await page.getByRole("button", { name: "Edit Cash" }).click();
    const cash = page.getByRole("form", { name: "Edit Cash" });
    await cash.getByLabel("Starting balance").fill("1000");
    await submit(page, cash.getByRole("button", { name: "Save" }));
    await expect(page.getByText("started with ৳1,000")).toBeVisible();
    await page.getByRole("button", { name: "Edit Food" }).click();
    const food = page.getByRole("form", { name: "Edit Food" });
    await food.getByLabel("Monthly budget (optional)").fill("500");
    await submit(page, food.getByRole("button", { name: "Save" }));
    await expect(page.getByText("৳500 / month")).toBeVisible();

    // ---- Quick add on the overview ----
    await page.goto("/money");
    const add = page.getByRole("form", { name: "Add money entry" });
    await add.getByRole("button", { name: "Income" }).click();
    await add.getByLabel("Amount").fill("20,000");
    await add.getByLabel("Into account").selectOption({ label: "Bank" });
    await submit(page, add.getByRole("button", { name: "Add income" }));

    await add.getByRole("button", { name: "Expense" }).click();
    await add.getByLabel("Amount").fill("450.50");
    await add.getByLabel("Category").selectOption({ label: "Food" });
    await add.getByLabel("Paid from").selectOption({ label: "Cash" });
    await add.getByLabel("Note (optional)").fill("groceries");
    await submit(page, add.getByRole("button", { name: "Add expense" }));

    await add.getByRole("button", { name: "Transfer" }).click();
    await add.getByLabel("Amount").fill("2000");
    await add.getByLabel("From account").selectOption({ label: "Bank" });
    await add.getByLabel("To account").selectOption({ label: "bKash" });
    await submit(page, add.getByRole("button", { name: "Add transfer" }));

    await page.reload();
    await expect(page.getByTestId("balance-Cash")).toHaveText("৳549.50");
    await expect(page.getByTestId("balance-Bank")).toHaveText("৳18,000");
    await expect(page.getByTestId("balance-bKash")).toHaveText("৳2,000");
    await expect(page.getByTestId("balance-total")).toHaveText("৳20,549.50");
    await expect(page.getByTestId("stat-net")).toHaveText("+৳19,549.50");
    // ৳450.50 of ৳500 = 90%: a warning, not yet over.
    await expect(page.getByTestId("budget-warning")).toHaveText("90% used: ৳49.50 left");

    // A transfer into the same account is refused.
    await add.getByRole("button", { name: "Transfer" }).click();
    await add.getByLabel("Amount").fill("10");
    await add.getByLabel("From account").selectOption({ label: "Cash" });
    await add.getByLabel("To account").selectOption({ label: "Cash" });
    await submit(page, add.getByRole("button", { name: "Add transfer" }));
    await expect(add.getByText("Pick a different account.")).toBeVisible();

    // ---- Borrow & lend ----
    await page.goto("/money/debts");
    const debt = page.getByRole("form", { name: "Add borrowed or lent money" });
    await debt.getByLabel("From whom").fill("Rahim");
    await debt.getByLabel("Amount").fill("5000");
    await debt.getByLabel("Into account").selectOption({ label: "Cash" });
    await submit(page, debt.getByRole("button", { name: "Add money I borrowed" }));
    await debt.getByRole("button", { name: "I lent" }).click();
    await debt.getByLabel("To whom").fill("Karim");
    await debt.getByLabel("Amount").fill("1000");
    await debt.getByLabel("From account").selectOption({ label: "bKash" });
    await submit(page, debt.getByRole("button", { name: "Add money I lent" }));
    await expect(page.getByTestId("stat-owe")).toHaveText("৳5,000");
    await expect(page.getByTestId("stat-owed")).toHaveText("৳1,000");

    // Part repayment: more than what's left is refused.
    await page.getByRole("button", { name: "Pay back Rahim" }).click();
    const repay = page.getByRole("form", { name: "Repayment for Rahim" });
    await repay.getByLabel("Amount").fill("6000");
    await submit(page, repay.getByRole("button", { name: "Record repayment" }));
    await expect(repay.getByText("That's more than what's left.")).toBeVisible();
    await repay.getByLabel("Amount").fill("2000");
    await repay.getByLabel("Paid from").selectOption({ label: "Cash" });
    await submit(page, repay.getByRole("button", { name: "Record repayment" }));
    const rahim = page.getByTestId("debt").filter({ hasText: "Rahim" });
    await expect(rahim.getByTestId("debt-left")).toHaveText("৳3,000 left");
    await expect(page.getByTestId("stat-owe")).toHaveText("৳3,000");

    // ---- Savings goal ----
    await page.goto("/money/savings");
    const goalForm = page.getByRole("form", { name: "Add a savings goal" });
    await goalForm.getByLabel("Goal").fill("Laptop");
    await goalForm.getByLabel("Target").fill("80000");
    await submit(page, goalForm.getByRole("button", { name: "Add goal" }));
    const move = page.getByRole("form", { name: "Move money for Laptop" });
    await move.getByLabel("Amount").fill("3000");
    await move.getByLabel("From account").selectOption({ label: "Bank" });
    await submit(page, move.getByRole("button", { name: "Add to Laptop" }));
    await expect(page.getByTestId("goal-saved")).toHaveText("৳3,000");
    // Taking out more than the goal holds is refused.
    await move.getByRole("button", { name: "Take out" }).click();
    await move.getByLabel("Amount").fill("5000");
    await submit(page, move.getByRole("button", { name: "Take out of Laptop" }));
    await expect(move.getByText("That's more than the goal holds.")).toBeVisible();

    // ---- Report: this month ----
    await page.goto("/money/report");
    await expect(page.getByTestId("stat-income")).toHaveText("৳20,000");
    await expect(page.getByTestId("stat-expense")).toHaveText("৳450.50");
    await expect(page.getByTestId("stat-net")).toHaveText("+৳19,549.50");
    await expect(page.getByTestId("stat-rate")).toHaveText("98%");
    await expect(page.getByTestId("stat-saved")).toHaveText("৳3,000");
    await expect(page.getByTestId("stat-borrowed")).toHaveText("৳5,000");
    await expect(page.getByTestId("stat-lent")).toHaveText("৳1,000");
    await expect(page.getByTestId("stat-owe")).toHaveText("৳3,000");
    await expect(page.getByTestId("stat-owed")).toHaveText("৳1,000");
    await expect(page.getByTestId("expense-category")).toHaveText(/Food.*৳450\.50.*100%/);
    // Cash 3,549.50 + bKash 1,000 + Bank 15,000.
    await expect(page.getByTestId("balance-total")).toHaveText("৳19,549.50");
    await expect(page.getByTestId("budget-row")).toContainText("৳450.50");

    // ---- Transactions: filter, then edit the expense past its budget ----
    await page.goto("/money/transactions");
    await expect(page.getByTestId("entry")).toHaveCount(7);
    const filter = page.getByRole("form", { name: "Filter transactions" });
    await filter.getByLabel("Type").selectOption({ label: "Expense" });
    await filter.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/kind=EXPENSE/);
    await expect(page.getByTestId("entry")).toHaveCount(1);
    await page.getByRole("button", { name: /^Edit Food/ }).click();
    const edit = page.getByRole("form", { name: "Edit entry" });
    await edit.getByLabel("Amount").fill("600");
    await submit(page, edit.getByRole("button", { name: "Save changes" }));
    await expect(page.getByTestId("entry-amount")).toHaveText("−৳600");

    await page.goto("/money");
    await expect(page.getByTestId("budget-warning")).toHaveText("Over budget by ৳100");

    // ---- Dashboard card ----
    await page.goto("/dashboard");
    await expect(page.getByTestId("money-income")).toHaveText("৳20,000");
    await expect(page.getByTestId("money-net")).toHaveText("+৳19,400");
    await expect(page.getByTestId("money-owe")).toHaveText("৳3,000");

    // ---- Accessibility in both themes ----
    for (const url of [
      "/money",
      "/money/transactions",
      "/money/debts",
      "/money/savings",
      "/money/report",
      "/money/report?range=year",
      "/money/settings",
    ]) {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((t) => {
          document.documentElement.classList.toggle("dark", t === "dark");
          document.documentElement.style.colorScheme = t;
        }, theme);
        await page.waitForTimeout(400);
        await scan(page, `${url} (${theme})`);
      }
    }
  });

  test("an opening balance set from Income moves the balance but is not income", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signUp(page);
    await page.goto("/money");
    const add = page.getByRole("form", { name: "Add money entry" });
    await add.getByRole("button", { name: "Income" }).click();
    await add.getByLabel("Category").selectOption({ label: "Opening balance" });
    await expect(add.getByText(/isn't counted as income/)).toBeVisible();
    await expect(add.getByLabel("Date")).toHaveCount(0);
    await add.getByLabel("Amount").fill("1,500.25");
    await add.getByLabel("Account").selectOption({ label: "bKash" });
    await submit(page, add.getByRole("button", { name: "Set opening balance" }));

    await page.reload();
    await expect(page.getByTestId("balance-bKash")).toHaveText("৳1,500.25");
    await expect(page.getByTestId("balance-total")).toHaveText("৳1,500.25");
    await expect(page.getByTestId("stat-income")).toHaveText("৳0");
    // No entry was created: it's the account's starting balance.
    await expect(
      page.getByText("Nothing yet. Add your first income or expense above."),
    ).toBeVisible();
    await page.goto("/money/settings");
    await expect(page.getByText("started with ৳1,500.25")).toBeVisible();
  });

  test("money pages fit a phone screen", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await signUp(page);
    for (const url of [
      "/money",
      "/money/transactions",
      "/money/debts",
      "/money/savings",
      "/money/report",
      "/money/settings",
    ]) {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${url} scrolls sideways`).toBeLessThanOrEqual(0);
    }
  });
});
