"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setDailyCheck } from "@/actions/daily-habits";
import { HabitIcon } from "@/components/habits/habit-icon";
import { counts, dayKeys, dayScores, type DayValues } from "@/lib/daily-habits";
import type { DailyHabit, DayCell } from "@/lib/daily-habits-server";
import { weekdayOf } from "@/lib/planner";
import { cn } from "@/lib/utils";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDay(day: string) {
  return `${WEEKDAY[weekdayOf(day)]} ${Number(day.slice(8))} ${MONTH[Number(day.slice(5, 7)) - 1]}`;
}

type Cells = Record<string, Record<string, DayCell>>;
type Toggle = { day: string; habitId: string; done: boolean };

/**
 * The habit journal page: one row per date, one column per habit, ✗ when
 * done (tap to toggle), prayers as n/5 and study hours read-only, and the
 * day's score at the end of the row.
 */
export function TrackerGrid({
  habits,
  from,
  to,
  today,
  cells: initial,
}: {
  habits: DailyHabit[];
  from: string;
  to: string;
  today: string;
  cells: Cells;
}) {
  const [cells, toggle] = useOptimistic(initial, (state: Cells, t: Toggle) => ({
    ...state,
    [t.day]: {
      ...state[t.day],
      [t.habitId]: {
        value: t.done ? 1 : 0,
        parts: [],
        note: state[t.day]?.[t.habitId]?.note ?? null,
      },
    },
  }));
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const days = dayKeys(from, to);
  const values: DayValues = Object.fromEntries(
    Object.entries(cells).map(([day, byHabit]) => [
      day,
      Object.fromEntries(Object.entries(byHabit).map(([id, c]) => [id, c.value])),
    ]),
  );
  const scores = new Map(dayScores(habits, values, days, today).map((s) => [s.day, s]));

  function send(t: Toggle) {
    setError(null);
    start(async () => {
      toggle(t);
      const r = await setDailyCheck(t);
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div
        className="relative overflow-x-auto rounded-sm border border-border bg-surface"
        role="region"
        aria-label="Habit tracker grid"
        tabIndex={0}
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Habits by date: a cross marks a habit done; the last column is the day&apos;s score.
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-xs font-medium text-fg-muted"
              >
                Date
              </th>
              {habits.map((h) => (
                <th key={h.id} scope="col" className="px-1 py-2" title={h.name}>
                  <span className="flex justify-center" style={{ color: h.color }}>
                    <HabitIcon name={h.icon} />
                  </span>
                  <span className="sr-only">{h.name}</span>
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-fg-muted">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const future = day > today;
              const score = scores.get(day);
              return (
                <tr
                  key={day}
                  className={cn(
                    "border-b border-border bg-surface last:border-b-0",
                    day === today && "bg-surface-2",
                  )}
                  data-testid="tracker-row"
                  data-day={day}
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-inherit px-3 py-1.5 text-left font-normal whitespace-nowrap"
                  >
                    {future ? (
                      <span className="text-fg-subtle">{shortDay(day)}</span>
                    ) : (
                      <Link
                        href={`/habits/daily?date=${day}`}
                        className="text-fg hover:text-accent hover:underline"
                      >
                        {shortDay(day)}
                      </Link>
                    )}
                  </th>
                  {habits.map((h) => {
                    const cell = cells[day]?.[h.id];
                    const label = `${h.name}, ${shortDay(day)}`;
                    if (future || !counts(h, day)) {
                      return (
                        <td key={h.id} className="px-1 py-1.5 text-center text-fg-subtle">
                          <span aria-hidden>·</span>
                          <span className="sr-only">{label}: not counted</span>
                        </td>
                      );
                    }
                    if (h.auto || h.parts.length > 0) {
                      const done = (cell?.value ?? 0) >= 1;
                      const amount = h.parts.length
                        ? `${cell?.parts.length ?? 0} of ${h.parts.length}`
                        : done
                          ? "done"
                          : "not done";
                      return (
                        <td key={h.id} className="px-1 py-1.5 text-center">
                          <Link
                            href={h.auto ? "/work-station" : `/habits/daily?date=${day}`}
                            className={cn(
                              "inline-flex h-7 min-w-7 items-center justify-center rounded-sm px-1 font-mono text-xs tabular-nums",
                              done ? "text-fg" : "text-fg-muted",
                            )}
                            aria-label={`${label}: ${amount}`}
                          >
                            {done ? (
                              <X className="size-4" aria-hidden />
                            ) : h.parts.length ? (
                              `${cell?.parts.length ?? 0}/${h.parts.length}`
                            ) : (
                              "–"
                            )}
                          </Link>
                        </td>
                      );
                    }
                    const done = (cell?.value ?? 0) >= 1;
                    return (
                      <td key={h.id} className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          aria-pressed={done}
                          aria-label={label}
                          onClick={() => send({ day, habitId: h.id, done: !done })}
                          className={cn(
                            "inline-flex size-7 items-center justify-center rounded-sm border transition-colors duration-150",
                            done
                              ? "border-transparent text-fg"
                              : "border-border text-transparent hover:bg-surface-3",
                          )}
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-right">
                    {!score || score.pct === null ? (
                      <span className="text-fg-subtle">–</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-surface-3 sm:inline-block"
                          aria-hidden
                        >
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${score.pct}%` }}
                          />
                        </span>
                        <span
                          className="w-10 font-mono text-xs tabular-nums"
                          data-testid="tracker-score"
                        >
                          {score.pct}%
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
