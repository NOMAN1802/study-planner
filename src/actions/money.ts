"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { debtStatus, goalBalance, parseAmount, type Entry, type EntryKind } from "@/lib/money";
import { addDays, dayKeyOf, isDayKey } from "@/lib/planner";
import { prisma } from "@/lib/prisma";

export type MoneyResult = { error?: string; fieldErrors?: Record<string, string> };

const NOTE_MAX = 200;
const NAME_MAX = 60;
const BACK_DAYS = 10 * 366;

function revalidate() {
  revalidatePath("/money", "layout");
  revalidatePath("/dashboard");
}

const uuid = z.uuid();
const isId = (v: unknown): v is string => uuid.safeParse(v).success;

/** A day that can hold an entry: valid, not in the future, not absurdly old. */
function entryDay(day: unknown, timezone: string): string | null {
  if (!isDayKey(day)) return null;
  const today = dayKeyOf(new Date(), timezone);
  return day <= today && day >= addDays(today, -BACK_DAYS) ? day : null;
}

function cleanNote(note: unknown): string | null | undefined {
  if (note === undefined || note === null) return null;
  if (typeof note !== "string") return undefined;
  const t = note.trim();
  return t.length > NOTE_MAX ? undefined : t || null;
}

async function ownedAccount(userId: string, id: unknown, allowArchived = false) {
  if (!isId(id)) return null;
  return prisma.moneyAccount.findFirst({
    where: { id, userId, ...(allowArchived ? {} : { archivedAt: null }) },
  });
}

// ---------------------------------------------------------------------------
// Income, expense, transfer

export type EntryInput = {
  id?: string;
  kind: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: string;
  day: string;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  note?: string | null;
};

/** Adds an income, expense or transfer, or edits one (`id`). */
export async function saveEntry(input: EntryInput): Promise<MoneyResult> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  if (!["INCOME", "EXPENSE", "TRANSFER"].includes(input.kind)) return { error: "Invalid entry." };
  const amountMinor = parseAmount(String(input.amount ?? ""));
  if (!amountMinor) fieldErrors.amount = "Enter an amount above ৳0, with at most 2 decimals.";
  const day = entryDay(input.day, user.timezone);
  if (!day) fieldErrors.day = "Pick a date that isn't in the future.";
  const note = cleanNote(input.note);
  if (note === undefined) fieldErrors.note = `Keep the note under ${NOTE_MAX} characters.`;

  const existing = input.id
    ? isId(input.id)
      ? await prisma.moneyEntry.findFirst({ where: { id: input.id, userId: user.id } })
      : null
    : null;
  if (input.id && !existing) return { error: "Entry not found." };
  if (existing && !["INCOME", "EXPENSE", "TRANSFER"].includes(existing.kind)) {
    return { error: "Change this on Borrow & Lend or Savings." };
  }

  // An edit may keep an account that has since been archived.
  const keep = (id: unknown) =>
    Boolean(existing && (id === existing.accountId || id === existing.toAccountId));
  const account = await ownedAccount(user.id, input.accountId, keep(input.accountId));
  if (!account) fieldErrors.accountId = "Pick an account.";

  let toAccountId: string | null = null;
  let categoryId: string | null = null;
  if (input.kind === "TRANSFER") {
    const to = await ownedAccount(user.id, input.toAccountId, keep(input.toAccountId));
    if (!to) fieldErrors.toAccountId = "Pick the account the money goes to.";
    else if (to.id === account?.id) fieldErrors.toAccountId = "Pick a different account.";
    else toAccountId = to.id;
  } else {
    const cat = isId(input.categoryId)
      ? await prisma.moneyCategory.findFirst({
          where: { id: input.categoryId, userId: user.id, kind: input.kind },
        })
      : null;
    if (!cat) fieldErrors.categoryId = "Pick a category.";
    else categoryId = cat.id;
  }

  if (Object.keys(fieldErrors).length || !account || !amountMinor || !day) return { fieldErrors };
  const data = {
    kind: input.kind,
    amountMinor,
    day,
    accountId: account.id,
    toAccountId,
    categoryId,
    note: note ?? null,
  };
  if (existing) await prisma.moneyEntry.update({ where: { id: existing.id }, data });
  else await prisma.moneyEntry.create({ data: { ...data, userId: user.id } });
  revalidate();
  return {};
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function toEntry(e: {
  id: string;
  kind: string;
  amountMinor: number;
  day: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  debtId: string | null;
  goalId: string | null;
  note: string | null;
}): Entry {
  return {
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
  };
}

