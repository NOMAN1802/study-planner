import type { Metadata } from "next";
import { Panel } from "@/components/dashboard/panel";
import { AccountForm, AccountRow, CategoryForm, CategoryRow } from "@/components/money/forms";
import { requireUser } from "@/lib/auth";
import { getMoneySettings } from "@/lib/money-server";

export const metadata: Metadata = { title: "Accounts & budgets" };

export default async function MoneySettingsPage() {
  const user = await requireUser();
  const data = await getMoneySettings(user);
  const expense = data.categories.filter((c) => c.kind === "EXPENSE");
  const income = data.categories.filter((c) => c.kind === "INCOME");

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <Panel id="settings-accounts" title="Accounts">
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-border">
            {data.accounts.map((a) => (
              <li key={a.id} className="py-2">
                <AccountRow account={a} />
              </li>
            ))}
          </ul>
          <AccountForm />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel id="settings-expense" title="Expense categories and monthly budgets">
          <div className="flex flex-col gap-4">
            <p className="text-xs text-fg-muted">
              With a budget, Money warns at 80% of it and when you go over.
            </p>
            <ul className="flex flex-col divide-y divide-border">
              {expense.map((c) => (
                <li key={c.id} className="py-2">
                  <CategoryRow category={c} />
                </li>
              ))}
            </ul>
            <CategoryForm kind="EXPENSE" />
          </div>
        </Panel>
        <Panel id="settings-income" title="Income sources">
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col divide-y divide-border">
              {income.map((c) => (
                <li key={c.id} className="py-2">
                  <CategoryRow category={c} />
                </li>
              ))}
            </ul>
            <CategoryForm kind="INCOME" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
