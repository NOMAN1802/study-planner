import { Check } from "lucide-react";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import type { RingStat, TodayHabit } from "@/lib/dashboard";

type DailyRingsProps = {
  ring: RingStat;
  habits: TodayHabit[];
  taskRing: RingStat;
};

export function DailyRings({ ring, habits, taskRing }: DailyRingsProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:items-center sm:gap-x-6">
        <Summary
          testId="ring-daily"
          stat={ring}
          caption="daily habits done"
          empty="No daily habits"
          label="Daily habits completed today"
        />
        <Summary
          testId="ring-tasks"
          stat={taskRing}
          caption="tasks due today done"
          empty="No tasks due today"
          label="Tasks due today completed"
        />
      </div>

      {habits.length > 0 ? (
        <ul
          className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-x-2 gap-y-4 border-t border-border pt-4"
          aria-label="Daily habit targets"
        >
          {habits.map((h) => (
            <li
              key={h.id}
              className="flex min-w-0 flex-col items-center gap-1.5"
              data-testid="ring-habit"
            >
              <ProgressRing
                ratio={h.progress}
                size={48}
                stroke={5}
                color={h.color}
                label={`${h.name} progress today`}
              >
                {h.complete ? (
                  <Check className="size-4" style={{ color: h.color }} aria-label="Done" />
                ) : (
                  <span className="font-mono text-[11px] text-fg-muted tabular-nums">
                    {Math.round(h.progress * 100)}%
                  </span>
                )}
              </ProgressRing>
              <span className="w-full truncate text-center text-xs text-fg-muted" title={h.name}>
                {h.name}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-border pt-4 text-sm text-fg-muted">
          Habits that repeat every day get a ring here.
        </p>
      )}
    </div>
  );
}

function Summary({
  testId,
  stat,
  caption,
  empty,
  label,
}: {
  testId: string;
  stat: RingStat;
  caption: string;
  empty: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
      <ProgressRing ratio={stat.ratio} size={72} stroke={7} label={label}>
        <span className="font-mono text-sm font-medium text-fg tabular-nums" data-testid={testId}>
          {stat.done}/{stat.total}
        </span>
      </ProgressRing>
      <p className="text-xs text-fg-muted sm:max-w-24">{stat.total === 0 ? empty : caption}</p>
    </div>
  );
}
