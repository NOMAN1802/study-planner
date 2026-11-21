import { ArchiveRestore } from "lucide-react";
import { setHabitArchived } from "@/actions/habits";
import { HabitIconTile } from "@/components/habits/habit-icon";
import { targetSummary } from "@/lib/habit-format";
import type { HabitRow } from "@/lib/habits";

export function ArchivedList({ habits }: { habits: HabitRow[] }) {
  return (
    <ul
      className="divide-y divide-border overflow-hidden rounded-sm border border-border bg-surface"
      aria-label="Archived habits"
    >
      {habits.map((habit) => (
        <li
          key={habit.id}
          className="flex items-center gap-3 px-3 py-3 sm:px-4"
          data-testid="archived-row"
        >
          <HabitIconTile name={habit.icon} color={habit.color} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{habit.name}</p>
            <p className="text-xs text-fg-muted">
              {targetSummary(habit)} · best streak {habit.stats.bestStreak}
            </p>
          </div>
          <form action={setHabitArchived.bind(null, habit.id, false)}>
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
              aria-label={`Restore ${habit.name}`}
            >
              <ArchiveRestore className="size-3.5" aria-hidden />
              Restore
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
