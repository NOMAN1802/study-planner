/**
 * The daily habit set, ticked by hand once a day, and its reports: day
 * scores, ranges (day / week / month / year / custom) and KPIs. Pure: no
 * database, no clock; every date is a local calendar day key `YYYY-MM-DD`.
 */
import type { WeekStart } from "@/lib/dates";
import type { HabitIconName } from "@/lib/habit-options";
import { addDays, isDayKey, startOfWeekKey, weekdayOf } from "@/lib/planner";

/** Study hours (Study Station cycles) a day for the study habit to count as done. */
export const STUDY_TARGET_HOURS = 7;

export const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

export type DailyPreset = {
  preset: string;
  name: string;
  icon: HabitIconName;
  color: string;
  /** Named sub-checks (prayer). */
  parts?: readonly string[];
  /** Done from the Study Station's hours, never ticked by hand. */
  auto?: "study";
};

/** The built-in daily set, in display order. */
export const DAILY_SET: readonly DailyPreset[] = [
  { preset: "prayer", name: "Prayer", icon: "sun", color: "#0f766e", parts: PRAYERS },
  { preset: "exercise", name: "Exercise 5 min", icon: "dumbbell", color: "#c2410c" },
  { preset: "bath", name: "Bath before Fajr", icon: "droplet", color: "#475569" },
  { preset: "no-sugar", name: "No sugar", icon: "apple", color: "#b42318" },
  { preset: "screen", name: "Screen time under 2 hours", icon: "smartphone", color: "#57534e" },
  { preset: "no-junk", name: "No junk food", icon: "leaf", color: "#3f7d3a" },
  { preset: "learn-tech", name: "Learn a new technology", icon: "code", color: "#9d174d" },
  { preset: "quran", name: "Read Quran 10 min", icon: "book-open", color: "#0f766e" },
  { preset: "sleep", name: "Sleep 11 pm – 5 am", icon: "moon", color: "#475569" },
  {
    preset: "study",
    name: `Study at least ${STUDY_TARGET_HOURS} hours`,
    icon: "brain",
    color: "#a16207",
    auto: "study",
  },
];

export function presetOf(preset: string | null): DailyPreset | undefined {
  return preset ? DAILY_SET.find((p) => p.preset === preset) : undefined;
}

/** Presets not created yet for a user that already has `existing`. */
export function missingPresets(existing: readonly (string | null)[]): DailyPreset[] {
  const have = new Set(existing);
  return DAILY_SET.filter((p) => !have.has(p.preset));
}

/**
 * Whether a habit is ticked once a day (and so belongs on the checklist): a
 * daily habit from the set, one with named parts, or a plain daily habit
 * with no minutes target and a count target of at most 1.
 */
export function isChecklistHabit(h: {
  frequency: string;
  preset: string | null;
  parts: readonly string[];
  targetCount: number | null;
  targetMinutes: number | null;
}): boolean {
  if (h.frequency !== "DAILY") return false;
  if (h.preset || h.parts.length > 0) return true;
  return !h.targetMinutes && (h.targetCount ?? 1) <= 1;
}

// ---------------------------------------------------------------------------
// Day values

export type DayLog = { count: number; parts: readonly number[] };

/** 0–1 value of a habit on one day: parts in fractions, otherwise ticked or not. */
export function dayValue(
  habit: { parts: readonly string[]; auto?: "study" },
  log: DayLog | undefined,
  studyHours = 0,
): number {
  if (habit.auto === "study") return studyHours >= STUDY_TARGET_HOURS ? 1 : 0;
  if (!log) return 0;
  if (habit.parts.length > 0) {
    const ticked = new Set(log.parts.filter((i) => i >= 0 && i < habit.parts.length));
    return ticked.size / habit.parts.length;
  }
  return log.count >= 1 ? 1 : 0;
}

