import type { CurrentUser } from "@/lib/auth";
import type { DayRange } from "@/lib/daily-habits";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  accountBalances,
  budgetUse,
  byCategory,
  debtStatus,
  debtTotals,
  goalBalance,
  goalMonthly,
  previousRange,
  series,
  topExpenses,
  totals,
  type AccountKind,
  type CategoryKind,
  type DebtDirection,
  type DebtDirections,
  type DebtStatus,
  type Entry,
  type EntryKind,
} from "@/lib/money";
import { dayKeyOf } from "@/lib/planner";
import { prisma } from "@/lib/prisma";

export type MoneyAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  openingMinor: number;
  archived: boolean;
};
export type MoneyCategory = {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  budgetMinor: number | null;
  archived: boolean;
};
export type MoneyDebt = {
  id: string;
  person: string;
  direction: DebtDirection;
  amountMinor: number;
  day: string;
  dueDay: string | null;
  note: string | null;
  status: DebtStatus;
  repayments: Entry[];
};
export type MoneyGoal = {
  id: string;
  name: string;
  targetMinor: number;
  targetDay: string | null;
  archived: boolean;
  saved: number;
  monthly: number | null;
};

/**
 * Creates the default accounts and categories the first time a user opens
 * Money. A per-user advisory lock keeps two parallel requests from both seeding.
 */
