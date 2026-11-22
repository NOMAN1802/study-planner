import type { Metadata } from "next";
import { Panel } from "@/components/dashboard/panel";
import { DebtForm } from "@/components/money/forms";
import { DebtList, Stat } from "@/components/money/views";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { getDebts } from "@/lib/money-server";

export const metadata: Metadata = { title: "Borrow & Lend" };

export default async function DebtsPage() {
  const user = await requireUser();
  const data = await getDebts(user);
  const open = data.debts.filter((d) => !d.status.settled);
  const settled = data.debts.filter((d) => d.status.settled);
  const owe = open.filter((d) => d.direction === "BORROWED");
  const owed = open.filter((d) => d.direction === "LENT");

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat id="owe" label="You owe" value={formatMoney(data.totals.owe)} />
        <Stat id="owed" label="Owed to you" value={formatMoney(data.totals.owed)} />
        <Stat
          id="overdue"
          label="Overdue"
          value={String(data.totals.overdue)}
          tone={data.totals.overdue ? "bad" : undefined}
        />
      </dl>

      <Panel id="add-debt" title="Add">
        <DebtForm accounts={data.accounts} today={data.today} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel id="i-owe" title="I owe">
          <DebtList debts={owe} accounts={data.accounts} today={data.today} />
        </Panel>
        <Panel id="owed-to-me" title="Owed to me">
          <DebtList debts={owed} accounts={data.accounts} today={data.today} />
        </Panel>
      </div>

      {settled.length ? (
        <Panel id="settled" title="Settled">
          <DebtList debts={settled} accounts={data.accounts} today={data.today} />
        </Panel>
      ) : null}
    </div>
  );
}
