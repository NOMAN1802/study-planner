/**
 * Money maths: amounts in whole poisha (1 taka = 100 poisha), local day keys
 * `YYYY-MM-DD`. Pure: no database, no clock. Balances and totals are always
 * derived from the entries.
 */
import { daysBetween, type DayRange } from "@/lib/daily-habits";
import { addDays } from "@/lib/planner";

export type EntryKind =
  "INCOME" | "EXPENSE" | "TRANSFER" | "BORROW" | "LEND" | "REPAY" | "SAVE" | "WITHDRAW";
export type AccountKind = "CASH" | "MOBILE" | "BANK" | "OTHER";
export type CategoryKind = "INCOME" | "EXPENSE";
export type DebtDirection = "BORROWED" | "LENT";

/** Largest single amount: ৳1 crore. */
export const MAX_MINOR = 1_000_000_000;
/** Share of a monthly budget at which it warns. */
export const BUDGET_WARN = 0.8;

// ---------------------------------------------------------------------------
// Amounts

/**
 * "1,20,000.5" → 12000050. Accepts commas, an optional ৳ and at most two
 * decimals; returns null for anything else, zero or negatives.
 */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[,\s৳]/g, "");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > MAX_MINOR) return null;
  return minor;
}

const grouping = new Intl.NumberFormat("en-IN");

/** 12000050 → "৳1,20,000.50"; whole taka drop the decimals ("৳500"). Lakh grouping. */
export function formatMoney(minor: number, opts: { sign?: boolean } = {}): string {
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const taka = Math.floor(abs / 100);
  const paisa = abs % 100;
  const body = `৳${grouping.format(taka)}${paisa ? `.${String(paisa).padStart(2, "0")}` : ""}`;
  if (neg) return `−${body}`;
  return opts.sign && minor > 0 ? `+${body}` : body;
}

/** 12050 → "120.50" for an input field. */
export function amountInput(minor: number): string {
  const paisa = minor % 100;
  return `${Math.floor(minor / 100)}${paisa ? `.${String(paisa).padStart(2, "0")}` : ""}`;
}

// ---------------------------------------------------------------------------
// Defaults

export const DEFAULT_ACCOUNTS: readonly { name: string; kind: AccountKind }[] = [
  { name: "Cash", kind: "CASH" },
  { name: "bKash", kind: "MOBILE" },
  { name: "Bank", kind: "BANK" },
];

export const DEFAULT_CATEGORIES: readonly {
  name: string;
  kind: CategoryKind;
  color: string;
}[] = [
  { name: "Salary", kind: "INCOME", color: "#3f7d3a" },
  { name: "Tuition", kind: "INCOME", color: "#0f766e" },
  { name: "Freelance", kind: "INCOME", color: "#a16207" },
  { name: "Gift", kind: "INCOME", color: "#9d174d" },
  { name: "Other income", kind: "INCOME", color: "#57534e" },
  { name: "Food", kind: "EXPENSE", color: "#c2410c" },
  { name: "Transport", kind: "EXPENSE", color: "#0f766e" },
  { name: "Rent", kind: "EXPENSE", color: "#475569" },
  { name: "Bills", kind: "EXPENSE", color: "#a16207" },
  { name: "Mobile & internet", kind: "EXPENSE", color: "#57534e" },
  { name: "Health", kind: "EXPENSE", color: "#b42318" },
  { name: "Books & study", kind: "EXPENSE", color: "#3f7d3a" },
  { name: "Family", kind: "EXPENSE", color: "#9d174d" },
  { name: "Shopping", kind: "EXPENSE", color: "#c2410c" },
  { name: "Sadaqah", kind: "EXPENSE", color: "#0f766e" },
  { name: "Other", kind: "EXPENSE", color: "#57534e" },
];

export const ENTRY_LABEL: Record<EntryKind, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
  BORROW: "Borrowed",
  LEND: "Lent",
  REPAY: "Repayment",
  SAVE: "To savings",
  WITHDRAW: "From savings",
};

// ---------------------------------------------------------------------------
// Entries and balances

export type Entry = {
  id: string;
  kind: EntryKind;
  amountMinor: number;
  day: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  debtId: string | null;
  goalId: string | null;
  note: string | null;
};

/** Direction of each debt, so REPAY knows which way money moves. */
export type DebtDirections = ReadonlyMap<string, DebtDirection>;

/**
 * How an entry changes account balances: `[accountId, delta]` pairs.
 * Repaying a borrowed debt takes money out; being repaid on a lent debt adds it.
 */
