import type { Metadata } from "next";
import { Panel } from "@/components/dashboard/panel";
import { GoalForm } from "@/components/money/forms";
import { GoalCards, Stat } from "@/components/money/views";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { getGoals } from "@/lib/money-server";

export const metadata: Metadata = { title: "Savings" };

export default async function SavingsPage() {
  const user = await requireUser();
  const data = await getGoals(user);
  const active = data.goals.filter((g) => !g.archived);
  const archived = data.goals.filter((g) => g.archived);
  const saved = active.reduce((n, g) => n + g.saved, 0);
  const target = active.reduce((n, g) => n + g.targetMinor, 0);

  return (
    <div className="enter mx-auto flex w-full max-w-page flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3">
        <Stat id="saved-total" label="Saved in goals" value={formatMoney(saved)} />
        <Stat id="target-total" label="Targets" value={formatMoney(target)} />
      </dl>

      <Panel id="add-goal" title="New goal">
        <GoalForm today={data.today} />
      </Panel>

      {active.length ? (
        <GoalCards goals={active} accounts={data.accounts} today={data.today} />
      ) : (
        <p className="text-sm text-fg-muted">
          No goals yet. Add one above, then move money into it from an account.
        </p>
      )}

      {archived.length ? (
        <Panel id="archived-goals" title="Archived">
          <GoalCards goals={archived} accounts={data.accounts} today={data.today} />
        </Panel>
      ) : null}
    </div>
  );
}
