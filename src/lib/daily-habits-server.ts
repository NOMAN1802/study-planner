import type { CurrentUser } from "@/lib/auth";
import {
  DAILY_SET,
  buildReport,
  dayValue,
  isChecklistHabit,
  presetOf,
  type DayRange,
  type DayValues,
  type Report,
  type ReportHabit,
} from "@/lib/daily-habits";
import { addDays, dayInfo, dayKeyOf } from "@/lib/planner";
import { prisma } from "@/lib/prisma";
import { getStudyCyclesByDay } from "@/lib/workstation/server";

/** How far back history (streaks) is read. */
const HISTORY_DAYS = 3 * 366;

export type DailyHabit = ReportHabit & { archived: boolean };

/** One habit on one day: what is ticked. */
export type DayCell = {
  value: number;
  /** Ticked parts (prayer). */
  parts: number[];
  note: string | null;
};

export function todayKey(user: Pick<CurrentUser, "timezone">, now = new Date()): string {
  return dayKeyOf(now, user.timezone);
}

/** The user's checklist habits (daily single-tick ones), in list order. */
async function loadHabits(user: CurrentUser, includeArchived: boolean): Promise<DailyHabit[]> {
  const rows = await prisma.habit.findMany({
    where: {
      userId: user.id,
      frequency: "DAILY",
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }],
  });
  const habits = rows.filter(isChecklistHabit);
  if (habits.length === 0) return [];
  // A habit counts from its creation, or from its earliest tick when ticked back further.
  const earliest = await prisma.habitLog.groupBy({
    by: ["habitId"],
    where: { habitId: { in: habits.map((h) => h.id) } },
    _min: { periodStart: true },
  });
  const firstLog = new Map(earliest.map((e) => [e.habitId, e._min.periodStart]));
  return habits.map((h) => {
    const created = dayKeyOf(h.createdAt, user.timezone);
    const logged = firstLog.get(h.id);
    const loggedDay = logged ? dayKeyOf(logged, user.timezone) : null;
    return {
      id: h.id,
      name: h.name,
      icon: h.icon,
      color: h.color,
      preset: h.preset,
      parts: h.parts,
      auto: presetOf(h.preset)?.auto,
      firstDay: loggedDay && loggedDay < created ? loggedDay : created,
      archivedDay: h.archivedAt ? dayKeyOf(h.archivedAt, user.timezone) : null,
      archived: h.archivedAt !== null,
    };
  });
}

/** Ticks and study hours for `from`–`to`, as values and per-cell detail. */
async function loadDays(
  user: CurrentUser,
  habits: readonly DailyHabit[],
  from: string,
  to: string,
): Promise<{
  values: DayValues;
  cells: Record<string, Record<string, DayCell>>;
  studyHours: Record<string, number>;
}> {
  const start = new Date(dayInfo(from, user.timezone).start);
  const end = new Date(dayInfo(to, user.timezone).end);
  const auto = habits.some((h) => h.auto === "study");
  const [logs, study] = await Promise.all([
    habits.length
      ? prisma.habitLog.findMany({
          where: {
            habitId: { in: habits.map((h) => h.id) },
            periodStart: { gte: start, lt: end },
          },
          select: { habitId: true, periodStart: true, count: true, parts: true, note: true },
        })
      : [],
    auto ? getStudyCyclesByDay(user, from, to) : null,
  ]);
  const studyHours = study?.byDay ?? {};
  const byHabit = new Map(habits.map((h) => [h.id, h]));
  const values: Record<string, Record<string, number>> = {};
  const cells: Record<string, Record<string, DayCell>> = {};
  const put = (day: string, habit: DailyHabit, cell: DayCell) => {
    (values[day] ??= {})[habit.id] = cell.value;
    (cells[day] ??= {})[habit.id] = cell;
  };
  for (const log of logs) {
    const habit = byHabit.get(log.habitId);
    if (!habit || habit.auto) continue;
    const day = dayKeyOf(log.periodStart, user.timezone);
    put(day, habit, { value: dayValue(habit, log), parts: log.parts, note: log.note });
  }
  for (const habit of habits) {
    if (habit.auto !== "study") continue;
    for (const [day, hours] of Object.entries(studyHours)) {
      put(day, habit, { value: dayValue(habit, undefined, hours), parts: [], note: null });
    }
  }
  return { values, cells, studyHours };
}