export function accountEffects(
  e: Entry,
  debts: DebtDirections,
): readonly (readonly [string, number])[] {
  const a = e.amountMinor;
  switch (e.kind) {
    case "INCOME":
    case "BORROW":
    case "WITHDRAW":
      return [[e.accountId, a]];
    case "EXPENSE":
    case "LEND":
    case "SAVE":
      return [[e.accountId, -a]];
    case "TRANSFER":
      return e.toAccountId
        ? [
            [e.accountId, -a],
            [e.toAccountId, a],
          ]
        : [];
    case "REPAY":
      return [[e.accountId, debts.get(e.debtId ?? "") === "LENT" ? a : -a]];
  }
}

/** Balance of each account (opening + entries up to and including `through`). */
export function accountBalances(
  accounts: readonly { id: string; openingMinor: number }[],
  entries: readonly Entry[],
  debts: DebtDirections,
  through?: string,
): Map<string, number> {
  const out = new Map(accounts.map((a) => [a.id, a.openingMinor]));
  for (const e of entries) {
    if (through && e.day > through) continue;
    for (const [id, d] of accountEffects(e, debts)) {
      if (out.has(id)) out.set(id, (out.get(id) as number) + d);
    }
  }
  return out;
}

/** Money in a savings goal: saved minus taken out. */
export function goalBalance(goalId: string, entries: readonly Entry[]): number {
  let n = 0;
  for (const e of entries) {
    if (e.goalId !== goalId) continue;
    if (e.kind === "SAVE") n += e.amountMinor;
    if (e.kind === "WITHDRAW") n -= e.amountMinor;
  }
  return n;
}

/** What it takes each month to reach a goal by its target day (null without one). */
export function goalMonthly(
  goal: { targetMinor: number; targetDay: string | null },
  saved: number,
  today: string,
): number | null {
  if (!goal.targetDay) return null;
  const left = goal.targetMinor - saved;
  if (left <= 0) return 0;
  const days = daysBetween(today, goal.targetDay);
  if (days <= 0) return left;
  const months = Math.max(1, Math.ceil(days / 30.44));
  return Math.ceil(left / months);
}

// ---------------------------------------------------------------------------
// Debts

export type DebtInfo = {
  id: string;
  person: string;
  direction: DebtDirection;
  amountMinor: number;
  day: string;
  dueDay: string | null;
};

export type DebtStatus = {
  repaid: number;
  remaining: number;
  settled: boolean;
  overdue: boolean;
};

export function debtStatus(debt: DebtInfo, entries: readonly Entry[], today: string): DebtStatus {
  const repaid = entries
    .filter((e) => e.debtId === debt.id && e.kind === "REPAY")
    .reduce((n, e) => n + e.amountMinor, 0);
  const remaining = Math.max(0, debt.amountMinor - repaid);
  return {
    repaid,
    remaining,
    settled: remaining === 0,
    overdue: remaining > 0 && debt.dueDay !== null && debt.dueDay < today,
  };
}

/** Totals still owed: by you (borrowed) and to you (lent). */
export function debtTotals(
  debts: readonly DebtInfo[],
  entries: readonly Entry[],
  today: string,
): { owe: number; owed: number; overdue: number } {
  let owe = 0;
  let owed = 0;
  let overdue = 0;
  for (const d of debts) {
    const s = debtStatus(d, entries, today);
    if (d.direction === "BORROWED") owe += s.remaining;
    else owed += s.remaining;
    if (s.overdue) overdue += 1;
  }
  return { owe, owed, overdue };
}

// ---------------------------------------------------------------------------
// Range totals

export type Totals = {
  income: number;
  expense: number;
  /** Income − expense. */
  net: number;
  /** Net ÷ income, 0–100 (null without income). */
  savingsRate: number | null;
  /** Put into goals minus taken out. */
  saved: number;
  borrowed: number;
  lent: number;
  /** Paid back on what you borrowed. */
  repaidOut: number;
  /** Paid back to you on what you lent. */
  repaidIn: number;
};

export function totals(
  entries: readonly Entry[],
  debts: DebtDirections,
  from: string,
  to: string,
): Totals {
  const t: Totals = {
    income: 0,
    expense: 0,
    net: 0,
    savingsRate: null,
    saved: 0,
    borrowed: 0,
    lent: 0,
    repaidOut: 0,
    repaidIn: 0,
  };
  for (const e of entries) {
    if (e.day < from || e.day > to) continue;
    const a = e.amountMinor;
    if (e.kind === "INCOME") t.income += a;
    else if (e.kind === "EXPENSE") t.expense += a;
    else if (e.kind === "SAVE") t.saved += a;
    else if (e.kind === "WITHDRAW") t.saved -= a;
    else if (e.kind === "BORROW") t.borrowed += a;
    else if (e.kind === "LEND") t.lent += a;
    else if (e.kind === "REPAY") {
      if (debts.get(e.debtId ?? "") === "LENT") t.repaidIn += a;
      else t.repaidOut += a;
    }
  }
  t.net = t.income - t.expense;
  t.savingsRate = t.income > 0 ? Math.round((t.net / t.income) * 100) : null;
  return t;
}