/** Marks a debt settled when nothing is left, or open again after a repayment is removed. */
async function settle(tx: Tx, debtId: string) {
  const debt = await tx.debt.findUnique({ where: { id: debtId }, include: { entries: true } });
  if (!debt) return;
  const s = debtStatus(debt, debt.entries.map(toEntry), debt.day);
  if (s.settled !== (debt.settledAt !== null)) {
    await tx.debt.update({
      where: { id: debt.id },
      data: { settledAt: s.settled ? new Date() : null },
    });
  }
}

/** Deletes an entry. A debt's first entry goes with the debt itself (Borrow & Lend). */
export async function deleteEntry(id: string): Promise<MoneyResult> {
  const user = await requireUser();
  if (!isId(id)) return { error: "Entry not found." };
  const entry = await prisma.moneyEntry.findFirst({ where: { id, userId: user.id } });
  if (!entry) return { error: "Entry not found." };
  if (entry.kind === "BORROW" || entry.kind === "LEND") {
    return { error: "Delete the whole debt on Borrow & Lend instead." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.moneyEntry.delete({ where: { id: entry.id } });
    if (entry.debtId) await settle(tx, entry.debtId);
  });
  revalidate();
  return {};
}

// ---------------------------------------------------------------------------
// Borrow & lend

export type DebtInput = {
  direction: "BORROWED" | "LENT";
  person: string;
  amount: string;
  day: string;
  dueDay?: string | null;
  accountId: string;
  note?: string | null;
};

/** Records money borrowed from or lent to someone, moving it in or out of an account. */
export async function addDebt(input: DebtInput): Promise<MoneyResult> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  if (input.direction !== "BORROWED" && input.direction !== "LENT") {
    return { error: "Invalid debt." };
  }
  const person = String(input.person ?? "").trim();
  if (!person || person.length > NAME_MAX) {
    fieldErrors.person = "Enter who it is (up to 60 characters).";
  }
  const amountMinor = parseAmount(String(input.amount ?? ""));
  if (!amountMinor) fieldErrors.amount = "Enter an amount above ৳0, with at most 2 decimals.";
  const day = entryDay(input.day, user.timezone);
  if (!day) fieldErrors.day = "Pick a date that isn't in the future.";
  let dueDay: string | null = null;
  if (input.dueDay) {
    if (!isDayKey(input.dueDay) || (day && input.dueDay < day)) {
      fieldErrors.dueDay = "The due date can't be before the date.";
    } else dueDay = input.dueDay;
  }
  const note = cleanNote(input.note);
  if (note === undefined) fieldErrors.note = `Keep the note under ${NOTE_MAX} characters.`;
  const account = await ownedAccount(user.id, input.accountId);
  if (!account) fieldErrors.accountId = "Pick an account.";
  if (Object.keys(fieldErrors).length || !account || !amountMinor || !day) return { fieldErrors };

  await prisma.$transaction(async (tx) => {
    const debt = await tx.debt.create({
      data: {
        userId: user.id,
        person,
        direction: input.direction,
        amountMinor,
        day,
        dueDay,
        note: note ?? null,
      },
    });
    await tx.moneyEntry.create({
      data: {
        userId: user.id,
        kind: input.direction === "BORROWED" ? "BORROW" : "LEND",
        amountMinor,
        day,
        accountId: account.id,
        debtId: debt.id,
        note: note ?? null,
      },
    });
  });
  revalidate();
  return {};
}

export type RepayInput = { debtId: string; amount: string; day: string; accountId: string };