export async function ensureMoneySetup(userId: string): Promise<void> {
  const [accounts, categories] = await Promise.all([
    prisma.moneyAccount.count({ where: { userId } }),
    prisma.moneyCategory.count({ where: { userId } }),
  ]);
  if (accounts > 0 && categories > 0) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`money:${userId}`}))`;
    if ((await tx.moneyAccount.count({ where: { userId } })) === 0) {
      await tx.moneyAccount.createMany({
        data: DEFAULT_ACCOUNTS.map((a, i) => ({
          userId,
          name: a.name,
          kind: a.kind,
          sortOrder: i,
        })),
      });
    }
    if ((await tx.moneyCategory.count({ where: { userId } })) === 0) {
      await tx.moneyCategory.createMany({
        data: DEFAULT_CATEGORIES.map((c, i) => ({
          userId,
          name: c.name,
          kind: c.kind,
          color: c.color,
          sortOrder: i,
        })),
      });
    }
  });
}

/** Everything money for one user (personal volumes: a few thousand entries at most). */
async function loadAll(userId: string) {
  const [accounts, categories, entries, debts, goals] = await Promise.all([
    prisma.moneyAccount.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.moneyCategory.findMany({
      where: { userId },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.moneyEntry.findMany({
      where: { userId },
      orderBy: [{ day: "desc" }, { createdAt: "desc" }],
    }),
    prisma.debt.findMany({ where: { userId }, orderBy: [{ day: "desc" }, { createdAt: "desc" }] }),
    prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);
  const list: Entry[] = entries.map((e) => ({
    id: e.id,
    kind: e.kind as EntryKind,
    amountMinor: e.amountMinor,
    day: e.day,
    accountId: e.accountId,
    toAccountId: e.toAccountId,
    categoryId: e.categoryId,
    debtId: e.debtId,
    goalId: e.goalId,
    note: e.note,
  }));
  const directions: DebtDirections = new Map(debts.map((d) => [d.id, d.direction]));
  return {
    accounts: accounts.map((a): MoneyAccount => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      openingMinor: a.openingMinor,
      archived: a.archivedAt !== null,
    })),
    categories: categories.map((c): MoneyCategory => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      color: c.color,
      budgetMinor: c.budgetMinor,
      archived: c.archivedAt !== null,
    })),
    entries: list,
    directions,
    debts,
    goals,
  };
}

type All = Awaited<ReturnType<typeof loadAll>>;

export function moneyToday(user: Pick<CurrentUser, "timezone">, now = new Date()): string {
  return dayKeyOf(now, user.timezone);
}

function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function debtRows(all: All, today: string): MoneyDebt[] {
  return all.debts.map((d) => ({
    id: d.id,
    person: d.person,
    direction: d.direction,
    amountMinor: d.amountMinor,
    day: d.day,
    dueDay: d.dueDay,
    note: d.note,
    status: debtStatus(d, all.entries, today),
    repayments: all.entries.filter((e) => e.debtId === d.id && e.kind === "REPAY"),
  }));
}

function goalRows(all: All, today: string): MoneyGoal[] {
  return all.goals.map((g) => {
    const saved = goalBalance(g.id, all.entries);
    return {
      id: g.id,
      name: g.name,
      targetMinor: g.targetMinor,
      targetDay: g.targetDay,
      archived: g.archivedAt !== null,
      saved,
      monthly: goalMonthly(g, saved, today),
    };
  });
}

export type MoneyLookups = ReturnType<typeof lookups>;

/** Lookups an entry list needs to show account, category, person and goal names. */
function lookups(all: All) {
  return {
    accounts: all.accounts,
    categories: all.categories,
    debts: Object.fromEntries(
      all.debts.map((d) => [d.id, { person: d.person, direction: d.direction }]),
    ),
    goals: Object.fromEntries(all.goals.map((g) => [g.id, g.name])),
  };
}

/** The Money overview: this month, balances, debts, goals, budgets and the latest entries. */
export async function getMoneyOverview(user: CurrentUser) {
  await ensureMoneySetup(user.id);
  const today = moneyToday(user);
  const month = today.slice(0, 7);
  const all = await loadAll(user.id);
  const balances = accountBalances(all.accounts, all.entries, all.directions);
  return {
    today,
    ...lookups(all),
    balances: Object.fromEntries(balances),
    total: all.accounts.reduce((n, a) => n + (balances.get(a.id) ?? 0), 0),
    month: totals(all.entries, all.directions, `${month}-01`, monthEnd(month)),
    debtTotals: debtTotals(all.debts, all.entries, today),
    goalList: goalRows(all, today).filter((g) => !g.archived),
    budgets: budgetUse(
      all.categories.filter((c) => !c.archived),
      all.entries,
      month,
    ),
    recent: all.entries.slice(0, 6),
  };
}

export type EntryFilters = {
  kind?: EntryKind;
  categoryId?: string;
  accountId?: string;
  q?: string;
};

/** Entries in a range, filtered, newest first, with the lookups to show them. */
export async function getTransactions(user: CurrentUser, range: DayRange, f: EntryFilters) {
  await ensureMoneySetup(user.id);
  const all = await loadAll(user.id);
  const q = f.q?.trim().toLowerCase();
  const entries = all.entries.filter(
    (e) =>
      e.day >= range.from &&
      e.day <= range.to &&
      (!f.kind || e.kind === f.kind) &&
      (!f.categoryId || e.categoryId === f.categoryId) &&
      (!f.accountId || e.accountId === f.accountId || e.toAccountId === f.accountId) &&
      (!q || (e.note ?? "").toLowerCase().includes(q)),
  );
  return { today: moneyToday(user), entries, ...lookups(all) };
}

export async function getDebts(user: CurrentUser) {
  await ensureMoneySetup(user.id);
  const today = moneyToday(user);
  const all = await loadAll(user.id);
  return {
    today,
    accounts: all.accounts,
    debts: debtRows(all, today),
    totals: debtTotals(all.debts, all.entries, today),
  };
}

export async function getGoals(user: CurrentUser) {
  await ensureMoneySetup(user.id);
  const today = moneyToday(user);
  const all = await loadAll(user.id);
  const balances = accountBalances(all.accounts, all.entries, all.directions);
  return {
    today,
    accounts: all.accounts,
    balances: Object.fromEntries(balances),
    goals: goalRows(all, today),
  };
}

export async function getMoneySettings(user: CurrentUser) {
  await ensureMoneySetup(user.id);
  const all = await loadAll(user.id);
  const balances = accountBalances(all.accounts, all.entries, all.directions);
  return {
    accounts: all.accounts.map((a) => ({ ...a, balance: balances.get(a.id) ?? 0 })),
    categories: all.categories,
  };
}

/** Report for a range: totals, comparison, charts, categories, budgets, balances. */
export async function getMoneyReport(user: CurrentUser, range: DayRange) {
  await ensureMoneySetup(user.id);
  const today = moneyToday(user);
  const all = await loadAll(user.id);
  const prev = previousRange(range);
  const now = totals(all.entries, all.directions, range.from, range.to);
  const before = totals(all.entries, all.directions, prev.from, prev.to);
  const through = range.to < today ? range.to : today;
  const days =
    range.from > today
      ? 0
      : Math.round(
          (Date.parse(`${through}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000,
        ) + 1;
  const balances = accountBalances(all.accounts, all.entries, all.directions, range.to);
  const singleMonth = range.from.slice(0, 7) === range.to.slice(0, 7);
  return {
    today,
    totals: now,
    previous: { ...prev, totals: before },
    /** Average spend per day that has passed in the range. */
    dailySpend: days > 0 ? Math.round(now.expense / days) : 0,
    series: series(all.entries, range.from, range.to),
    expenses: byCategory(all.entries, all.categories, "EXPENSE", range.from, range.to),
    income: byCategory(all.entries, all.categories, "INCOME", range.from, range.to),
    previousExpenses: byCategory(all.entries, all.categories, "EXPENSE", prev.from, prev.to),
    top: topExpenses(all.entries, range.from, range.to),
    // Budgets are monthly, so they show for a single month.
    budgets: singleMonth
      ? budgetUse(
          all.categories.filter((c) => !c.archived),
          all.entries,
          range.from.slice(0, 7),
        )
      : [],
    balances: all.accounts
      .filter((a) => !a.archived || (balances.get(a.id) ?? 0) !== 0)
      .map((a) => ({ id: a.id, name: a.name, balance: balances.get(a.id) ?? 0 })),
    outstanding: debtTotals(
      all.debts.filter((d) => d.day <= range.to),
      all.entries.filter((e) => e.day <= range.to),
      range.to,
    ),
    ...lookups(all),
  };
}

/** This month at a glance, for the dashboard (null before any money entry). */
export async function getMoneySummary(user: CurrentUser) {
  const [entryCount, fundedAccounts] = await Promise.all([
    prisma.moneyEntry.count({ where: { userId: user.id } }),
    prisma.moneyAccount.count({ where: { userId: user.id, openingMinor: { not: 0 } } }),
  ]);
  if (entryCount === 0 && fundedAccounts === 0) return null;
  const today = moneyToday(user);
  const month = today.slice(0, 7);
  const all = await loadAll(user.id);
  const balances = accountBalances(all.accounts, all.entries, all.directions);
  return {
    /** Money held now: every account's opening balance plus all entries, as on the Finance page. */
    balance: all.accounts.reduce((n, a) => n + (balances.get(a.id) ?? 0), 0),
    month: totals(all.entries, all.directions, `${month}-01`, monthEnd(month)),
    debts: debtTotals(all.debts, all.entries, today),
    budgetAlerts: budgetUse(
      all.categories.filter((c) => !c.archived),
      all.entries,
      month,
    ).filter((b) => b.state !== "ok").length,
  };
}
