import { Flame } from "lucide-react";
import { HabitIconTile } from "@/components/habits/habit-icon";
import type { StreakRow } from "@/lib/dashboard-server";
import { periodNoun } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function StreakList({ rows }: { rows: StreakRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-fg-muted">Streaks appear once you have a habit.</p>;
  }
  return (
    <ol className="divide-y divide-border" aria-label="Streaks">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 py-2" data-testid="streak-row">
          <HabitIconTile name={row.icon} color={row.color} />
          <span className="min-w-0 flex-1 truncate text-sm text-fg">{row.name}</span>
          <dl className="flex shrink-0 items-center gap-4 text-xs text-fg-muted">
            <div className="flex items-center gap-1">
              <dt className="sr-only">Current streak</dt>
              <Flame
                className={cn("size-3.5", row.currentStreak > 0 && "text-warning")}
                aria-hidden
              />
              <dd className="font-mono text-sm text-fg tabular-nums" data-testid="streak-current">
                {row.currentStreak}
              </dd>
              <dd>{periodNoun(row.frequency, row.currentStreak)}</dd>
            </div>
            <div className="flex w-14 items-center justify-end gap-1">
              <dt>Best</dt>
              <dd className="font-mono text-fg tabular-nums" data-testid="streak-best">
                {row.bestStreak}
              </dd>
            </div>
            <div className="hidden w-10 justify-end sm:flex">
              <dt className="sr-only">Completion rate</dt>
              <dd className="font-mono tabular-nums">{Math.round(row.completionRate * 100)}%</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}