/** A part (or full) repayment: you paying back, or being paid back. */
export async function repayDebt(input: RepayInput): Promise<MoneyResult> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  if (!isId(input.debtId)) return { error: "Debt not found." };
  const debt = await prisma.debt.findFirst({
    where: { id: input.debtId, userId: user.id },
    include: { entries: true },
  });
  if (!debt) return { error: "Debt not found." };
  const amountMinor = parseAmount(String(input.amount ?? ""));
  const remaining = debtStatus(debt, debt.entries.map(toEntry), debt.day).remaining;
  if (!amountMinor) fieldErrors.amount = "Enter an amount above ৳0, with at most 2 decimals.";
  else if (amountMinor > remaining) fieldErrors.amount = "That's more than what's left.";
  const day = entryDay(input.day, user.timezone);
  if (!day || day < debt.day) fieldErrors.day = "Pick a date between the debt and today.";
  const account = await ownedAccount(user.id, input.accountId);
  if (!account) fieldErrors.accountId = "Pick an account.";
  if (Object.keys(fieldErrors).length || !account || !amountMinor || !day) return { fieldErrors };

  await prisma.$transaction(async (tx) => {
    await tx.moneyEntry.create({
      data: {
        userId: user.id,
        kind: "REPAY",
        amountMinor,
        day,
        accountId: account.id,
        debtId: debt.id,
      },
    });
    await settle(tx, debt.id);
  });
  revalidate();
  return {};
}

/** Removes a debt with all its money movements. */
export async function deleteDebt(id: string): Promise<MoneyResult> {
  const user = await requireUser();
  if (!isId(id)) return { error: "Debt not found." };
  const { count } = await prisma.debt.deleteMany({ where: { id, userId: user.id } });
  if (!count) return { error: "Debt not found." };
  revalidate();
  return {};
}

// ---------------------------------------------------------------------------
// Savings goals

export type GoalInput = { id?: string; name: string; target: string; targetDay?: string | null };

export async function saveGoal(input: GoalInput): Promise<MoneyResult> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  const name = String(input.name ?? "").trim();
  if (!name || name.length > NAME_MAX) fieldErrors.name = "Name the goal (up to 60 characters).";
  const targetMinor = parseAmount(String(input.target ?? ""));
  if (!targetMinor) fieldErrors.target = "Enter a target above ৳0.";
  const targetDay = input.targetDay ? input.targetDay : null;
  if (targetDay && !isDayKey(targetDay)) fieldErrors.targetDay = "Pick a valid date.";
  if (Object.keys(fieldErrors).length || !targetMinor) return { fieldErrors };
  const data = { name, targetMinor, targetDay };
  if (input.id) {
    if (!isId(input.id)) return { error: "Goal not found." };
    const { count } = await prisma.savingsGoal.updateMany({
      where: { id: input.id, userId: user.id },
      data,
    });
    if (!count) return { error: "Goal not found." };
  } else {
    await prisma.savingsGoal.create({ data: { ...data, userId: user.id } });
  }
  revalidate();
  return {};
}

export async function setGoalArchived(id: string, archived: boolean): Promise<MoneyResult> {
  const user = await requireUser();
  if (!isId(id)) return { error: "Goal not found." };
  await prisma.savingsGoal.updateMany({
    where: { id, userId: user.id },
    data: { archivedAt: archived ? new Date() : null },
  });
  revalidate();
  return {};
}

export type GoalMoveInput = {
  goalId: string;
  kind: "SAVE" | "WITHDRAW";
  amount: string;
  day: string;
  accountId: string;
};

/** Moves money from an account into a goal (SAVE) or back out of it (WITHDRAW). */
export async function moveGoalMoney(input: GoalMoveInput): Promise<MoneyResult> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  if (input.kind !== "SAVE" && input.kind !== "WITHDRAW") return { error: "Invalid move." };
  if (!isId(input.goalId)) return { error: "Goal not found." };
  const goal = await prisma.savingsGoal.findFirst({
    where: { id: input.goalId, userId: user.id, archivedAt: null },
    include: { entries: true },
  });
  if (!goal) return { error: "Goal not found." };
  const amountMinor = parseAmount(String(input.amount ?? ""));
  if (!amountMinor) fieldErrors.amount = "Enter an amount above ৳0, with at most 2 decimals.";
  else if (
    input.kind === "WITHDRAW" &&
    amountMinor > goalBalance(goal.id, goal.entries.map(toEntry))
  ) {
    fieldErrors.amount = "That's more than the goal holds.";
  }
  const day = entryDay(input.day, user.timezone);
  if (!day) fieldErrors.day = "Pick a date that isn't in the future.";
  const account = await ownedAccount(user.id, input.accountId);
  if (!account) fieldErrors.accountId = "Pick an account.";
  if (Object.keys(fieldErrors).length || !account || !amountMinor || !day) return { fieldErrors };
  await prisma.moneyEntry.create({
    data: {
      userId: user.id,
      kind: input.kind,
      amountMinor,
      day,
      accountId: account.id,
      goalId: goal.id,
    },
  });
  revalidate();
  return {};
}

