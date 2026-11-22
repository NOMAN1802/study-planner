import type { DayScore } from "@/lib/daily-habits";
import { weekdayOf } from "@/lib/planner";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Today's daily-habit score and the last 7 days as bars. */
export function HabitWeek({
  week,
}: {
  week: { today: DayScore; done: number; total: number; days: DayScore[]; average: number | null };
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-end">
      <dl className="flex gap-6">
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-fg-muted">Today</dt>
          <dd
            className="font-mono text-2xl font-medium tabular-nums"
            data-testid="habit-week-today"
          >
            {week.today.pct ?? 0}%
          </dd>
          <dd className="text-xs text-fg-muted">
            {week.done} of {week.total} done
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-fg-muted">7-day average</dt>
          <dd className="font-mono text-2xl font-medium tabular-nums">
            {week.average === null ? "–" : `${week.average}%`}
          </dd>
        </div>
      </dl>
      <ol className="grid grid-cols-7 gap-2" aria-label="Last 7 days">
        {week.days.map((d) => (
          <li key={d.day} className="flex flex-col items-center gap-1">
            <span className="flex h-16 w-full items-end overflow-hidden rounded-sm bg-surface-2">
              <span
                className="block w-full rounded-sm bg-accent"
                style={{ height: `${d.pct ?? 0}%` }}
                aria-hidden
              />
            </span>
            <span className="text-[11px] text-fg-muted">
              {WEEKDAY[weekdayOf(d.day)]}
              <span className="sr-only">: {d.pct === null ? "no habits" : `${d.pct}%`}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
