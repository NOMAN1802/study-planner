"use client";

import { CalendarClock, Clock, Pencil, Timer, Trash2 } from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { deleteTask, setTaskStatus } from "@/actions/tasks";
import { PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import type { TaskRow } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/schemas/task";

type Optimistic =
  { type: "status"; id: string; status: TaskStatus } | { type: "delete"; id: string };

export function TaskList({ tasks }: { tasks: TaskRow[] }) {
  const [rows, apply] = useOptimistic(tasks, (state, change: Optimistic) =>
    change.type === "delete"
      ? state.filter((t) => t.id !== change.id)
      : state.map((t) =>
          t.id === change.id
            ? { ...t, status: change.status, overdue: change.status === "DONE" ? false : t.overdue }
            : t,
        ),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(change: Optimistic, action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      apply(change);
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <MotionConfig reducedMotion="user">
      {error ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ul
        className="divide-y divide-border overflow-hidden rounded-sm border border-border bg-surface"
        aria-label="Tasks"
      >
        <AnimatePresence initial={false}>
          {rows.map((task) => (
            <motion.li
              key={task.id}
              layout="position"
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              data-testid="task-row"
            >
              <TaskItem
                task={task}
                onToggle={() => {
                  const status: TaskStatus = task.status === "DONE" ? "TODO" : "DONE";
                  run({ type: "status", id: task.id, status }, () =>
                    setTaskStatus(task.id, status),
                  );
                }}
                onDelete={() => run({ type: "delete", id: task.id }, () => deleteTask(task.id))}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </MotionConfig>
  );
}

const iconButton =
  "inline-flex size-8 items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg";

function TaskItem({
  task,
  onToggle,
  onDelete,
}: {
  task: TaskRow;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const done = task.status === "DONE";
  const overBudget = task.targetMinutes != null && task.actualMinutes > task.targetMinutes;

  return (
    <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
      <input
        type="checkbox"
        checked={done}
        onChange={onToggle}
        aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded-sm accent-(--accent)"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2
            className={cn(
              "text-sm font-medium transition-colors duration-200",
              done ? "text-fg-subtle line-through" : "text-fg",
            )}
          >
            {task.title}
          </h2>
          <StatusBadge status={task.status} />
          {task.category === "OFFICE" ? (
            <span className="rounded-sm border border-border px-1.5 text-[11px] leading-5 text-fg-muted">
              Office
            </span>
          ) : null}
        </div>
        {task.note ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-fg-muted">{task.note}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          <PriorityBadge priority={task.priority} />
          {task.dueLabel ? (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                task.overdue && "font-medium text-danger",
              )}
              data-testid="task-due"
            >
              <CalendarClock className="size-3.5" aria-hidden />
              {task.overdue ? "Overdue · " : ""}
              {task.dueLabel}
            </span>
          ) : null}
          {task.targetMinutes || task.actualMinutes ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-mono tabular-nums",
                overBudget && "text-warning",
              )}
            >
              <Clock className="size-3.5" aria-hidden />
              {task.actualMinutes}
              {task.targetMinutes ? `/${task.targetMinutes}` : ""} min
            </span>
          ) : null}
          {task.habit ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: task.habit.color }}
                aria-hidden
              />
              {task.habit.name}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {confirming ? (
          <>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-8 items-center rounded-sm bg-danger px-3 text-sm font-medium text-danger-fg hover:opacity-90"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="inline-flex h-8 items-center rounded-sm px-3 text-sm text-fg-muted hover:bg-surface-2"
            >
              Keep
            </button>
          </>
        ) : (
          <>
            {!done ? (
              <Link
                href={`/tasks/${task.id}/focus`}
                className={iconButton}
                aria-label={`Focus on ${task.title}`}
                title="Focus timer"
              >
                <Timer className="size-4" aria-hidden />
              </Link>
            ) : null}
            <Link
              href={`/tasks/${task.id}/edit`}
              className={iconButton}
              aria-label={`Edit ${task.title}`}
              title="Edit"
            >
              <Pencil className="size-4" aria-hidden />
            </Link>
            <button
              type="button"
              className={cn(iconButton, "hover:text-danger")}
              aria-label={`Delete ${task.title}`}
              title="Delete"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