// ---------------------------------------------------------------------------
// Accounts and categories

const ACCOUNT_KINDS = ["CASH", "MOBILE", "BANK", "OTHER"] as const;

export type AccountInput = {
  id?: string;
  name: string;
  kind: (typeof ACCOUNT_KINDS)[number];
  opening: string;
};

const isZero = (raw: string) => raw === "" || /^0+(\.0+)?$/.test(raw);

export async function saveAccount(input: AccountInput): Promise<MoneyResult> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  const name = String(input.name ?? "").trim();
  if (!name || name.length > NAME_MAX) {
    fieldErrors.name = "Name the account (up to 60 characters).";
  }
  if (!ACCOUNT_KINDS.includes(input.kind)) fieldErrors.kind = "Pick a type.";
  const raw = String(input.opening ?? "").trim();
  const openingMinor = isZero(raw) ? 0 : parseAmount(raw);
  if (openingMinor === null) fieldErrors.opening = "Enter the starting balance, e.g. 1500.50.";
  if (Object.keys(fieldErrors).length || openingMinor === null) return { fieldErrors };
  const data = { name, kind: input.kind, openingMinor };
  if (input.id) {
    if (!isId(input.id)) return { error: "Account not found." };
    const { count } = await prisma.moneyAccount.updateMany({
      where: { id: input.id, userId: user.id },
      data,
    });
    if (!count) return { error: "Account not found." };
  } else {
    const last = await prisma.moneyAccount.findFirst({
      where: { userId: user.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    await prisma.moneyAccount.create({
      data: { ...data, userId: user.id, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
  }
  revalidate();
  return {};
}

export async function setAccountArchived(id: string, archived: boolean): Promise<MoneyResult> {
  const user = await requireUser();
  if (!isId(id)) return { error: "Account not found." };
  if (archived) {
    const active = await prisma.moneyAccount.count({
      where: { userId: user.id, archivedAt: null, id: { not: id } },
    });
    if (active === 0) return { error: "Keep at least one account." };
  }
  await prisma.moneyAccount.updateMany({
    where: { id, userId: user.id },
    data: { archivedAt: archived ? new Date() : null },
  });
  revalidate();
  return {};
}

export type CategoryInput = {
  id?: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  budget?: string;
};

export async function saveCategory(input: CategoryInput): Promise<MoneyResult> {
  const user = await requireUser();
  const fieldErrors: Record<string, string> = {};
  const name = String(input.name ?? "").trim();
  if (!name || name.length > NAME_MAX) {
    fieldErrors.name = "Name the category (up to 60 characters).";
  }
  if (input.kind !== "INCOME" && input.kind !== "EXPENSE") return { error: "Invalid category." };
  const raw = String(input.budget ?? "").trim();
  let budgetMinor: number | null = null;
  if (input.kind === "EXPENSE" && !isZero(raw)) {
    budgetMinor = parseAmount(raw);
    if (budgetMinor === null) fieldErrors.budget = "Enter a monthly limit, or leave it empty.";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  if (input.id) {
    if (!isId(input.id)) return { error: "Category not found." };
    // The kind of an existing category never changes (its entries depend on it).
    const { count } = await prisma.moneyCategory.updateMany({
      where: { id: input.id, userId: user.id },
      data: { name, budgetMinor },
    });
    if (!count) return { error: "Category not found." };
  } else {
    const last = await prisma.moneyCategory.findFirst({
      where: { userId: user.id, kind: input.kind },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    await prisma.moneyCategory.create({
      data: {
        userId: user.id,
        name,
        kind: input.kind,
        budgetMinor,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
  }
  revalidate();
  return {};
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<MoneyResult> {
  const user = await requireUser();
  if (!isId(id)) return { error: "Category not found." };
  await prisma.moneyCategory.updateMany({
    where: { id, userId: user.id },
    data: { archivedAt: archived ? new Date() : null },
  });
  revalidate();
  return {};
}