export type DailyChecklist = {
  day: string;
  today: string;
  habits: DailyHabit[];
  cells: Record<string, DayCell>;
  studyHours: number;
  note: string;
  /** Whether every habit of the daily set exists already. */
  hasSet: boolean;
};

/** The checklist for one day: active habits, what is ticked, the day's note. */
export async function getDailyChecklist(user: CurrentUser, day: string): Promise<DailyChecklist> {
  const [habits, note, presets] = await Promise.all([
    loadHabits(user, false),
    prisma.habitDayNote.findUnique({ where: { userId_day: { userId: user.id, day } } }),
    prisma.habit.count({ where: { userId: user.id, preset: { not: null } } }),
  ]);
  const { cells, studyHours } = await loadDays(user, habits, day, day);
  return {
    day,
    today: todayKey(user),
    habits,
    cells: cells[day] ?? {},
    studyHours: studyHours[day] ?? 0,
    note: note?.note ?? "",
    hasSet: presets >= DAILY_SET.length,
  };
}

export type HabitReport = {
  range: DayRange;
  today: string;
  habits: DailyHabit[];
  report: Report;
  cells: Record<string, Record<string, DayCell>>;
  studyHours: Record<string, number>;
  notes: Record<string, string>;
};

/** KPIs, per-day cells and notes for a range (archived habits keep their history). */
export async function getHabitReport(user: CurrentUser, range: DayRange): Promise<HabitReport> {
  const today = todayKey(user);
  const habits = (await loadHabits(user, true)).filter((h) => h.firstDay <= range.to);
  const firstDay = habits.reduce<string | null>(
    (min, h) => (min === null || h.firstDay < min ? h.firstDay : min),
    null,
  );
  const floor = addDays(today, -HISTORY_DAYS);
  const historyFrom = firstDay && firstDay > floor ? firstDay : floor;
  const loadFrom = historyFrom < range.from ? historyFrom : range.from;
  const loadTo = range.to > today ? range.to : today;
  const [{ values, cells, studyHours }, notes] = await Promise.all([
    loadDays(user, habits, loadFrom, loadTo),
    prisma.habitDayNote.findMany({
      where: { userId: user.id, day: { gte: range.from, lte: range.to } },
      select: { day: true, note: true },
    }),
  ]);
  return {
    range,
    today,
    habits,
    report: buildReport({ habits, values, from: range.from, to: range.to, today, historyFrom }),
    cells,
    studyHours,
    notes: Object.fromEntries(notes.map((n) => [n.day, n.note])),
  };
}

/** Whether the user already has every habit of the daily set. */
export async function hasDailySet(userId: string): Promise<boolean> {
  const n = await prisma.habit.count({ where: { userId, preset: { not: null } } });
  return n >= DAILY_SET.length;
}

/** Today's score and the last 7 days, for the dashboard (null without daily habits). */
export async function getHabitWeek(user: CurrentUser) {
  const today = todayKey(user);
  const from = addDays(today, -6);
  const data = await getHabitReport(user, {
    kind: "custom",
    date: today,
    from,
    to: today,
    prev: null,
    next: null,
  });
  if (data.habits.every((h) => h.archived)) return null;
  const days = data.report.days;
  const todayScore = days[days.length - 1];
  const full = data.habits.filter(
    (h) => !h.archived && (data.cells[today]?.[h.id]?.value ?? 0) >= 1,
  ).length;
  return {
    today: todayScore,
    done: full,
    total: data.habits.filter((h) => !h.archived).length,
    days,
    average: data.report.averageScore,
  };
}
