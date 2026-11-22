"use client";

import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  addDebt,
  deleteDebt,
  deleteEntry,
  moveGoalMoney,
  repayDebt,
  saveAccount,
  saveCategory,
  saveEntry,
  saveGoal,
  setAccountArchived,
  setCategoryArchived,
  setGoalArchived,
  type MoneyResult,
} from "@/actions/money";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { amountInput, formatMoney, type AccountKind, type Entry } from "@/lib/money";
import type { MoneyAccount, MoneyCategory } from "@/lib/money-server";
import { cn } from "@/lib/utils";

const iconButton =
  "inline-flex size-8 items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-50";

/** Runs a money action, keeping its errors and whether it succeeded. */
function useMoneyAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<MoneyResult & { ok?: boolean }>({});
  function run(action: () => Promise<MoneyResult>, onOk?: () => void) {
    start(async () => {
      const r = await action();
      const ok = !r.error && !r.fieldErrors;
      setResult({ ...r, ok });
      if (ok) onOk?.();
    });
  }
  return { pending, result, run, clear: () => setResult({}) };
}

function FormError({
  result,
  okText,
}: {
  result: MoneyResult & { ok?: boolean };
  okText?: string;
}) {
  if (result.error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {result.error}
      </p>
    );
  }
  if (result.ok && okText) {
    return (
      <p role="status" className="text-sm text-fg-muted">
        {okText}
      </p>
    );
  }
  return null;
}

