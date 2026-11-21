import Link from "next/link";
import type { TaskTimeRow } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

export function TaskTime({ rows }: { rows: TaskTimeRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        Give a task a time target to compare it with the time you actually focus on it.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3" aria-label="Target versus actual time">
      {rows.map((row) => (
        <li key={row.id} data-testid="task-time-row">
          <div className="flex items-baseline justify-between gap-3">
            <Link
              href={`/tasks/${row.id}/focus`}
              className={cn(
                "min-w-0 truncate text-sm hover:underline",
                row.done ? "text-fg-muted line-through" : "text-fg",
              )}
            >
              {row.title}
            </Link>
            <span className="shrink-0 text-xs text-fg-muted">
              {row.over ? (
                <span className="mr-2 font-medium text-warning" data-testid="task-time-over">
                  +{row.actual - row.target} over
                </span>
              ) : null}
              <span className="font-mono tabular-nums" data-testid="task-time-value">
                {row.actual}/{row.target} min
              </span>
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-label={`${row.title}: time spent against target`}
            aria-valuemin={0}
            aria-valuemax={row.target}
            aria-valuenow={Math.min(row.actual, row.target)}
            aria-valuetext={`${row.actual} of ${row.target} minutes`}
          >
            <div
              className={cn("h-full rounded-full", row.over ? "bg-warning" : "bg-accent")}
              style={{ width: `${Math.min(1, row.ratio) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
