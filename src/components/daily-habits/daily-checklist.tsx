"use client";

import { Check, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { saveDayNote, saveHabitDayNote, setDailyCheck } from "@/actions/daily-habits";
import { HabitIconTile } from "@/components/habits/habit-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STUDY_TARGET_HOURS, dayValue, formatDay, toggledParts } from "@/lib/daily-habits";
import type { DailyChecklist as Data, DailyHabit, DayCell } from "@/lib/daily-habits-server";
import { addDays } from "@/lib/planner";
import { cn } from "@/lib/utils";

type Tick = { habitId: string; done: boolean; part?: number };

const box = "size-5 shrink-0 cursor-pointer rounded-sm accent-(--accent)";
const arrow =
  "inline-flex size-8 items-center justify-center rounded-sm border border-border bg-surface text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg";

function applyTick(cells: Record<string, DayCell>, habits: readonly DailyHabit[], t: Tick) {
  const habit = habits.find((h) => h.id === t.habitId);
  if (!habit) return cells;
  const cur = cells[t.habitId] ?? { value: 0, parts: [], note: null };
  const parts =
    habit.parts.length > 0 && t.part !== undefined ? toggledParts(cur.parts, t.part, t.done) : [];
  const value = dayValue(habit, { count: t.done ? 1 : 0, parts });
  return { ...cells, [t.habitId]: { ...cur, parts, value } };
}

/** One day's habits as checkboxes, with progress, the prayers and the day's note. */
export function DailyChecklist({ data }: { data: Data }) {
  const router = useRouter();
  const [cells, tick] = useOptimistic(data.cells, (state, t: Tick) =>
    applyTick(state, data.habits, t),
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const values = data.habits.map((h) =>
    h.auto ? dayValue(h, undefined, data.studyHours) : (cells[h.id]?.value ?? 0),
  );
  const full = values.filter((v) => v >= 1).length;
  const score = data.habits.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / data.habits.length) * 100)
    : 0;
  const perfect = data.habits.length > 0 && full === data.habits.length;
  const isToday = data.day === data.today;

  function send(t: Tick) {
    setError(null);
    start(async () => {
      tick(t);
      const r = await setDailyCheck({ ...t, day: data.day });
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/habits/daily?date=${addDays(data.day, -1)}`}
          className={arrow}
          aria-label="Previous day"
          title="Previous day"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <h2
          className="min-w-40 text-center font-display text-lg font-medium"
          data-testid="daily-date"
        >
          {isToday ? "Today" : formatDay(data.day)}
        </h2>
        {isToday ? (
          <span className={cn(arrow, "pointer-events-none opacity-40")} aria-hidden>
            <ChevronRight className="size-4" />
          </span>
        ) : (
          <Link
            href={`/habits/daily?date=${addDays(data.day, 1)}`}
            className={arrow}
            aria-label="Next day"
            title="Next day"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
        <input
          type="date"
          value={data.day}
          max={data.today}
          onChange={(e) => {
            if (e.target.value) router.push(`/habits/daily?date=${e.target.value}`);
          }}
          aria-label="Pick a day"
          className="ml-auto h-8 rounded-sm border border-border bg-surface px-2 text-sm text-fg"
        />
        {isToday ? null : (
          <Link href="/habits/daily" className="text-sm font-medium text-accent hover:underline">
            Today
          </Link>
        )}
      </div>

      <section
        aria-label="Progress"
        className="flex flex-col gap-2 rounded-sm border border-border bg-surface p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-fg-muted">
            <span
              className="font-mono text-2xl font-medium text-fg tabular-nums"
              data-testid="daily-done"
            >
              {full} / {data.habits.length}
            </span>{" "}
            done
          </p>
          <p className="text-sm text-fg-muted">
            Score{" "}
            <span className="font-mono font-medium text-fg tabular-nums" data-testid="daily-score">
              {score}%
            </span>
          </p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-label="Day score"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
        >
          <div
            className="bar-fill h-full w-full rounded-full bg-accent"
            style={{ transform: `scaleX(${score / 100})` }}
          />
        </div>
        {perfect ? (
          <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-accent">
            <Check className="size-4" aria-hidden />
            Perfect day
          </p>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <ul
        aria-label="Daily habits"
        className="flex flex-col divide-y divide-border rounded-sm border border-border bg-surface"
      >
        {data.habits.map((h) => {
          const cell = cells[h.id];
          if (h.auto === "study") {
            const done = data.studyHours >= STUDY_TARGET_HOURS;
            return (
              <li
                key={h.id}
                className="flex items-center gap-3 px-3 py-3 sm:px-4"
                data-testid="daily-habit"
              >
                <span
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-sm border",
                    done ? "border-accent bg-accent text-accent-fg" : "border-border-strong",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-3.5" /> : null}
                </span>
                <HabitIconTile name={h.icon} color={h.color} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{h.name}</p>
                  <p className="text-xs text-fg-muted">
                    <span className="font-mono tabular-nums" data-testid="study-hours">
                      {data.studyHours} / {STUDY_TARGET_HOURS} h
                    </span>{" "}
                    from the Study Station{done ? " · done" : ""}
                  </p>
                </div>
                <Link
                  href="/work-station"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                >
                  <GraduationCap className="size-3.5" aria-hidden />
                  Open
                </Link>
              </li>
            );
          }
          if (h.parts.length > 0) {
            const ticked = new Set(cell?.parts ?? []);
            return (
              <li
                key={h.id}
                className="flex flex-col gap-2 px-3 py-3 sm:px-4"
                data-testid="daily-habit"
              >
                <div className="flex items-center gap-3">
                  <HabitIconTile name={h.icon} color={h.color} />
                  <p className="flex-1 text-sm font-medium text-fg">{h.name}</p>
                  <span className="font-mono text-sm text-fg-muted tabular-nums">
                    {ticked.size}/{h.parts.length}
                  </span>
                </div>
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="sr-only">{h.name}</legend>
                  {h.parts.map((part, i) => (
                    <label
                      key={part}
                      className={cn(
                        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border px-3 text-sm transition-colors duration-150",
                        ticked.has(i)
                          ? "border-accent bg-accent/10 font-medium text-fg"
                          : "border-border text-fg-muted hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="checkbox"
                        className={box}
                        checked={ticked.has(i)}
                        onChange={(e) => send({ habitId: h.id, done: e.target.checked, part: i })}
                      />
                      {part}
                    </label>
                  ))}
                </fieldset>
              </li>
            );
          }
          const done = (cell?.value ?? 0) >= 1;
          return (
            <li
              key={h.id}
              className="flex flex-col gap-2 px-3 py-3 sm:px-4"
              data-testid="daily-habit"
            >
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className={box}
                  checked={done}
                  onChange={(e) => send({ habitId: h.id, done: e.target.checked })}
                />
                <HabitIconTile name={h.icon} color={h.color} />
                <span className="flex-1 text-sm font-medium text-fg">{h.name}</span>
              </label>
              {h.preset === "learn-tech" ? (
                <HabitNote habitId={h.id} day={data.day} note={cell?.note ?? ""} />
              ) : null}
            </li>
          );
        })}
      </ul>

      <DayNote key={data.day} day={data.day} note={data.note} />
    </div>
  );
}

/** "What did you learn?" — saved when the field loses focus. */
function HabitNote({ habitId, day, note }: { habitId: string; day: string; note: string }) {
  const [value, setValue] = useState(note);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1 pl-8">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.trim() === note.trim()) return;
          start(async () => {
            const r = await saveHabitDayNote(habitId, day, value);
            setStatus(r.error ?? "Saved");
          });
        }}
        maxLength={280}
        placeholder="What did you learn?"
        aria-label="What did you learn?"
        className="h-8"
      />
      {status && !pending ? (
        <p role="status" className="text-xs text-fg-muted">
          {status}
        </p>
      ) : null}
    </div>
  );
}

/** One line about the day, like the left page of a habit journal. */
function DayNote({ day, note }: { day: string; note: string }) {
  const [value, setValue] = useState(note);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 rounded-sm border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveDayNote(day, value);
          setStatus(r.error ?? "Saved");
        });
      }}
    >
      <label htmlFor="day-note" className="text-sm font-medium text-fg">
        Note for the day
      </label>
      <Input
        id="day-note"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus(null);
        }}
        maxLength={280}
        placeholder="One line: what made today good or hard?"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          Save note
        </Button>
        {status ? (
          <p role="status" className="text-xs text-fg-muted">
            {status}
          </p>
        ) : null}
      </div>
    </form>
  );
}
