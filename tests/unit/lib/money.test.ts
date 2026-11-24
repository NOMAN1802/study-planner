import { describe, expect, it } from "vitest";
import { resolveRange } from "@/lib/daily-habits";
import {
  accountBalances,
  amountInput,
  budgetUse,
  byCategory,
  change,
  debtStatus,
  debtTotals,
  formatMoney,
  goalBalance,
  goalMonthly,
  parseAmount,
  previousRange,
  series,
  topExpenses,
  totalBalance,
  totals,
  type Entry,
} from "@/lib/money";

let n = 0;
const entry = (over: Partial<Entry> & Pick<Entry, "kind" | "amountMinor">): Entry => ({
  id: `e${(n += 1)}`,
  day: "2026-11-10",
  accountId: "cash",
  toAccountId: null,
  categoryId: null,
  debtId: null,
  goalId: null,
  note: null,
  ...over,
});

describe("amounts", () => {
  it("parses taka with poisha, commas and the taka sign", () => {
    expect(parseAmount("120")).toBe(12000);
    expect(parseAmount("120.5")).toBe(12050);
    expect(parseAmount("120.05")).toBe(12005);
    expect(parseAmount("৳1,20,000.50")).toBe(12000050);
    expect(parseAmount(" 75 ")).toBe(7500);
  });

  it("rejects zero, negatives, three decimals and junk", () => {
    for (const bad of ["0", "0.00", "-5", "1.234", "abc", "", "1e5", "10000001"]) {
      expect(parseAmount(bad), bad).toBeNull();
    }
  });

  it("formats with lakh grouping and drops .00", () => {
    expect(formatMoney(12000050)).toBe("৳1,20,000.50");
    expect(formatMoney(50000)).toBe("৳500");
    expect(formatMoney(5)).toBe("৳0.05");
    expect(formatMoney(-150000)).toBe("−৳1,500");
    expect(formatMoney(2500, { sign: true })).toBe("+৳25");
    expect(amountInput(12050)).toBe("120.50");
    expect(amountInput(12000)).toBe("120");
  });
});

describe("balances", () => {
  const accounts = [
    { id: "cash", openingMinor: 100000 },
    { id: "bank", openingMinor: 0 },
  ];
  const debts = new Map([
    ["d-borrow", "BORROWED" as const],
    ["d-lend", "LENT" as const],
  ]);
  const entries = [
    entry({ kind: "INCOME", amountMinor: 500000, accountId: "bank" }),
    entry({ kind: "EXPENSE", amountMinor: 20000 }),
    entry({ kind: "TRANSFER", amountMinor: 100000, accountId: "bank", toAccountId: "cash" }),
    entry({ kind: "BORROW", amountMinor: 50000, debtId: "d-borrow" }),
    entry({ kind: "REPAY", amountMinor: 20000, debtId: "d-borrow" }),
    entry({ kind: "LEND", amountMinor: 30000, debtId: "d-lend" }),
    entry({ kind: "REPAY", amountMinor: 10000, debtId: "d-lend" }),
    entry({ kind: "SAVE", amountMinor: 40000, goalId: "g", accountId: "bank" }),
    entry({ kind: "WITHDRAW", amountMinor: 15000, goalId: "g", accountId: "bank" }),
    entry({ kind: "EXPENSE", amountMinor: 999, day: "2026-12-01" }),
  ];

  it("applies every kind to the right account in the right direction", () => {
    const b = accountBalances(accounts, entries, debts);
    // cash: 1000 − 200 + 1000 + 500 − 200 − 300 + 100 − 9.99
    expect(b.get("cash")).toBe(100000 - 20000 + 100000 + 50000 - 20000 - 30000 + 10000 - 999);
    // bank: 5000 − 1000 − 400 + 150
    expect(b.get("bank")).toBe(500000 - 100000 - 40000 + 15000);
  });

  it("totals every account, opening balances included", () => {
    // Opening 1000 cash + 0 bank, then every entry above (the 9.99 one too).
    expect(totalBalance(accounts, entries, debts)).toBe(
      100000 + 500000 - 20000 + 50000 - 20000 - 30000 + 10000 - 40000 + 15000 - 999,
    );
  });

  it("counts an opening balance as money held, not as this month's income", () => {
    // The dashboard case: ৳3,150 opening, ৳380 spent, nothing earned.
    const wallet = [{ id: "cash", openingMinor: 315000 }];
    const spent = [entry({ kind: "EXPENSE", amountMinor: 38000 })];
    expect(totalBalance(wallet, spent, new Map())).toBe(277000);
    expect(totals(spent, new Map(), "2026-11-01", "2026-11-30").net).toBe(-38000);
    expect(totalBalance(wallet, [], new Map())).toBe(315000);
  });

  it("moving money between accounts leaves the total unchanged", () => {
    const two = [
      { id: "cash", openingMinor: 10000 },
      { id: "bank", openingMinor: 50000 },
    ];
    const move = [
      entry({ kind: "TRANSFER", amountMinor: 20000, accountId: "bank", toAccountId: "cash" }),
    ];
    expect(totalBalance(two, move, new Map())).toBe(60000);
  });

  it("can stop at a day", () => {
    expect(accountBalances(accounts, entries, debts, "2026-11-30").get("cash")).toBe(
      100000 - 20000 + 100000 + 50000 - 20000 - 30000 + 10000,
    );
  });

  it("keeps savings goals separate from expenses", () => {
    expect(goalBalance("g", entries)).toBe(25000);
    const t = totals(entries, debts, "2026-11-01", "2026-11-30");
    expect(t).toMatchObject({
      income: 500000,
      expense: 20000,
      net: 480000,
      savingsRate: 96,
      saved: 25000,
      borrowed: 50000,
      lent: 30000,
      repaidOut: 20000,
      repaidIn: 10000,
    });
  });
});

