import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/dashboard/panel";
import { EntryForm } from "@/components/money/forms";
import { BudgetList, EntryList, Stat, TotalsGrid } from "@/components/money/views";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { getMoneyOverview } from "@/lib/money-server";

export const metadata: Metadata = { title: "Money" };

const link = "font-medium text-accent hover:underline";

export default async function MoneyPage() {
  const user = await requireUser();
  const data = await getMoneyOverview(user);
  const alerts = data.budgets.filter((b) => b.state !== "ok");

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <section aria-labelledby="this-month" className="flex flex-col gap-2">
        <h2 id="this-month" className="font-display text-lg font-medium">
          This month
        </h2>
        <TotalsGrid t={data.month} />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel id="quick-add" title="Add" className="lg:col-span-3">
          <EntryForm accounts={data.accounts} categories={data.categories} today={data.today} />
        </Panel>

        <Panel
          id="accounts"
          title="Balances"
          className="lg:col-span-2"
          aside={
            <Link href="/money/settings" className={link}>
              Accounts
            </Link>
          }
        >
          <ul className="flex flex-col divide-y divide-border">
            {data.accounts
              .filter((a) => !a.archived)
              .map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{a.name}</span>
                  <span className="font-mono tabular-nums" data-testid={`balance-${a.name}`}>
                    {formatMoney(data.balances[a.id] ?? 0)}
                  </span>
                </li>
              ))}
            <li className="flex items-center justify-between py-2 text-sm font-medium">
              <span>Total</span>
              <span className="font-mono tabular-nums" data-testid="balance-total">
                {formatMoney(data.total)}
              </span>
            </li>
          </ul>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <Stat id="owe" label="You owe" value={formatMoney(data.debtTotals.owe)} />
            <Stat id="owed" label="Owed to you" value={formatMoney(data.debtTotals.owed)} />
          </dl>
          {data.debtTotals.overdue ? (
            <p className="mt-2 text-xs font-medium text-danger">
              {data.debtTotals.overdue} overdue —{" "}
              <Link href="/money/debts" className="underline">
                see Borrow &amp; Lend
              </Link>
            </p>
          ) : null}
        </Panel>
      </div>

      {alerts.length ? (
        <Panel
          id="budget-alerts"
          title="Budget warnings"
          aside={
            <Link href="/money/settings" className={link}>
              Budgets
            </Link>
          }
        >
          <BudgetList rows={alerts} />
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          id="recent"
          title="Latest"
          className="lg:col-span-3"
          aside={
            <Link href="/money/transactions" className={link}>
              All transactions
            </Link>
          }
        >
          {data.recent.length ? (
            <EntryList entries={data.recent} lookups={data} today={data.today} />
          ) : (
            <p className="text-sm text-fg-muted">
              Nothing yet. Add your first income or expense above.
            </p>
          )}
        </Panel>
        <Panel
          id="goals"
          title="Savings goals"
          className="lg:col-span-2"
          aside={
            <Link href="/money/savings" className={link}>
              Savings
            </Link>
          }
        >
          {data.goalList.length ? (
            <ul className="flex flex-col gap-3">
              {data.goalList.map((g) => (
                <li key={g.id} className="flex flex-col gap-1.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{g.name}</span>
                    <span className="font-mono text-xs tabular-nums">
                      {formatMoney(g.saved)}{" "}
                      <span className="text-fg-muted">of {formatMoney(g.targetMinor)}</span>
                    </span>
                  </div>
                  <span
                    className="block h-1.5 overflow-hidden rounded-full bg-surface-3"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{
                        width: `${Math.min(100, Math.round((g.saved / g.targetMinor) * 100))}%`,
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-muted">
              No goals yet.{" "}
              <Link href="/money/savings" className={link}>
                Add one
              </Link>
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
