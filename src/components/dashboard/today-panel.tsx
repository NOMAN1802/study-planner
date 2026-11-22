"use client";

import { ArrowUpRight, CalendarClock, Check, Plus, Timer } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { checkIn } from "@/actions/habits";
import { setTaskStatus } from "@/actions/tasks";
import { HabitIconTile } from "@/components/habits/habit-icon";
import { PriorityBadge } from "@/components/tasks/badges";
import type { TodayHabit, TodayTask } from "@/lib/dashboard";
import { currentPeriodLabel } from "@/lib/dates";
import { logProgress } from "@/lib/streaks";
import { cn } from "@/lib/utils";

const subheading = "text-xs font-medium text-fg-muted";
const action =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-sm px-3 text-sm transition-colors duration-150";

/**
 * Today's habits as a compact checklist (two columns on wide screens when
 * there are no tasks beside them) and the tasks due. With nothing due, tasks
 * shrink to one line under the habits.
 */
export function TodayPanel({ habits, tasks }: { habits: TodayHabit[]; tasks: TodayTask[] }) {
  const twoColumns = tasks.length === 0 && habits.length > 4;
  const habitList =
    habits.length === 0 ? (
      <p className="mt-2 text-sm text-fg-muted">
        No habits to check in right now.{" "}
        <Link href="/habits/new" className="text-fg underline underline-offset-2">
          Add a habit
        </Link>
      </p>
    ) : (
      <ul
        className={cn("mt-1 grid gap-x-8", twoColumns && "xl:grid-cols-2")}
        aria-label="Habits due"
      >
        {habits.map((habit) => (
          <HabitItem key={habit.id} habit={habit} twoColumns={twoColumns} />
        ))}
      </ul>
    );

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <h3 className={subheading}>Habits</h3>
          {habitList}
        </div>
        <p className="border-t border-border pt-3 text-sm text-fg-muted">
          <span className="font-medium text-fg">Tasks</span> · Nothing due today.{" "}
          <Link href="/tasks" className="text-fg underline underline-offset-2">
            See all tasks
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
      <div className="min-w-0">
        <h3 className={subheading}>Habits</h3>
        {habitList}
      </div>
      <div className="min-w-0">
        <h3 className={subheading}>Tasks</h3>
        <ul className="mt-1" aria-label="Tasks due">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function HabitItem({ habit, twoColumns }: { habit: TodayHabit; twoColumns: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [current, bump] = useOptimistic(habit.current, (cur, delta: number) => ({
    ...cur,
    count: cur.count + delta,
  }));

  const complete = logProgress(current, habit) >= 1;
  const minutesOnly = !habit.targetCount && Boolean(habit.targetMinutes);
  const periodLabel = currentPeriodLabel(habit.frequency);
  const countLabel = habit.targetCount
    ? `${current.count}/${habit.targetCount}`
    : habit.targetMinutes
      ? `${current.minutes}/${habit.targetMinutes} min`
      : null;

  function handleCheckIn() {
    setError(null);
    startTransition(async () => {
      bump(1);
      const result = await checkIn(habit.id);
      if (result.error) setError(result.error);
    });
  }

  let control;
  if (complete) {
    // Done is a quiet state, not a button that shouts.
    control = (
      <button
        type="button"
        disabled
        aria-label={`${habit.name} done ${periodLabel}`}
        className={cn(action, "cursor-default text-accent")}
      >
        <Check className="size-4" aria-hidden />
        Done
      </button>
    );
  } else if (habit.dailyOnly) {
    control = (
      <Link
        href="/habits/daily"
        aria-label={`Tick ${habit.name} on Daily`}
        className={cn(action, "text-fg-muted hover:bg-surface-2 hover:text-fg")}
      >
        Daily
        <ArrowUpRight className="size-3.5" aria-hidden />
      </Link>
    );
  } else if (minutesOnly) {
    control = (
      <Link
        href="/habits"
        aria-label={`Log time for ${habit.name}`}
        className={cn(action, "border border-border text-fg hover:bg-surface-2")}
      >
        Log time
      </Link>
    );
  } else {
    control = (
      <button
        type="button"
        onClick={handleCheckIn}
        disabled={pending}
        aria-label={`Check in ${habit.name}`}
        className={cn(
          action,
          "border border-border text-fg hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <Plus className="size-3.5" aria-hidden />
        Check in
      </button>
    );
  }

  return (
    <li
      className={cn(
        "border-t border-border first:border-t-0",
        twoColumns && "xl:[&:nth-child(2)]:border-t-0",
      )}
      data-testid="today-habit"
    >
      <div className="flex min-h-12 items-center gap-3 py-2">
        <HabitIconTile name={habit.icon} color={habit.color} />
        <p
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            complete ? "text-fg-muted" : "font-medium text-fg",
          )}
        >
          {habit.name}
        </p>
        {countLabel ? (
          <span
            className="shrink-0 font-mono text-xs text-fg-muted tabular-nums"
            data-testid="today-habit-count"
          >
            {countLabel}
          </span>
        ) : null}
        {control}
      </div>
      {error ? (
        <p role="alert" className="pb-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function TaskItem({ task }: { task: TodayTask }) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(task.done, (_cur, next: boolean) => next);
  const overdue = task.overdue && !done;

  function toggle() {
    const next = !done;
    setError(null);
    startTransition(async () => {
      setDone(next);
      const result = await setTaskStatus(task.id, next ? "DONE" : "TODO");
      if (result.error) setError(result.error);
    });
  }

  return (
    <li className="border-t border-border py-2.5 first:border-t-0" data-testid="today-task">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          onChange={toggle}
          aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded-sm accent-(--accent)"
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm font-medium transition-colors duration-200",
              done ? "text-fg-subtle line-through" : "text-fg",
            )}
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
            {task.dueLabel ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  overdue && "font-medium text-danger",
                )}
                data-testid="today-task-due"
              >
                <CalendarClock className="size-3.5" aria-hidden />
                {overdue ? "Overdue · " : ""}
                {task.dueLabel}
              </span>
            ) : null}
            <PriorityBadge priority={task.priority} />
          </div>
        </div>
        {!done ? (
          <Link
            href={`/tasks/${task.id}/focus`}
            aria-label={`Focus on ${task.title}`}
            title="Focus timer"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <Timer className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}