/** Amount field with a ৳ prefix and a decimal keypad on phones. */
function AmountInput({
  id,
  name,
  defaultValue,
  invalid,
  required = true,
  placeholder = "0.00",
}: {
  id: string;
  name: string;
  defaultValue?: string;
  invalid?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-fg-muted"
        aria-hidden
      >
        ৳
      </span>
      <Input
        id={id}
        name={name}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        defaultValue={defaultValue}
        invalid={invalid}
        className="pl-7 font-mono tabular-nums"
        required={required}
      />
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex w-full rounded-sm border border-border bg-surface p-0.5 sm:w-auto"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-8 flex-1 items-center justify-center rounded-sm px-3 text-sm transition-colors duration-150 sm:flex-none",
            value === o.value ? "bg-surface-3 font-medium text-fg" : "text-fg-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

function AccountOptions({ accounts }: { accounts: readonly MoneyAccount[] }) {
  return (
    <>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
          {a.archived ? " (archived)" : ""}
        </option>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Income / expense / transfer

type EntryKindChoice = "EXPENSE" | "INCOME" | "TRANSFER";

/** Quick add (and edit) for an income, expense or transfer. */
export function EntryForm({
  accounts,
  categories,
  today,
  entry,
  onDone,
}: {
  accounts: readonly MoneyAccount[];
  categories: readonly MoneyCategory[];
  today: string;
  entry?: Entry;
  onDone?: () => void;
}) {
  const id = useId();
  const [kind, setKind] = useState<EntryKindChoice>(
    entry && (entry.kind === "INCOME" || entry.kind === "TRANSFER") ? entry.kind : "EXPENSE",
  );
  const [formKey, setFormKey] = useState(0);
  const { pending, result, run, clear } = useMoneyAction();
  const fe = result.fieldErrors ?? {};
  // Active accounts, plus archived ones an edited entry already uses.
  const usable = accounts.filter(
    (a) => !a.archived || a.id === entry?.accountId || a.id === entry?.toAccountId,
  );
  const cats = categories.filter(
    (c) => c.kind === kind && (!c.archived || c.id === entry?.categoryId),
  );

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        saveEntry({
          id: entry?.id,
          kind,
          amount: str(f, "amount"),
          day: str(f, "day"),
          accountId: str(f, "accountId"),
          toAccountId: kind === "TRANSFER" ? str(f, "toAccountId") : null,
          categoryId: kind === "TRANSFER" ? null : str(f, "categoryId"),
          note: str(f, "note"),
        }),
      () => {
        if (entry) onDone?.();
        else setFormKey((k) => k + 1);
      },
    );
  }

  const label = entry
    ? "Save changes"
    : kind === "EXPENSE"
      ? "Add expense"
      : kind === "INCOME"
        ? "Add income"
        : "Add transfer";

  return (
    <form
      key={formKey}
      onSubmit={submit}
      className="flex flex-col gap-4"
      noValidate
      aria-label={entry ? "Edit entry" : "Add money entry"}
    >
      <Segmented
        label="Entry type"
        value={kind}
        onChange={(k) => {
          setKind(k);
          clear();
        }}
        options={[
          { value: "EXPENSE", label: "Expense" },
          { value: "INCOME", label: "Income" },
          { value: "TRANSFER", label: "Transfer" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-amount`} label="Amount" error={fe.amount}>
          <AmountInput
            id={`${id}-amount`}
            name="amount"
            defaultValue={entry ? amountInput(entry.amountMinor) : undefined}
            invalid={Boolean(fe.amount)}
          />
        </Field>
        {kind === "TRANSFER" ? null : (
          <Field id={`${id}-category`} label="Category" error={fe.categoryId}>
            <Select
              id={`${id}-category`}
              name="categoryId"
              key={kind}
              defaultValue={entry?.categoryId ?? cats[0]?.id}
              invalid={Boolean(fe.categoryId)}
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          id={`${id}-account`}
          label={
            kind === "TRANSFER" ? "From account" : kind === "INCOME" ? "Into account" : "Paid from"
          }
          error={fe.accountId}
        >
          <Select
            id={`${id}-account`}
            name="accountId"
            defaultValue={entry?.accountId ?? usable[0]?.id}
            invalid={Boolean(fe.accountId)}
          >
            <AccountOptions accounts={usable} />
          </Select>
        </Field>
        {kind === "TRANSFER" ? (
          <Field id={`${id}-to`} label="To account" error={fe.toAccountId}>
            <Select
              id={`${id}-to`}
              name="toAccountId"
              defaultValue={entry?.toAccountId ?? usable[1]?.id ?? usable[0]?.id}
              invalid={Boolean(fe.toAccountId)}
            >
              <AccountOptions accounts={usable} />
            </Select>
          </Field>
        ) : null}
        <Field id={`${id}-day`} label="Date" error={fe.day}>
          <Input
            id={`${id}-day`}
            name="day"
            type="date"
            max={today}
            defaultValue={entry?.day ?? today}
            invalid={Boolean(fe.day)}
            required
          />
        </Field>
        <Field id={`${id}-note`} label="Note (optional)" error={fe.note}>
          <Input
            id={`${id}-note`}
            name="note"
            maxLength={200}
            defaultValue={entry?.note ?? ""}
            placeholder={kind === "EXPENSE" ? "e.g. lunch with Rafi" : undefined}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          {label}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
        <FormError result={result} okText={entry ? undefined : "Saved."} />
      </div>
    </form>
  );
}

/**
 * One entry in a list: its details, with edit (income / expense / transfer)
 * and delete. Debt and savings entries are changed on their own pages.
 */
export function EntryRow({
  entry,
  children,
  label,
  accounts,
  categories,
  today,
}: {
  entry: Entry;
  children: ReactNode;
  label: string;
  accounts: readonly MoneyAccount[];
  categories: readonly MoneyCategory[];
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, result, run } = useMoneyAction();
  const editable = entry.kind === "INCOME" || entry.kind === "EXPENSE" || entry.kind === "TRANSFER";
  const deletable = entry.kind !== "BORROW" && entry.kind !== "LEND";
  if (editing) {
    return (
      <div className="rounded-sm border border-border bg-surface-2 p-3">
        <EntryForm
          accounts={accounts}
          categories={categories}
          today={today}
          entry={entry}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      {editable ? (
        <button
          type="button"
          className={iconButton}
          onClick={() => setEditing(true)}
          aria-label={`Edit ${label}`}
          title="Edit"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      ) : null}
      {deletable ? (
        <button
          type="button"
          disabled={pending}
          className={cn(iconButton, "hover:text-danger")}
          onClick={() => {
            if (window.confirm(`Delete ${label}?`)) run(() => deleteEntry(entry.id));
          }}
          aria-label={`Delete ${label}`}
          title="Delete"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      ) : null}
      {result.error ? (
        <span role="alert" className="text-xs text-danger">
          {result.error}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Borrow & lend

export function DebtForm({
  accounts,
  today,
}: {
  accounts: readonly MoneyAccount[];
  today: string;
}) {
  const id = useId();
  const [direction, setDirection] = useState<"BORROWED" | "LENT">("BORROWED");
  const [formKey, setFormKey] = useState(0);
  const { pending, result, run, clear } = useMoneyAction();
  const fe = result.fieldErrors ?? {};
  const active = accounts.filter((a) => !a.archived);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        addDebt({
          direction,
          person: str(f, "person"),
          amount: str(f, "amount"),
          day: str(f, "day"),
          dueDay: str(f, "dueDay") || null,
          accountId: str(f, "accountId"),
          note: str(f, "note"),
        }),
      () => setFormKey((k) => k + 1),
    );
  }
  return (
    <form
      key={formKey}
      onSubmit={submit}
      className="flex flex-col gap-4"
      noValidate
      aria-label="Add borrowed or lent money"
    >
      <Segmented
        label="Borrowed or lent"
        value={direction}
        onChange={(d) => {
          setDirection(d);
          clear();
        }}
        options={[
          { value: "BORROWED", label: "I borrowed" },
          { value: "LENT", label: "I lent" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`${id}-person`}
          label={direction === "BORROWED" ? "From whom" : "To whom"}
          error={fe.person}
        >
          <Input
            id={`${id}-person`}
            name="person"
            maxLength={60}
            invalid={Boolean(fe.person)}
            required
          />
        </Field>
        <Field id={`${id}-amount`} label="Amount" error={fe.amount}>
          <AmountInput id={`${id}-amount`} name="amount" invalid={Boolean(fe.amount)} />
        </Field>
        <Field
          id={`${id}-account`}
          label={direction === "BORROWED" ? "Into account" : "From account"}
          error={fe.accountId}
        >
          <Select id={`${id}-account`} name="accountId" defaultValue={active[0]?.id}>
            <AccountOptions accounts={active} />
          </Select>
        </Field>
        <Field id={`${id}-day`} label="Date" error={fe.day}>
          <Input
            id={`${id}-day`}
            name="day"
            type="date"
            max={today}
            defaultValue={today}
            required
          />
        </Field>
        <Field id={`${id}-due`} label="Due date (optional)" error={fe.dueDay}>
          <Input id={`${id}-due`} name="dueDay" type="date" />
        </Field>
        <Field id={`${id}-note`} label="Note (optional)" error={fe.note}>
          <Input id={`${id}-note`} name="note" maxLength={200} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          {direction === "BORROWED" ? "Add money I borrowed" : "Add money I lent"}
        </Button>
        <FormError result={result} okText="Saved." />
      </div>
    </form>
  );
}

/** Record a part (or full) repayment of one debt. */
export function RepayForm({
  debtId,
  person,
  direction,
  remaining,
  accounts,
  today,
}: {
  debtId: string;
  person: string;
  direction: "BORROWED" | "LENT";
  remaining: number;
  accounts: readonly MoneyAccount[];
  today: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const { pending, result, run } = useMoneyAction();
  const fe = result.fieldErrors ?? {};
  const active = accounts.filter((a) => !a.archived);
  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {direction === "BORROWED" ? `Pay back ${person}` : `${person} paid back`}
      </Button>
    );
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        repayDebt({
          debtId,
          amount: str(f, "amount"),
          day: str(f, "day"),
          accountId: str(f, "accountId"),
        }),
      () => setOpen(false),
    );
  }
  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-3 rounded-sm border border-border bg-surface-2 p-3 sm:grid-cols-3"
      aria-label={`Repayment for ${person}`}
    >
      <Field id={`${id}-amount`} label="Amount" error={fe.amount}>
        <AmountInput
          id={`${id}-amount`}
          name="amount"
          defaultValue={amountInput(remaining)}
          invalid={Boolean(fe.amount)}
        />
      </Field>
      <Field
        id={`${id}-account`}
        label={direction === "BORROWED" ? "Paid from" : "Into account"}
        error={fe.accountId}
      >
        <Select id={`${id}-account`} name="accountId" defaultValue={active[0]?.id}>
          <AccountOptions accounts={active} />
        </Select>
      </Field>
      <Field id={`${id}-day`} label="Date" error={fe.day}>
        <Input id={`${id}-day`} name="day" type="date" max={today} defaultValue={today} required />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Button type="submit" size="sm" loading={pending}>
          Record repayment
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <FormError result={result} />
      </div>
    </form>
  );
}

export function DeleteDebtButton({ id, person }: { id: string; person: string }) {
  const { pending, result, run } = useMoneyAction();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Delete the debt with ${person} and all its repayments?`)) {
            run(() => deleteDebt(id));
          }
        }}
        aria-label={`Delete debt with ${person}`}
        title="Delete"
        className={cn(iconButton, "hover:text-danger")}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
      {result.error ? (
        <span role="alert" className="text-xs text-danger">
          {result.error}
        </span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Savings goals

type GoalValue = { id: string; name: string; targetMinor: number; targetDay: string | null };

export function GoalForm({
  goal,
  today,
  onDone,
}: {
  goal?: GoalValue;
  today: string;
  onDone?: () => void;
}) {
  const id = useId();
  const [formKey, setFormKey] = useState(0);
  const { pending, result, run } = useMoneyAction();
  const fe = result.fieldErrors ?? {};
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        saveGoal({
          id: goal?.id,
          name: str(f, "name"),
          target: str(f, "target"),
          targetDay: str(f, "targetDay") || null,
        }),
      () => {
        if (goal) onDone?.();
        else setFormKey((k) => k + 1);
      },
    );
  }
  return (
    <form
      key={formKey}
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4"
      aria-label={goal ? `Edit ${goal.name}` : "Add a savings goal"}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${id}-name`} label="Goal" error={fe.name}>
          <Input
            id={`${id}-name`}
            name="name"
            maxLength={60}
            defaultValue={goal?.name}
            placeholder="e.g. Emergency fund"
            invalid={Boolean(fe.name)}
            required
          />
        </Field>
        <Field id={`${id}-target`} label="Target" error={fe.target}>
          <AmountInput
            id={`${id}-target`}
            name="target"
            defaultValue={goal ? amountInput(goal.targetMinor) : undefined}
            invalid={Boolean(fe.target)}
          />
        </Field>
        <Field id={`${id}-day`} label="Reach it by (optional)" error={fe.targetDay}>
          <Input
            id={`${id}-day`}
            name="targetDay"
            type="date"
            min={today}
            defaultValue={goal?.targetDay ?? ""}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          {goal ? "Save goal" : "Add goal"}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
        <FormError result={result} />
      </div>
    </form>
  );
}

/** Edit button that swaps a goal's header for its form. */
export function GoalEditor({
  goal,
  today,
  children,
}: {
  goal: GoalValue;
  today: string;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) return <GoalForm goal={goal} today={today} onDone={() => setEditing(false)} />;
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        className={iconButton}
        onClick={() => setEditing(true)}
        aria-label={`Edit ${goal.name}`}
        title="Edit"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Put money into a goal or take some out. */
export function GoalMoveForm({
  goalId,
  goalName,
  saved,
  accounts,
  today,
}: {
  goalId: string;
  goalName: string;
  saved: number;
  accounts: readonly MoneyAccount[];
  today: string;
}) {
  const id = useId();
  const [kind, setKind] = useState<"SAVE" | "WITHDRAW">("SAVE");
  const [formKey, setFormKey] = useState(0);
  const { pending, result, run, clear } = useMoneyAction();
  const fe = result.fieldErrors ?? {};
  const active = accounts.filter((a) => !a.archived);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        moveGoalMoney({
          goalId,
          kind,
          amount: str(f, "amount"),
          day: str(f, "day"),
          accountId: str(f, "accountId"),
        }),
      () => setFormKey((k) => k + 1),
    );
  }
  return (
    <form
      key={formKey}
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-3"
      aria-label={`Move money for ${goalName}`}
    >
      {saved > 0 ? (
        <Segmented
          label={`${goalName}: add or take out`}
          value={kind}
          onChange={(k) => {
            setKind(k);
            clear();
          }}
          options={[
            { value: "SAVE", label: "Add money" },
            { value: "WITHDRAW", label: "Take out" },
          ]}
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id={`${id}-amount`} label="Amount" error={fe.amount}>
          <AmountInput id={`${id}-amount`} name="amount" invalid={Boolean(fe.amount)} />
        </Field>
        <Field
          id={`${id}-account`}
          label={kind === "SAVE" ? "From account" : "Into account"}
          error={fe.accountId}
        >
          <Select id={`${id}-account`} name="accountId" defaultValue={active[0]?.id}>
            <AccountOptions accounts={active} />
          </Select>
        </Field>
        <Field id={`${id}-day`} label="Date" error={fe.day}>
          <Input
            id={`${id}-day`}
            name="day"
            type="date"
            max={today}
            defaultValue={today}
            required
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" loading={pending}>
          {kind === "SAVE" ? `Add to ${goalName}` : `Take out of ${goalName}`}
        </Button>
        <FormError result={result} okText="Saved." />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Accounts and categories

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  CASH: "Cash",
  MOBILE: "Mobile banking",
  BANK: "Bank",
  OTHER: "Other",
};

export function AccountForm({ account, onDone }: { account?: MoneyAccount; onDone?: () => void }) {
  const id = useId();
  const [formKey, setFormKey] = useState(0);
  const { pending, result, run } = useMoneyAction();
  const fe = result.fieldErrors ?? {};
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        saveAccount({
          id: account?.id,
          name: str(f, "name"),
          kind: str(f, "kind") as AccountKind,
          opening: str(f, "opening"),
        }),
      () => {
        if (account) onDone?.();
        else setFormKey((k) => k + 1);
      },
    );
  }
  return (
    <form
      key={formKey}
      onSubmit={submit}
      noValidate
      className="grid gap-3 sm:grid-cols-4 sm:items-start"
      aria-label={account ? `Edit ${account.name}` : "Add an account"}
    >
      <Field id={`${id}-name`} label="Account" error={fe.name}>
        <Input
          id={`${id}-name`}
          name="name"
          maxLength={60}
          defaultValue={account?.name}
          placeholder="e.g. Nagad"
          invalid={Boolean(fe.name)}
          required
        />
      </Field>
      <Field id={`${id}-kind`} label="Type" error={fe.kind}>
        <Select id={`${id}-kind`} name="kind" defaultValue={account?.kind ?? "MOBILE"}>
          {(Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[]).map((k) => (
            <option key={k} value={k}>
              {ACCOUNT_KIND_LABEL[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`${id}-opening`} label="Starting balance" error={fe.opening}>
        <AmountInput
          id={`${id}-opening`}
          name="opening"
          defaultValue={account ? amountInput(account.openingMinor) : "0"}
          invalid={Boolean(fe.opening)}
          required={false}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2 sm:pt-7">
        <Button type="submit" loading={pending}>
          {account ? "Save" : "Add account"}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
      {result.error ? (
        <div className="sm:col-span-4">
          <FormError result={result} />
        </div>
      ) : null}
    </form>
  );
}

export function CategoryForm({
  kind,
  category,
  onDone,
}: {
  kind: "INCOME" | "EXPENSE";
  category?: MoneyCategory;
  onDone?: () => void;
}) {
  const id = useId();
  const [formKey, setFormKey] = useState(0);
  const { pending, result, run } = useMoneyAction();
  const fe = result.fieldErrors ?? {};
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(
      () =>
        saveCategory({
          id: category?.id,
          name: str(f, "name"),
          kind,
          budget: str(f, "budget"),
        }),
      () => {
        if (category) onDone?.();
        else setFormKey((k) => k + 1);
      },
    );
  }
  const what = kind === "EXPENSE" ? "expense category" : "income source";
  return (
    <form
      key={formKey}
      onSubmit={submit}
      noValidate
      className="grid gap-3 sm:grid-cols-3 sm:items-start"
      aria-label={category ? `Edit ${category.name}` : `Add an ${what}`}
    >
      <Field id={`${id}-name`} label={kind === "EXPENSE" ? "Category" : "Source"} error={fe.name}>
        <Input
          id={`${id}-name`}
          name="name"
          maxLength={60}
          defaultValue={category?.name}
          invalid={Boolean(fe.name)}
          required
        />
      </Field>
      {kind === "EXPENSE" ? (
        <Field id={`${id}-budget`} label="Monthly budget (optional)" error={fe.budget}>
          <AmountInput
            id={`${id}-budget`}
            name="budget"
            placeholder="No limit"
            defaultValue={category?.budgetMinor ? amountInput(category.budgetMinor) : ""}
            invalid={Boolean(fe.budget)}
            required={false}
          />
        </Field>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 sm:pt-7">
        <Button type="submit" loading={pending}>
          {category ? "Save" : kind === "EXPENSE" ? "Add category" : "Add source"}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
      {result.error ? (
        <div className="sm:col-span-3">
          <FormError result={result} />
        </div>
      ) : null}
    </form>
  );
}

/** Archive or restore an account, category or goal. */
export function ArchiveToggle({
  what,
  id,
  name,
  archived,
}: {
  what: "account" | "category" | "goal";
  id: string;
  name: string;
  archived: boolean;
}) {
  const { pending, result, run } = useMoneyAction();
  const action =
    what === "account"
      ? setAccountArchived
      : what === "category"
        ? setCategoryArchived
        : setGoalArchived;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => action(id, !archived))}
        aria-label={`${archived ? "Restore" : "Archive"} ${name}`}
        title={archived ? "Restore" : "Archive"}
        className={iconButton}
      >
        {archived ? (
          <ArchiveRestore className="size-4" aria-hidden />
        ) : (
          <Archive className="size-4" aria-hidden />
        )}
      </button>
      {result.error ? (
        <span role="alert" className="text-xs text-danger">
          {result.error}
        </span>
      ) : null}
    </span>
  );
}

/** An account in the settings list, editable in place. */
export function AccountRow({ account }: { account: MoneyAccount & { balance: number } }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <AccountForm account={account} onDone={() => setEditing(false)} />;
  return (
    <div className="flex items-center gap-3" data-testid="account-row">
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", account.archived ? "text-fg-muted" : "text-fg")}>
          {account.name}
          {account.archived ? " (archived)" : ""}
        </p>
        <p className="text-xs text-fg-muted">
          {ACCOUNT_KIND_LABEL[account.kind]} · started with {formatMoney(account.openingMinor)}
        </p>
      </div>
      <span className="font-mono text-sm tabular-nums">{formatMoney(account.balance)}</span>
      <button
        type="button"
        className={iconButton}
        onClick={() => setEditing(true)}
        aria-label={`Edit ${account.name}`}
        title="Edit"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <ArchiveToggle
        what="account"
        id={account.id}
        name={account.name}
        archived={account.archived}
      />
    </div>
  );
}

/** A category in the settings list, editable in place (name and monthly budget). */
export function CategoryRow({ category }: { category: MoneyCategory }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <CategoryForm kind={category.kind} category={category} onDone={() => setEditing(false)} />
    );
  }
  return (
    <div className="flex items-center gap-3" data-testid="category-row">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: category.color }}
        aria-hidden
      />
      <p className={cn("min-w-0 flex-1 text-sm", category.archived ? "text-fg-muted" : "text-fg")}>
        {category.name}
        {category.archived ? " (archived)" : ""}
      </p>
      {category.kind === "EXPENSE" ? (
        <span className="font-mono text-xs text-fg-muted tabular-nums">
          {category.budgetMinor ? `${formatMoney(category.budgetMinor)} / month` : "no budget"}
        </span>
      ) : null}
      <button
        type="button"
        className={iconButton}
        onClick={() => setEditing(true)}
        aria-label={`Edit ${category.name}`}
        title="Edit"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <ArchiveToggle
        what="category"
        id={category.id}
        name={category.name}
        archived={category.archived}
      />
    </div>
  );
}
