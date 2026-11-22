import type { Metadata } from "next";
import Link from "next/link";
import { RangeFilter } from "@/components/daily-habits/range-filter";
import { Panel } from "@/components/dashboard/panel";
import { EntryForm } from "@/components/money/forms";
import { EntryList, TotalsGrid } from "@/components/money/views";
import { requireUser } from "@/lib/auth";
import { resolveRange } from "@/lib/daily-habits";
import { ENTRY_LABEL, totals, type EntryKind } from "@/lib/money";
import { getTransactions, moneyToday } from "@/lib/money-server";

export const metadata: Metadata = { title: "Transactions" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const KINDS = Object.keys(ENTRY_LABEL) as EntryKind[];
const control =
  "h-9 rounded-sm border border-border bg-surface px-3 text-sm text-fg hover:border-border-strong";

export default async function TransactionsPage({ searchParams }: PageProps<"/money/transactions">) {
  const user = await requireUser();
  const params = await searchParams;
  const range = resolveRange(params, moneyToday(user), user.weekStartsOn, "month");
  const kind = first(params.kind);
  const filters = {
    kind: KINDS.includes(kind as EntryKind) ? (kind as EntryKind) : undefined,
    categoryId: first(params.category) || undefined,
    accountId: first(params.account) || undefined,
    q: first(params.q) || undefined,
  };
  const data = await getTransactions(user, range, filters);
  const filtered = Boolean(filters.kind || filters.categoryId || filters.accountId || filters.q);
  const sum = totals(data.entries, new Map(), range.from, range.to);
  const rangeQuery =
    range.kind === "custom"
      ? `range=custom&from=${range.from}&to=${range.to}`
      : `range=${range.kind}&date=${range.date}`;

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <RangeFilter basePath="/money/transactions" range={range} today={data.today} />

      <form
        method="get"
        action="/money/transactions"
        className="flex flex-wrap items-end gap-3"
        aria-label="Filter transactions"
      >
        <input type="hidden" name="range" value={range.kind} />
        {range.kind === "custom" ? (
          <>
            <input type="hidden" name="from" value={range.from} />
            <input type="hidden" name="to" value={range.to} />
          </>
        ) : (
          <input type="hidden" name="date" value={range.date} />
        )}
        <label className="flex flex-col gap-1 text-xs text-fg-muted">
          Type
          <select name="kind" defaultValue={filters.kind ?? ""} className={control}>
            <option value="">All</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {ENTRY_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-fg-muted">
          Category
          <select name="category" defaultValue={filters.categoryId ?? ""} className={control}>
            <option value="">All</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-fg-muted">
          Account
          <select name="account" defaultValue={filters.accountId ?? ""} className={control}>
            <option value="">All</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-fg-muted">
          Note contains
          <input name="q" defaultValue={filters.q ?? ""} className={control} />
        </label>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-strong"
        >
          Filter
        </button>
        {filtered ? (
          <Link
            href={`/money/transactions?${rangeQuery}`}
            className="pb-2 text-sm font-medium text-accent hover:underline"
          >
            Clear
          </Link>
        ) : null}
      </form>

      <TotalsGrid t={sum} />

      <details className="rounded-sm border border-border bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Add an entry</summary>
        <div className="border-t border-border p-4">
          <EntryForm accounts={data.accounts} categories={data.categories} today={data.today} />
        </div>
      </details>

      <Panel
        id="entries"
        title={`${data.entries.length} ${data.entries.length === 1 ? "entry" : "entries"}`}
      >
        {data.entries.length ? (
          <EntryList entries={data.entries} lookups={data} today={data.today} />
        ) : (
          <p className="text-sm text-fg-muted">No entries match.</p>
        )}
      </Panel>
    </div>
  );
}
