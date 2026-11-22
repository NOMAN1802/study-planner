import { Panel } from "@/components/dashboard/panel";
import {
  ArchiveToggle,
  DeleteDebtButton,
  EntryRow,
  GoalEditor,
  GoalMoveForm,
  RepayForm,
} from "@/components/money/forms";
import { IncomeExpenseChart } from "@/components/money/money-chart";
import { formatDay } from "@/lib/daily-habits";
import {
  change,
  formatMoney,
  type BudgetRow,
  type CategoryShare,
  type Entry,
  type Totals,
} from "@/lib/money";
import type {
  MoneyAccount,
  MoneyDebt,
  MoneyGoal,
  MoneyLookups,
  getMoneyReport,
} from "@/lib/money-server";
import { cn } from "@/lib/utils";

type Tone = "in" | "out" | "move";

/** Title, detail line and signed amount of an entry. */
export function describeEntry(e: Entry, l: MoneyLookups) {
  const account = l.accounts.find((a) => a.id === e.accountId)?.name ?? "Account";
  const to = l.accounts.find((a) => a.id === e.toAccountId)?.name ?? "Account";
  const category = l.categories.find((c) => c.id === e.categoryId);
  const debt = e.debtId ? l.debts[e.debtId] : undefined;
  const goal = e.goalId ? l.goals[e.goalId] : undefined;
  let title = "";
  let tone: Tone = "move";
  switch (e.kind) {
    case "INCOME":
      title = category?.name ?? "Income";
      tone = "in";
      break;
    case "EXPENSE":
      title = category?.name ?? "Expense";
      tone = "out";
      break;
    case "TRANSFER":
      title = `${account} → ${to}`;
      break;
    case "BORROW":
      title = `Borrowed from ${debt?.person ?? "someone"}`;
      tone = "in";
      break;
    case "LEND":
      title = `Lent to ${debt?.person ?? "someone"}`;
      tone = "out";
      break;
    case "REPAY":
      if (debt?.direction === "LENT") {
        title = `${debt.person} paid back`;
        tone = "in";
      } else {
        title = `Paid back ${debt?.person ?? "someone"}`;
        tone = "out";
      }
      break;
    case "SAVE":
      title = `To ${goal ?? "savings"}`;
      break;
    case "WITHDRAW":
      title = `From ${goal ?? "savings"}`;
      break;
  }
  const where =
    e.kind === "TRANSFER"
      ? "Transfer"
      : e.kind === "SAVE"
        ? `from ${account}`
        : e.kind === "WITHDRAW"
          ? `into ${account}`
          : account;
  const sub = [where, e.note].filter(Boolean).join(" · ");
  const amount =
    tone === "in"
      ? formatMoney(e.amountMinor, { sign: true })
      : tone === "out"
        ? formatMoney(-e.amountMinor)
        : formatMoney(e.amountMinor);
  return { title, sub, amount, tone, color: category?.color };
}

function Amount({ value, tone }: { value: string; tone: Tone }) {
  return (
    <span
      className={cn(
        "shrink-0 font-mono text-sm tabular-nums",
        tone === "in" ? "text-accent" : tone === "out" ? "text-fg" : "text-fg-muted",
      )}
      data-testid="entry-amount"
    >
      {value}
    </span>
  );
}

