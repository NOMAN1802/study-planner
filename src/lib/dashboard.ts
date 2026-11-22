import { TZDate } from "@date-fns/tz";
import {
  listPeriodStarts,
  nextPeriodStart,
  periodKey,
  periodStart,
  previousPeriodStart,
  type Frequency,
  type PeriodContext,
  type WeekStart,
} from "@/lib/dates";
import { isLogComplete } from "@/lib/streaks";

// Pure dashboard aggregation (no database access) so every number can be unit-tested.

export type Zone = { timezone: string; weekStartsOn: WeekStart };

function ctxFor(zone: Zone, frequency: Frequency): PeriodContext {
  return { frequency, timezone: zone.timezone, weekStartsOn: zone.weekStartsOn };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of the local calendar day containing `instant`. */
export function dayKey(instant: Date, timezone: string): string {
  const d = new TZDate(instant.getTime(), timezone);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ---------- Today ----------

export type TodayHabit = {
  id: string;
  name: string;
  color: string;
  icon: string;
  frequency: Frequency;
  targetCount: number | null;
  targetMinutes: number | null;
  current: { count: number; minutes: number };
  complete: boolean;
  progress: number;
  /** Ticked on the Daily checklist only (prayers, or automatic like study). */
  dailyOnly: boolean;
};

export type TodayTask = {
  id: string;
  title: string;
  done: boolean;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueLabel: string | null;
  overdue: boolean;
};

/** Habits that can be checked in right now (hourly habits only during active hours). */
export function habitsDueNow<T extends { frequency: Frequency; activeNow: boolean }>(
  habits: readonly T[],
): T[] {
  return habits.filter((h) => h.frequency !== "HOURLY" || h.activeNow);
}

// ---------- Rings ----------

export type RingStat = { done: number; total: number; ratio: number };

export function ringStat(done: number, total: number): RingStat {
  return { done, total, ratio: total > 0 ? Math.min(1, done / total) : 0 };
}

/** Daily habits completed today out of all daily habits. */
export function dailyHabitRing(
  habits: readonly { frequency: Frequency; complete: boolean }[],
): RingStat {
  const daily = habits.filter((h) => h.frequency === "DAILY");
  return ringStat(daily.filter((h) => h.complete).length, daily.length);
}

// ---------- Streaks ----------

export function streakRows<
  T extends { name: string; stats: { currentStreak: number; bestStreak: number } },
>(habits: readonly T[]): T[] {
  return [...habits].sort(
    (a, b) =>
      b.stats.currentStreak - a.stats.currentStreak ||
      b.stats.bestStreak - a.stats.bestStreak ||
      a.name.localeCompare(b.name),
  );
}

// ---------- Focus minutes ----------

export type FocusRange = "day" | "week" | "month";
export const FOCUS_RANGES: readonly FocusRange[] = ["day", "week", "month"];

/** Focus minutes credited at an instant (the moment the session ended). */
export type FocusEntry = { at: Date; minutes: number };
export type FocusBucket = { key: string; label: string; minutes: number };
export type FocusSeries = { range: FocusRange; buckets: FocusBucket[]; total: number };

const RANGE_PERIOD = { day: "DAILY", week: "WEEKLY", month: "MONTHLY" } as const;

/**
 * Focus minutes for the current day (by hour), week (by day) or month (by day),
 * with boundaries in the user's timezone.
 */
export function focusSeries(
  entries: readonly FocusEntry[],
  range: FocusRange,
  now: Date,
  zone: Zone,
): FocusSeries {
  const outer = ctxFor(zone, RANGE_PERIOD[range]);
  const inner = ctxFor(zone, range === "day" ? "HOURLY" : "DAILY");
  const start = periodStart(now, outer);
  const end = nextPeriodStart(start, outer);
  const starts = listPeriodStarts(start, new Date(end.getTime() - 1), inner);

  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone.timezone,
    ...(range === "day"
      ? { hour: "2-digit", hourCycle: "h23" }
      : range === "week"
        ? { weekday: "short" }
        : { day: "numeric" }),
  });

  const minutes = new Map<string, number>(starts.map((s) => [periodKey(s), 0]));
  for (const entry of entries) {
    const t = entry.at.getTime();
    if (t < start.getTime() || t >= end.getTime()) continue;
    const key = periodKey(periodStart(entry.at, inner));
    minutes.set(key, (minutes.get(key) ?? 0) + entry.minutes);
  }

  const buckets = starts.map((s) => {
    const key = periodKey(s);
    return { key, label: label.format(s), minutes: minutes.get(key) ?? 0 };
  });
  return { range, buckets, total: buckets.reduce((sum, b) => sum + b.minutes, 0) };
}