export type CategoryShare = {
  categoryId: string | null;
  name: string;
  color: string;
  amount: number;
  /** Share of the kind's total, 0–100. */
  pct: number;
};

/** Income or expense in a range, by category, largest first. */
export function byCategory(
  entries: readonly Entry[],
  categories: readonly { id: string; name: string; color: string }[],
  kind: "INCOME" | "EXPENSE",
  from: string,
  to: string,
): CategoryShare[] {
  const sums = new Map<string | null, number>();
  let total = 0;
  for (const e of entries) {
    if (e.kind !== kind || e.day < from || e.day > to) continue;
    sums.set(e.categoryId, (sums.get(e.categoryId) ?? 0) + e.amountMinor);
    total += e.amountMinor;
  }
  const byId = new Map(categories.map((c) => [c.id, c]));
  return [...sums.entries()]
    .map(([id, amount]) => {
      const c = id ? byId.get(id) : undefined;
      return {
        categoryId: id,
        name: c?.name ?? "Uncategorised",
        color: c?.color ?? "#57534e",
        amount,
        pct: total ? Math.round((amount / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export type SeriesPoint = { key: string; label: string; income: number; expense: number };

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Income and expense per day, or per month when the range is longer than 62 days. */
export function series(entries: readonly Entry[], from: string, to: string): SeriesPoint[] {
  const monthly = daysBetween(from, to) + 1 > 62;
  const points = new Map<string, SeriesPoint>();
  if (monthly) {
    for (let m = from.slice(0, 7); m <= to.slice(0, 7);) {
      points.set(m, {
        key: m,
        label: `${MONTH[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`,
        income: 0,
        expense: 0,
      });
      const [y, mo] = m.split("-").map(Number);
      m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
    }
  } else {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      points.set(d, {
        key: d,
        label: `${Number(d.slice(8))} ${MONTH[Number(d.slice(5, 7)) - 1]}`,
        income: 0,
        expense: 0,
      });
    }
  }
  for (const e of entries) {
    if (e.day < from || e.day > to) continue;
    if (e.kind !== "INCOME" && e.kind !== "EXPENSE") continue;
    const p = points.get(monthly ? e.day.slice(0, 7) : e.day);
    if (!p) continue;
    if (e.kind === "INCOME") p.income += e.amountMinor;
    else p.expense += e.amountMinor;
  }
  return [...points.values()];
}

/** The range just before `r`, of the same kind (custom: same length). */
export function previousRange(r: DayRange): { from: string; to: string } {
  if (r.kind === "custom" || !r.prev) {
    const len = daysBetween(r.from, r.to) + 1;
    return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
  }
  if (r.kind === "day") return { from: r.prev, to: r.prev };
  if (r.kind === "week") return { from: r.prev, to: addDays(r.prev, 6) };
  if (r.kind === "month") {
    const [y, m] = r.prev.split("-").map(Number);
    return { from: r.prev, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
  }
  const y = r.prev.slice(0, 4);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/** Percent change from `before` to `now` (null when there was nothing before). */
export function change(now: number, before: number): number | null {
  if (before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}

// ---------------------------------------------------------------------------
// Budgets

export type BudgetState = "ok" | "warn" | "over";

export type BudgetRow = {
  categoryId: string;
  name: string;
  color: string;
  budget: number;
  spent: number;
  /** spent ÷ budget, 0–100+ */
  pct: number;
  state: BudgetState;
};

/** Spending against each category's monthly budget for the month `YYYY-MM`. */
export function budgetUse(
  categories: readonly {
    id: string;
    name: string;
    color: string;
    kind: CategoryKind;
    budgetMinor: number | null;
  }[],
  entries: readonly Entry[],
  month: string,
): BudgetRow[] {
  return categories
    .filter((c) => c.kind === "EXPENSE" && c.budgetMinor && c.budgetMinor > 0)
    .map((c) => {
      const spent = entries
        .filter((e) => e.kind === "EXPENSE" && e.categoryId === c.id && e.day.startsWith(month))
        .reduce((n, e) => n + e.amountMinor, 0);
      const budget = c.budgetMinor as number;
      const ratio = spent / budget;
      return {
        categoryId: c.id,
        name: c.name,
        color: c.color,
        budget,
        spent,
        pct: Math.round(ratio * 100),
        state: ratio > 1 ? "over" : ratio >= BUDGET_WARN ? "warn" : "ok",
      } satisfies BudgetRow;
    })
    .sort((a, b) => b.pct - a.pct);
}

/** Largest expenses in a range. */
export function topExpenses(entries: readonly Entry[], from: string, to: string, n = 10): Entry[] {
  return entries
    .filter((e) => e.kind === "EXPENSE" && e.day >= from && e.day <= to)
    .sort((a, b) => b.amountMinor - a.amountMinor || b.day.localeCompare(a.day))
    .slice(0, n);
}