/** Entries grouped by day, newest first, each day with its income − expense. */
export function EntryList({
  entries,
  lookups,
  today,
  editable = true,
}: {
  entries: Entry[];
  lookups: MoneyLookups;
  today: string;
  editable?: boolean;
}) {
  const days = new Map<string, Entry[]>();
  for (const e of entries) days.set(e.day, [...(days.get(e.day) ?? []), e]);
  return (
    <div className="flex flex-col gap-4">
      {[...days.entries()].map(([day, list]) => {
        const net = list.reduce(
          (n, e) =>
            n + (e.kind === "INCOME" ? e.amountMinor : e.kind === "EXPENSE" ? -e.amountMinor : 0),
          0,
        );
        return (
          <section key={day} aria-label={formatDay(day)} data-testid="entry-day">
            <header className="flex items-baseline justify-between px-1 pb-1.5 text-xs text-fg-muted">
              <h3 className="font-medium">{day === today ? "Today" : formatDay(day)}</h3>
              {net !== 0 ? (
                <span className="font-mono tabular-nums">{formatMoney(net, { sign: true })}</span>
              ) : null}
            </header>
            <ul className="flex flex-col divide-y divide-border rounded-sm border border-border bg-surface">
              {list.map((e) => {
                const d = describeEntry(e, lookups);
                const body = (
                  <div className="flex items-center gap-3">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: d.color ?? "var(--border-strong)" }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{d.title}</p>
                      <p className="truncate text-xs text-fg-muted">{d.sub}</p>
                    </div>
                    <Amount value={d.amount} tone={d.tone} />
                  </div>
                );
                return (
                  <li key={e.id} className="px-3 py-2 sm:px-4" data-testid="entry">
                    {editable ? (
                      <EntryRow
                        entry={e}
                        label={`${d.title} ${d.amount}`}
                        accounts={lookups.accounts}
                        categories={lookups.categories}
                        today={today}
                      >
                        {body}
                      </EntryRow>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function Stat({
  id,
  label,
  value,
  hint,
  tone,
}: {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-border bg-surface p-4">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd
        className={cn(
          "font-mono text-xl font-medium tabular-nums",
          tone === "good" ? "text-accent" : tone === "bad" ? "text-danger" : "text-fg",
        )}
        data-testid={`stat-${id}`}
      >
        {value}
      </dd>
      {hint ? <dd className="text-xs text-fg-muted">{hint}</dd> : null}
    </div>
  );
}

function Meter({ pct, state }: { pct: number; state?: BudgetRow["state"] }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
      <span
        className={cn(
          "block h-full rounded-full",
          state === "over" ? "bg-danger" : state === "warn" ? "bg-warning" : "bg-accent",
        )}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </span>
  );
}

/** Spending against each monthly budget, with warnings near and over the limit. */
export function BudgetList({ rows }: { rows: BudgetRow[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((b) => (
        <li key={b.categoryId} className="flex flex-col gap-1.5" data-testid="budget-row">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-fg">{b.name}</span>
            <span className="font-mono text-xs tabular-nums">
              {formatMoney(b.spent)}{" "}
              <span className="text-fg-muted">of {formatMoney(b.budget)}</span>
            </span>
          </div>
          <Meter pct={b.pct} state={b.state} />
          {b.state !== "ok" ? (
            <p
              className={cn("text-xs", b.state === "over" ? "text-danger" : "text-warning")}
              data-testid="budget-warning"
            >
              {b.state === "over"
                ? `Over budget by ${formatMoney(b.spent - b.budget)}`
                : `${b.pct}% used: ${formatMoney(b.budget - b.spent)} left`}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Debts of one direction, with what's left, repayments and the repay form. */
export function DebtList({
  debts,
  accounts,
  today,
}: {
  debts: MoneyDebt[];
  accounts: readonly MoneyAccount[];
  today: string;
}) {
  if (debts.length === 0) {
    return <p className="text-sm text-fg-muted">Nothing here.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {debts.map((d) => {
        const pct = Math.round((d.status.repaid / d.amountMinor) * 100);
        return (
          <li
            key={d.id}
            className="flex flex-col gap-2 rounded-sm border border-border bg-surface p-3 sm:p-4"
            data-testid="debt"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{d.person}</p>
                <p className="text-xs text-fg-muted">
                  {formatMoney(d.amountMinor)} on {formatDay(d.day)}
                  {d.dueDay ? ` · due ${formatDay(d.dueDay)}` : ""}
                  {d.note ? ` · ${d.note}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm tabular-nums" data-testid="debt-left">
                  {d.status.settled ? "Settled" : `${formatMoney(d.status.remaining)} left`}
                </p>
                {d.status.overdue ? (
                  <p className="text-xs font-medium text-danger">Overdue</p>
                ) : null}
              </div>
              <DeleteDebtButton id={d.id} person={d.person} />
            </div>
            <Meter pct={pct} />
            {d.repayments.length ? (
              <p className="text-xs text-fg-muted">
                Repaid:{" "}
                {d.repayments
                  .map((r) => `${formatMoney(r.amountMinor)} (${formatDay(r.day)})`)
                  .join(", ")}
              </p>
            ) : null}
            {d.status.settled ? null : (
              <div>
                <RepayForm
                  debtId={d.id}
                  person={d.person}
                  direction={d.direction}
                  remaining={d.status.remaining}
                  accounts={accounts}
                  today={today}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Savings goals with progress, monthly amount needed, and add / take out. */
export function GoalCards({
  goals,
  accounts,
  today,
}: {
  goals: MoneyGoal[];
  accounts: readonly MoneyAccount[];
  today: string;
}) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {goals.map((g) => {
        const pct = Math.round((g.saved / g.targetMinor) * 100);
        return (
          <li
            key={g.id}
            className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4"
            data-testid="goal"
          >
            <GoalEditor goal={g} today={today}>
              <p className="text-sm font-medium text-fg">
                {g.name}
                {g.archived ? " (archived)" : ""}
              </p>
              <p className="text-xs text-fg-muted">
                Target {formatMoney(g.targetMinor)}
                {g.targetDay ? ` by ${formatDay(g.targetDay)}` : ""}
              </p>
            </GoalEditor>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-xl font-medium tabular-nums" data-testid="goal-saved">
                {formatMoney(g.saved)}
              </span>
              <span className="text-sm text-fg-muted">{Math.min(pct, 100)}%</span>
            </div>
            <Meter pct={pct} />
            <p className="text-xs text-fg-muted">
              {g.saved >= g.targetMinor
                ? "Reached."
                : g.monthly !== null
                  ? `${formatMoney(g.monthly)} a month to reach it on time · ${formatMoney(g.targetMinor - g.saved)} to go`
                  : `${formatMoney(g.targetMinor - g.saved)} to go`}
            </p>
            {g.archived ? null : (
              <GoalMoveForm
                goalId={g.id}
                goalName={g.name}
                saved={g.saved}
                accounts={accounts}
                today={today}
              />
            )}
            <div className="flex justify-end">
              <ArchiveToggle what="goal" id={g.id} name={g.name} archived={g.archived} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ShareList({ rows, testId }: { rows: CategoryShare[]; testId: string }) {
  if (rows.length === 0) return <p className="text-sm text-fg-muted">Nothing in this range.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li
          key={r.categoryId ?? "none"}
          className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_auto]"
          data-testid={testId}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: r.color }}
              aria-hidden
            />
            <span className="truncate">{r.name}</span>
          </span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <span className="block h-full rounded-full bg-accent" style={{ width: `${r.pct}%` }} />
          </span>
          <span className="text-right font-mono text-xs whitespace-nowrap tabular-nums">
            {formatMoney(r.amount)} <span className="text-fg-muted">{r.pct}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function vs(now: number, before: number) {
  const c = change(now, before);
  return c === null ? undefined : `${c > 0 ? "+" : ""}${c}% vs previous`;
}

/** Income, expense, net and savings rate (with change vs a previous range). */
export function TotalsGrid({ t, previous }: { t: Totals; previous?: Totals }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        id="income"
        label="Income"
        value={formatMoney(t.income)}
        hint={previous ? vs(t.income, previous.income) : undefined}
      />
      <Stat
        id="expense"
        label="Expense"
        value={formatMoney(t.expense)}
        hint={previous ? vs(t.expense, previous.expense) : undefined}
      />
      <Stat
        id="net"
        label="Net"
        value={formatMoney(t.net, { sign: true })}
        hint="income − expense"
        tone={t.net > 0 ? "good" : t.net < 0 ? "bad" : undefined}
      />
      <Stat
        id="rate"
        label="Savings rate"
        value={t.savingsRate === null ? "–" : `${t.savingsRate}%`}
        hint="net ÷ income"
      />
    </dl>
  );
}

type Report = Awaited<ReturnType<typeof getMoneyReport>>;

/** The money report for one range. */
export function MoneyReport({ data }: { data: Report }) {
  const t = data.totals;
  const prevExpense = new Map(data.previousExpenses.map((c) => [c.categoryId, c.amount]));
  const changes = data.expenses
    .slice(0, 5)
    .map((c) => ({
      name: c.name,
      id: c.categoryId,
      ch: change(c.amount, prevExpense.get(c.categoryId) ?? 0),
    }))
    .filter((c) => c.ch !== null);
  const empty =
    t.income === 0 && t.expense === 0 && t.saved === 0 && t.borrowed === 0 && t.lent === 0;
  return (
    <div className="flex flex-col gap-4">
      <TotalsGrid t={t} previous={data.previous.totals} />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat id="daily" label="Average spend a day" value={formatMoney(data.dailySpend)} />
        <Stat id="saved" label="Saved to goals" value={formatMoney(t.saved)} />
        <Stat
          id="borrowed"
          label="Borrowed"
          value={formatMoney(t.borrowed)}
          hint={`paid back ${formatMoney(t.repaidOut)}`}
        />
        <Stat
          id="lent"
          label="Lent"
          value={formatMoney(t.lent)}
          hint={`got back ${formatMoney(t.repaidIn)}`}
        />
        <Stat
          id="owe"
          label="You still owe"
          value={formatMoney(data.outstanding.owe)}
          hint="at the end of the range"
        />
        <Stat
          id="owed"
          label="Owed to you"
          value={formatMoney(data.outstanding.owed)}
          hint="at the end of the range"
        />
      </dl>

      {empty ? (
        <p className="rounded-sm border border-dashed border-border-strong bg-surface p-6 text-sm text-fg-muted">
          No money entries in these dates yet.
        </p>
      ) : (
        <Panel id="money-trend" title="Income and expense">
          <IncomeExpenseChart points={data.series} />
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel id="by-category" title="Expense by category">
          <ShareList rows={data.expenses} testId="expense-category" />
          {changes.length ? (
            <ul className="mt-4 flex flex-col gap-1 text-xs text-fg-muted">
              {changes.map((c) => (
                <li key={c.id ?? "none"}>
                  {c.name} {(c.ch as number) > 0 ? "+" : ""}
                  {c.ch}% vs previous
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
        <Panel id="by-source" title="Income by source">
          <ShareList rows={data.income} testId="income-category" />
        </Panel>
      </div>

      {data.budgets.length ? (
        <Panel id="budgets" title="Budgets">
          <BudgetList rows={data.budgets} />
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel id="top-expenses" title="Largest expenses">
          {data.top.length ? (
            <EntryList entries={data.top} lookups={data} today={data.today} editable={false} />
          ) : (
            <p className="text-sm text-fg-muted">No expenses in this range.</p>
          )}
        </Panel>
        <Panel id="balances" title="Balances at the end of the range">
          <ul className="flex flex-col divide-y divide-border">
            {data.balances.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                <span>{b.name}</span>
                <span className="font-mono tabular-nums">{formatMoney(b.balance)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between py-2 text-sm font-medium">
              <span>Total</span>
              <span className="font-mono tabular-nums" data-testid="balance-total">
                {formatMoney(data.balances.reduce((n, b) => n + b.balance, 0))}
              </span>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