// ---------- Year heatmap ----------

export const HEATMAP_WEEKS = 53;

export type HeatmapLog = {
  habitId: string;
  frequency: Frequency;
  periodStart: Date;
  count: number;
  minutes: number;
  targetCount: number | null;
  targetMinutes: number | null;
};

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;
export type HeatmapCell = { date: string; count: number; level: HeatmapLevel };

export type Heatmap = {
  /** Columns, oldest first; each has 7 cells from the user's week start. null = future day. */
  weeks: (HeatmapCell | null)[][];
  /** Column index at which each month label belongs. */
  months: { week: number; label: string }[];
  /** Habit completions in the window. */
  total: number;
  activeDays: number;
  max: number;
};

/** First instant covered by the heatmap: the start of the week `weeks - 1` weeks ago. */
export function heatmapStart(now: Date, zone: Zone, weeks = HEATMAP_WEEKS): Date {
  const weekly = ctxFor(zone, "WEEKLY");
  let start = periodStart(now, weekly);
  for (let i = 1; i < weeks; i += 1) start = previousPeriodStart(start, weekly);
  return start;
}

/**
 * Per local day: how many distinct daily/hourly habits had a completed period
 * starting that day. Weekly and monthly habits are left out because their
 * completion cannot be pinned to a single day.
 */
export function buildHeatmap(
  logs: readonly HeatmapLog[],
  now: Date,
  zone: Zone,
  weeks = HEATMAP_WEEKS,
): Heatmap {
  const byDay = new Map<string, Set<string>>();
  for (const log of logs) {
    if (log.frequency !== "DAILY" && log.frequency !== "HOURLY") continue;
    if (!isLogComplete(log, log)) continue;
    const key = dayKey(log.periodStart, zone.timezone);
    const set = byDay.get(key) ?? new Set<string>();
    set.add(log.habitId);
    byDay.set(key, set);
  }

  const days = listPeriodStarts(heatmapStart(now, zone, weeks), now, ctxFor(zone, "DAILY"));
  const counts = days.map((d) => byDay.get(dayKey(d, zone.timezone))?.size ?? 0);
  const max = Math.max(0, ...counts);

  const month = new Intl.DateTimeFormat("en-GB", { timeZone: zone.timezone, month: "short" });
  const columns: (HeatmapCell | null)[][] = [];
  const months: Heatmap["months"] = [];
  let lastMonth = "";
  for (let i = 0; i < days.length; i += 7) {
    const column: (HeatmapCell | null)[] = [];
    for (let j = i; j < i + 7; j += 1) {
      if (j >= days.length) {
        column.push(null);
        continue;
      }
      const count = counts[j];
      const level = (count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4))) as HeatmapLevel;
      column.push({ date: dayKey(days[j], zone.timezone), count, level });
    }
    const label = month.format(days[i]);
    if (label !== lastMonth) {
      months.push({ week: columns.length, label });
      lastMonth = label;
    }
    columns.push(column);
  }

  return {
    weeks: columns,
    months,
    total: counts.reduce((sum, c) => sum + c, 0),
    activeDays: counts.filter((c) => c > 0).length,
    max,
  };
}

// ---------- Target vs. actual ----------

export type TaskTimeInput = {
  id: string;
  title: string;
  status: string;
  targetMinutes: number | null;
  actualMinutes: number;
};

export type TaskTimeRow = {
  id: string;
  title: string;
  done: boolean;
  target: number;
  actual: number;
  /** actual / target, not capped. */
  ratio: number;
  over: boolean;
};

/** Tasks that have a time target: open ones first, then by time spent. */
export function taskTimeRows(tasks: readonly TaskTimeInput[], limit = 8): TaskTimeRow[] {
  return tasks
    .filter((t) => t.targetMinutes != null && t.targetMinutes > 0)
    .map((t) => {
      const target = t.targetMinutes as number;
      return {
        id: t.id,
        title: t.title,
        done: t.status === "DONE",
        target,
        actual: t.actualMinutes,
        ratio: t.actualMinutes / target,
        over: t.actualMinutes > target,
      };
    })
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) || b.actual - a.actual || a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}
