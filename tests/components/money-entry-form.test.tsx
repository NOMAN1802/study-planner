import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntryForm } from "@/components/money/forms";
import type { MoneyAccount, MoneyCategory } from "@/lib/money-server";

const saveEntry = vi.fn<(input: unknown) => Promise<{ fieldErrors?: Record<string, string> }>>(
  async () => ({}),
);
vi.mock("@/actions/money", () => ({
  saveEntry: (input: unknown) => saveEntry(input),
  deleteEntry: vi.fn(),
  addDebt: vi.fn(),
  repayDebt: vi.fn(),
  deleteDebt: vi.fn(),
  saveGoal: vi.fn(),
  moveGoalMoney: vi.fn(),
  saveAccount: vi.fn(),
  saveCategory: vi.fn(),
  setAccountArchived: vi.fn(),
  setCategoryArchived: vi.fn(),
  setGoalArchived: vi.fn(),
}));

const accounts: MoneyAccount[] = [
  { id: "cash", name: "Cash", kind: "CASH", openingMinor: 0, archived: false },
  { id: "bkash", name: "bKash", kind: "MOBILE", openingMinor: 0, archived: false },
  { id: "old", name: "Old card", kind: "BANK", openingMinor: 0, archived: true },
];
const categories: MoneyCategory[] = [
  {
    id: "food",
    name: "Food",
    kind: "EXPENSE",
    color: "#c2410c",
    budgetMinor: null,
    archived: false,
  },
  {
    id: "salary",
    name: "Salary",
    kind: "INCOME",
    color: "#3f7d3a",
    budgetMinor: null,
    archived: false,
  },
];

describe("EntryForm", () => {
  it("adds an expense with taka and poisha from the chosen account", async () => {
    const user = userEvent.setup();
    render(<EntryForm accounts={accounts} categories={categories} today="2026-11-22" />);
    expect(screen.getByRole("button", { name: "Expense" })).toHaveAttribute("aria-pressed", "true");
    // Archived accounts are not offered for new entries.
    expect(screen.queryByRole("option", { name: /Old card/ })).toBeNull();
    await user.type(screen.getByLabelText("Amount"), "250.50");
    await user.selectOptions(screen.getByLabelText("Paid from"), "bkash");
    await user.type(screen.getByLabelText("Note (optional)"), "lunch");
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    expect(saveEntry).toHaveBeenCalledWith({
      id: undefined,
      kind: "EXPENSE",
      amount: "250.50",
      day: "2026-11-22",
      accountId: "bkash",
      toAccountId: null,
      categoryId: "food",
      note: "lunch",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
  });

  it("switches to a transfer: two accounts, no category", async () => {
    const user = userEvent.setup();
    render(<EntryForm accounts={accounts} categories={categories} today="2026-11-22" />);
    await user.click(screen.getByRole("button", { name: "Transfer" }));
    expect(screen.queryByLabelText("Category")).toBeNull();
    expect(screen.getByLabelText("From account")).toHaveValue("cash");
    expect(screen.getByLabelText("To account")).toHaveValue("bkash");
    await user.click(screen.getByRole("button", { name: "Income" }));
    expect(screen.getByLabelText("Category")).toHaveValue("salary");
  });

  it("shows the field errors the server returns", async () => {
    saveEntry.mockResolvedValueOnce({ fieldErrors: { amount: "Enter an amount above ৳0." } });
    const user = userEvent.setup();
    render(<EntryForm accounts={accounts} categories={categories} today="2026-11-22" />);
    await user.click(screen.getByRole("button", { name: "Add expense" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter an amount above ৳0.");
    expect(screen.getByLabelText("Amount")).toHaveAttribute("aria-invalid", "true");
  });
});