/** Ticks `part` on or off in a sorted, de-duplicated list. */
export function toggledParts(parts: readonly number[], part: number, on: boolean): number[] {
  const set = new Set(parts);
  if (on) set.add(part);
  else set.delete(part);
  return [...set].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Ranges

export type RangeKind = "day" | "week" | "month" | "year" | "custom";
export const RANGE_KINDS: readonly { kind: RangeKind; label: string }[] = [
  { kind: "day", label: "Daily" },
  { kind: "week", label: "Weekly" },
  { kind: "month", label: "Monthly" },
  { kind: "year", label: "Yearly" },
  { kind: "custom", label: "Custom" },
];

/** Longest custom range, in days. */
export const MAX_RANGE_DAYS = 3 * 366;

export type DayRange = {
  kind: RangeKind;
  /** Anchor date the range was built from (any day inside it). */
  date: string;
  from: string;
  to: string;
  /** Anchors of the previous and next range (null for custom). */
  prev: string | null;
  next: string | null;
};

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function monthStart(key: string) {
  return `${key.slice(0, 7)}-01`;
}
function monthEnd(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function shiftMonth(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

/**
 * The range a URL asks for: `?range=week&date=2026-11-22`, or
 * `?range=custom&from=…&to=…`. Invalid values fall back to `fallback` around today.
 */
export function resolveRange(
  params: Params,
  today: string,
  weekStartsOn: WeekStart,
  fallback: RangeKind = "month",
): DayRange {
  const raw = first(params.range);
  const kind: RangeKind = RANGE_KINDS.some((r) => r.kind === raw) ? (raw as RangeKind) : fallback;
  const dateParam = first(params.date);
  const date = isDayKey(dateParam) ? dateParam : today;

  if (kind === "custom") {
    const f = first(params.from);
    const t = first(params.to);
    let from = isDayKey(f) ? f : addDays(today, -29);
    let to = isDayKey(t) ? t : today;
    if (from > to) [from, to] = [to, from];
    if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1));
    return { kind, date: to, from, to, prev: null, next: null };
  }
  if (kind === "day") {
    return { kind, date, from: date, to: date, prev: addDays(date, -1), next: addDays(date, 1) };
  }
  if (kind === "week") {
    const from = startOfWeekKey(date, weekStartsOn);
    return {
      kind,
      date,
      from,
      to: addDays(from, 6),
      prev: addDays(from, -7),
      next: addDays(from, 7),
    };
  }
  if (kind === "month") {
    return {
      kind,
      date,
      from: monthStart(date),
      to: monthEnd(date),
      prev: shiftMonth(date, -1),
      next: shiftMonth(date, 1),
    };
  }
  const y = date.slice(0, 4);
  return {
    kind,
    date,
    from: `${y}-01-01`,
    to: `${y}-12-31`,
    prev: `${Number(y) - 1}-01-01`,
    next: `${Number(y) + 1}-01-01`,
  };
}

const longDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthYear = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** "22 Nov 2026" */
export function formatDay(key: string): string {
  return longDate.format(new Date(`${key}T00:00:00Z`));
}

export function rangeLabel(r: DayRange): string {
  if (r.kind === "day") return formatDay(r.from);
  if (r.kind === "month") return monthYear.format(new Date(`${r.from}T00:00:00Z`));
  if (r.kind === "year") return r.from.slice(0, 4);
  return `${formatDay(r.from)} – ${formatDay(r.to)}`;
}

/** Query string for a range (keeps the kind, anchor and custom dates). */
export function rangeQuery(kind: RangeKind, date: string, from?: string, to?: string): string {
  const q = new URLSearchParams({ range: kind });
  if (kind === "custom") {
    if (from) q.set("from", from);
    if (to) q.set("to", to);
  } else {
    q.set("date", date);
  }
  return q.toString();
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function dayKeys(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------------------------------------------------------------------------
// Report

export type ReportHabit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  preset: string | null;
  parts: readonly string[];
  auto?: "study";
  /** First day the habit counts (created, or its earliest tick if earlier). */
  firstDay: string;
  /** Day it was archived: it no longer counts from this day on. */
  archivedDay: string | null;
};

/** value[day][habitId] = 0–1 (missing = 0). */
export type DayValues = Readonly<Record<string, Readonly<Record<string, number>>>>;

export type DayScore = {
  day: string;
  /** Sum of the day's habit values. */
  done: number;
  /** Habits that count that day. */
  possible: number;
  /** 0–100, or null when nothing counts that day (future, or before any habit). */
  pct: number | null;
  perfect: boolean;
};

export type HabitStats = {
  id: string;
  name: string;
  icon: string;
  color: string;
  preset: string | null;
  /** Days fully done in the range. */
  done: number;
  /** Days the habit counts in the range. */
  possible: number;
  /** Sum of values (parts in fractions) ÷ possible, 0–100 (null with no possible days). */
  pct: number | null;
  currentStreak: number;
  bestStreak: number;
};

export type Report = {
  from: string;
  /** Last counted day: the range end, or today when the range runs past it. */
  through: string;
  days: DayScore[];
  /** Ticks done ÷ ticks possible, 0–100. */
  completionPct: number | null;
  /** Mean of the day scores. */
  averageScore: number | null;
  perfectDays: number;
  countedDays: number;
  /** Perfect-day streaks (all of history up to today). */
  currentStreak: number;
  bestStreak: number;
  habits: HabitStats[];
  best: HabitStats | null;
  weakest: HabitStats | null;
  /** Average day score per weekday, 0 = Sunday. */
  weekdays: { weekday: number; pct: number | null }[];
};

export function counts(h: Pick<ReportHabit, "firstDay" | "archivedDay">, day: string): boolean {
  return day >= h.firstDay && (h.archivedDay === null || day < h.archivedDay);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Score of every day in `days` (days after `today` count nothing). */
export function dayScores(
  habits: readonly ReportHabit[],
  values: DayValues,
  days: readonly string[],
  today: string,
): DayScore[] {
  return days.map((day) => {
    if (day > today) return { day, done: 0, possible: 0, pct: null, perfect: false };
    let done = 0;
    let possible = 0;
    let full = 0;
    for (const h of habits) {
      if (!counts(h, day)) continue;
      possible += 1;
      const v = values[day]?.[h.id] ?? 0;
      done += v;
      if (v >= 1) full += 1;
    }
    return {
      day,
      done: round1(done),
      possible,
      pct: possible ? Math.round((done / possible) * 100) : null,
      perfect: possible > 0 && full === possible,
    };
  });
}

/**
 * Current and best run of consecutive `hit` days among counted days, up to
 * `today`. Today not done yet doesn't break the current run.
 */
export function streaks(
  days: readonly string[],
  hit: (day: string) => boolean | null,
  today: string,
): { current: number; best: number } {
  let best = 0;
  let run = 0;
  for (const day of days) {
    if (day > today) break;
    const h = hit(day);
    if (h === null) continue; // day doesn't count: neither breaks nor extends
    run = h ? run + 1 : 0;
    best = Math.max(best, run);
  }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const day = days[i];
    if (day > today) continue;
    const h = hit(day);
    if (h === null) continue;
    if (h) current += 1;
    else if (day === today) continue;
    else break;
  }
  return { current, best };
}

/**
 * KPIs for `from`–`to`. `historyFrom` is where streaks start looking (the
 * first day any habit counts); `values` must cover `historyFrom`–`today`.
 */
export function buildReport(input: {
  habits: readonly ReportHabit[];
  values: DayValues;
  from: string;
  to: string;
  today: string;
  historyFrom: string;
}): Report {
  const { habits, values, from, to, today } = input;
  const through = to < today ? to : today;
  const days = dayScores(habits, values, dayKeys(from, to), today);
  const counted = days.filter((d) => d.pct !== null);
  const done = counted.reduce((n, d) => n + d.done, 0);
  const possible = counted.reduce((n, d) => n + d.possible, 0);

  const historyStart = input.historyFrom < from ? input.historyFrom : from;
  const history = historyStart <= today ? dayKeys(historyStart, today) : [];
  const historyScores = new Map(dayScores(habits, values, history, today).map((d) => [d.day, d]));
  const overall = streaks(
    history,
    (day) => {
      const s = historyScores.get(day);
      return s && s.pct !== null ? s.perfect : null;
    },
    today,
  );

  const habitStats: HabitStats[] = habits.map((h) => {
    let full = 0;
    let sum = 0;
    let n = 0;
    for (const d of counted) {
      if (!counts(h, d.day)) continue;
      n += 1;
      const v = values[d.day]?.[h.id] ?? 0;
      sum += v;
      if (v >= 1) full += 1;
    }
    const s = streaks(
      history,
      (day) => (counts(h, day) ? (values[day]?.[h.id] ?? 0) >= 1 : null),
      today,
    );
    return {
      id: h.id,
      name: h.name,
      icon: h.icon,
      color: h.color,
      preset: h.preset,
      done: full,
      possible: n,
      pct: n ? Math.round((sum / n) * 100) : null,
      currentStreak: s.current,
      bestStreak: s.best,
    };
  });

  const ranked = habitStats.filter((h) => h.pct !== null);
  const best = ranked.length
    ? ranked.reduce((a, b) => ((b.pct as number) > (a.pct as number) ? b : a))
    : null;
  const weakest =
    ranked.length > 1
      ? ranked.reduce((a, b) => ((b.pct as number) < (a.pct as number) ? b : a))
      : null;

  const weekdays = Array.from({ length: 7 }, (_, weekday) => {
    const ds = counted.filter((d) => weekdayOf(d.day) === weekday);
    return {
      weekday,
      pct: ds.length ? Math.round(ds.reduce((n, d) => n + (d.pct as number), 0) / ds.length) : null,
    };
  });

  return {
    from,
    through,
    days,
    completionPct: possible ? Math.round((done / possible) * 100) : null,
    averageScore: counted.length
      ? Math.round(counted.reduce((n, d) => n + (d.pct as number), 0) / counted.length)
      : null,
    perfectDays: counted.filter((d) => d.perfect).length,
    countedDays: counted.length,
    currentStreak: overall.current,
    bestStreak: overall.best,
    habits: habitStats,
    best,
    weakest: weakest && best && weakest.id !== best.id ? weakest : null,
    weekdays,
  };
}
