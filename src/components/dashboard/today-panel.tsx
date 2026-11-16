"use client";

import { CalendarClock, Check, Plus, Timer } from "lucide-react";
import { motion, MotionConfig } from "motion/react";
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

const subheading = "text-xs font-medium tracking-wide text-fg-muted uppercase";

export function TodayPanel({ habits, tasks }: { habits: TodayHabit[]; tasks: TodayTask[] }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className={subheading}>Habits</h3>
          {habits.length === 0 ? (
            <p className="mt-2 text-sm text-fg-muted">
              No habits to check in right now.{" "}
              <Link href="/habits/new" className="text-fg underline underline-offset-2">
                Add a habit
              </Link>
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-border" aria-label="Habits due">
              {habits.map((habit) => (
                <HabitItem key={habit.id} habit={habit} />
              ))}
            </ul>
          )}
        </div>
        <div className="min-w-0">
          <h3 className={subheading}>Tasks</h3>
          {tasks.length === 0 ? (
            <p className="mt-2 text-sm text-fg-muted">
              Nothing due today.{" "}
              <Link href="/tasks" className="text-fg underline underline-offset-2">
                See all tasks
              </Link>
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-border" aria-label="Tasks due">
              {tasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </MotionConfig>
  );
}

function HabitItem({ habit }: { habit: TodayHabit }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [current, bump] = useOptimistic(habit.current, (cur, delta: number) => ({
    ...cur,
    count: cur.count + delta,
  }));

  const progress = logProgress(current, habit);
  const complete = progress >= 1;
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

  const action =
    "inline-flex h-8 min-w-24 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors duration-150";

  return (
    <li className="py-2.5" data-testid="today-habit">
      <div className="flex items-center gap-3">
        <HabitIconTile name={habit.icon} color={habit.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{habit.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1 w-full max-w-32 overflow-hidden rounded-full bg-surface-3">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{ backgroundColor: habit.color }}
                initial={false}
                animate={{ scaleX: progress }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </div>
            <span className="shrink-0 text-xs text-fg-muted">
              {countLabel ? (
                <span className="font-mono tabular-nums" data-testid="today-habit-count">
                  {countLabel}
                </span>
              ) : (
                periodLabel
              )}
            </span>
          </div>
        </div>
        {minutesOnly && !complete ? (
          <Link
            href="/habits"
            aria-label={`Log time for ${habit.name}`}
            className={cn(action, "border-border bg-surface text-fg hover:bg-surface-2")}
          >
            Log time
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={pending || complete}
            aria-label={complete ? `${habit.name} done ${periodLabel}` : `Check in ${habit.name}`}
            className={cn(
              action,
              "disabled:cursor-not-allowed",
              complete
                ? "border-transparent bg-accent text-accent-fg"
                : "border-border bg-surface text-fg hover:bg-surface-2 disabled:opacity-50",
            )}
          >
            {complete ? (
              <motion.span
                key="done"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="inline-flex items-center gap-1.5"
              >
                <Check className="size-3.5" aria-hidden />
                Done
              </motion.span>
            ) : (
              <>
                <Plus className="size-3.5" aria-hidden />
                Check in
              </>
            )}
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
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
    <li className="py-2.5" data-testid="today-task">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          onChange={toggle}
          aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-(--accent)"
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
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
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