describe("debts", () => {
  const debt = {
    id: "d",
    person: "Rahim",
    direction: "BORROWED" as const,
    amountMinor: 500000,
    day: "2026-11-01",
    dueDay: "2026-11-15",
  };

  it("tracks part repayments, what is left, settled and overdue", () => {
    const part = [entry({ kind: "REPAY", amountMinor: 200000, debtId: "d" })];
    expect(debtStatus(debt, part, "2026-11-10")).toEqual({
      repaid: 200000,
      remaining: 300000,
      settled: false,
      overdue: false,
    });
    expect(debtStatus(debt, part, "2026-11-16").overdue).toBe(true);
    const all = [...part, entry({ kind: "REPAY", amountMinor: 300000, debtId: "d" })];
    expect(debtStatus(debt, all, "2026-11-20")).toMatchObject({
      remaining: 0,
      settled: true,
      overdue: false,
    });
  });

  it("totals what you owe and are owed", () => {
    const lent = {
      ...debt,
      id: "l",
      direction: "LENT" as const,
      amountMinor: 100000,
      dueDay: null,
    };
    expect(debtTotals([debt, lent], [], "2026-11-20")).toEqual({
      owe: 500000,
      owed: 100000,
      overdue: 1,
    });
  });
});

describe("goals", () => {
  it("works out the monthly amount to reach the target in time", () => {
    const goal = { targetMinor: 6000000, targetDay: "2027-05-22" };
    // ৳60,000 left over ~6 months.
    expect(goalMonthly(goal, 0, "2026-11-22")).toBe(1000000);
    expect(goalMonthly(goal, 6000000, "2026-11-22")).toBe(0);
    expect(goalMonthly({ ...goal, targetDay: null }, 0, "2026-11-22")).toBeNull();
    expect(goalMonthly(goal, 0, "2027-06-01")).toBe(6000000);
  });
});

describe("reports", () => {
  const cats = [
    { id: "food", name: "Food", color: "#1", kind: "EXPENSE" as const, budgetMinor: 600000 },
    { id: "rent", name: "Rent", color: "#2", kind: "EXPENSE" as const, budgetMinor: 1000000 },
    { id: "bills", name: "Bills", color: "#3", kind: "EXPENSE" as const, budgetMinor: null },
    { id: "salary", name: "Salary", color: "#4", kind: "INCOME" as const, budgetMinor: null },
  ];
  const entries = [
    entry({ kind: "EXPENSE", amountMinor: 300000, categoryId: "food", day: "2026-11-02" }),
    entry({ kind: "EXPENSE", amountMinor: 200000, categoryId: "food", day: "2026-11-20" }),
    entry({ kind: "EXPENSE", amountMinor: 1100000, categoryId: "rent", day: "2026-11-01" }),
    entry({ kind: "EXPENSE", amountMinor: 400000, categoryId: "food", day: "2026-10-30" }),
    entry({ kind: "INCOME", amountMinor: 3000000, categoryId: "salary", day: "2026-11-01" }),
  ];

  it("splits by category with shares", () => {
    const rows = byCategory(entries, cats, "EXPENSE", "2026-11-01", "2026-11-30");
    expect(rows.map((r) => [r.name, r.amount, r.pct])).toEqual([
      ["Rent", 1100000, 69],
      ["Food", 500000, 31],
    ]);
  });

  it("warns near a budget and flags going over", () => {
    const rows = budgetUse(cats, entries, "2026-11");
    expect(rows).toEqual([
      expect.objectContaining({ name: "Rent", spent: 1100000, pct: 110, state: "over" }),
      expect.objectContaining({ name: "Food", spent: 500000, pct: 83, state: "warn" }),
    ]);
    expect(budgetUse(cats, entries, "2026-10")[0]).toMatchObject({ name: "Food", state: "ok" });
  });

  it("builds daily points for a month and monthly points for a year", () => {
    const days = series(entries, "2026-11-01", "2026-11-30");
    expect(days).toHaveLength(30);
    expect(days[0]).toMatchObject({ key: "2026-11-01", income: 3000000, expense: 1100000 });
    const months = series(entries, "2026-01-01", "2026-12-31");
    expect(months).toHaveLength(12);
    expect(months[10]).toMatchObject({ key: "2026-11", label: "Nov 26", expense: 1600000 });
    expect(months[9].expense).toBe(400000);
  });

  it("finds the previous range of the same kind", () => {
    const today = "2026-11-22";
    expect(previousRange(resolveRange({ range: "month" }, today, 1))).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(previousRange(resolveRange({ range: "week" }, today, 1))).toEqual({
      from: "2026-11-09",
      to: "2026-11-15",
    });
    expect(previousRange(resolveRange({ range: "year" }, today, 1))).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
    expect(
      previousRange(
        resolveRange({ range: "custom", from: "2026-11-11", to: "2026-11-20" }, today, 1),
      ),
    ).toEqual({ from: "2026-11-01", to: "2026-11-10" });
    expect(change(150, 100)).toBe(50);
    expect(change(5, 0)).toBeNull();
  });

  it("lists the largest expenses first", () => {
    expect(topExpenses(entries, "2026-11-01", "2026-11-30", 2).map((e) => e.amountMinor)).toEqual([
      1100000, 300000,
    ]);
  });
});
