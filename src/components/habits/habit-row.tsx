"use client";

import { Archive, ArrowDown, ArrowUp, Check, Flame, NotebookPen, Pencil, Plus } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { checkIn, setHabitArchived } from "@/actions/habits";
import { CheckInPanel } from "@/components/habits/check-in-panel";
import { HabitIconTile } from "@/components/habits/habit-icon";
import { currentPeriodLabel, periodNoun } from "@/lib/dates";
import { targetSummary } from "@/lib/habit-format";
import type { HabitRow as HabitRowData } from "@/lib/habits";
import { logProgress } from "@/lib/streaks";
import { cn } from "@/lib/utils";

const iconButton =
  "inline-flex size-8 items-center justify-center rounded-sm text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-40";

type HabitRowProps = {
  habit: HabitRowData;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
};

export function HabitRow({ habit, isFirst, isLast, onMove }: HabitRowProps) {
  const [logOpen, setLogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [optimistic, addCheckIn] = useOptimistic(habit.current, (cur, delta: number) => ({
    ...cur,
    count: cur.count + delta,
  }));

  const target = { targetCount: habit.targetCount, targetMinutes: habit.targetMinutes };
  const progress = logProgress(optimistic, target);
  const complete = progress >= 1;
  const minutesOnly = !habit.targetCount && Boolean(habit.targetMinutes);
  const periodLabel = currentPeriodLabel(habit.frequency);
  const inactive = habit.frequency === "HOURLY" && !habit.activeNow;
  const { currentStreak, bestStreak, completionRate } = habit.stats;

  function handleCheckIn() {
    if (minutesOnly) {
      setLogOpen(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      addCheckIn(1);
      const result = await checkIn(habit.id);
      if (result.error) setError(result.error);
    });
  }

  const countLabel = habit.targetCount
    ? `${optimistic.count}/${habit.targetCount}`
    : habit.targetMinutes
      ? `${optimistic.minutes}/${habit.targetMinutes} min`
      : null;

  return (
    <div className="overflow-hidden rounded-sm border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:flex-nowrap sm:px-4">
        <HabitIconTile name={habit.icon} color={habit.color} />

        <div className="min-w-0 flex-1 basis-40">
          <div className="flex items-baseline gap-2">
            <h2 className="truncate text-sm font-medium text-fg">{habit.name}</h2>
            <span className="shrink-0 text-xs text-fg-muted">{targetSummary(habit)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div
              className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              aria-label={`${habit.name} progress ${periodLabel}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <motion.div
                className="h-full origin-left rounded-full"
                style={{ backgroundColor: habit.color }}
                initial={false}
                animate={{ scaleX: progress }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </div>
            {countLabel ? (
              <span
                className="shrink-0 font-mono text-xs text-fg-muted tabular-nums"
                data-testid="habit-count"
              >
                {countLabel}
              </span>
            ) : null}
          </div>
        </div>

        <dl className="flex shrink-0 items-center gap-4 text-xs text-fg-muted">
          <div className="flex items-center gap-1" title="Current streak">
            <dt className="sr-only">Current streak</dt>
            <Flame className={cn("size-3.5", currentStreak > 0 && "text-warning")} aria-hidden />
            <dd className="font-mono text-fg tabular-nums" data-testid="current-streak">
              {currentStreak}
            </dd>
            <dd>{periodNoun(habit.frequency, currentStreak)}</dd>
          </div>
          <div className="hidden items-center gap-1 sm:flex" title="Best streak">
            <dt>Best</dt>
            <dd className="font-mono text-fg tabular-nums" data-testid="best-streak">
              {bestStreak}
            </dd>
          </div>
          <div className="hidden items-center gap-1 md:flex" title="Completion rate">
            <dt className="sr-only">Completion rate</dt>
            <dd className="font-mono text-fg tabular-nums">{Math.round(completionRate * 100)}%</dd>
          </div>
        </dl>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={pending || inactive || (complete && !minutesOnly)}
            aria-label={complete ? `${habit.name} done ${periodLabel}` : `Check in ${habit.name}`}
            className={cn(
              "inline-flex h-8 min-w-24 items-center justify-center gap-2 rounded-sm border px-3 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed",
              complete
                ? "border-transparent bg-accent text-accent-fg"
                : "border-border bg-surface text-fg hover:bg-surface-2 disabled:opacity-50",
            )}
          >
            {complete ? (
              <motion.span
                key="done"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="inline-flex items-center gap-2"
              >
                <Check className="size-3.5" aria-hidden />
                Done
              </motion.span>
            ) : inactive ? (
              "Off hours"
            ) : (
              <>
                <Plus className="size-3.5" aria-hidden />
                {minutesOnly ? "Log time" : "Check in"}
              </>
            )}
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={`Log details for ${habit.name}`}
            aria-expanded={logOpen}
            title="Log count, minutes and note"
            onClick={() => setLogOpen((v) => !v)}
          >
            <NotebookPen className="size-4" aria-hidden />
          </button>
          <Link
            href={`/habits/${habit.id}/edit`}
            className={iconButton}
            aria-label={`Edit ${habit.name}`}
            title="Edit"
          >
            <Pencil className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            className={iconButton}
            aria-label={`Move ${habit.name} up`}
            title="Move up"
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={`Move ${habit.name} down`}
            title="Move down"
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
          <form action={setHabitArchived.bind(null, habit.id, true)}>
            <button
              type="submit"
              className={iconButton}
              aria-label={`Archive ${habit.name}`}
              title="Archive"
            >
              <Archive className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>

      {habit.note || optimistic.note ? (
        <p
          className="border-t border-border px-3 py-2 text-xs text-fg-muted sm:px-4"
          data-testid="habit-note"
        >
          {optimistic.note ? (
            <>
              <span className="font-medium text-fg">
                {periodLabel[0].toUpperCase() + periodLabel.slice(1)}:
              </span>{" "}
              {optimistic.note}
            </>
          ) : (
            habit.note
          )}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="border-t border-border px-4 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {logOpen ? (
        <CheckInPanel
          habitId={habit.id}
          habitName={habit.name}
          periodLabel={periodLabel}
          current={habit.current}
          onDone={() => setLogOpen(false)}
        />
      ) : null}
    </div>
  );
}
