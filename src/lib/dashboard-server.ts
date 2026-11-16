import type { CurrentUser } from "@/lib/auth";
import {
  FOCUS_RANGES,
  buildHeatmap,
  dailyHabitRing,
  focusSeries,
  habitsDueNow,
  heatmapStart,
  ringStat,
  streakRows,
  taskTimeRows,
  type FocusRange,
  type FocusSeries,
  type Heatmap,
  type RingStat,
  type TaskTimeRow,
  type TodayHabit,
  type TodayTask,
} from "@/lib/dashboard";
import { formatDue, nextPeriodStart, periodStart, type Frequency } from "@/lib/dates";
import { getHabitRows, periodContext, type HabitRow } from "@/lib/habits";
import { creditedMinutes } from "@/lib/pomodoro-server";
import { prisma } from "@/lib/prisma";

export type StreakRow = {
  id: string;
  name: string;
  color: string;
  icon: string;
  frequency: Frequency;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
};

export type DashboardData = {
  /** No active habits and no tasks at all. */
  empty: boolean;
  /** Habits that can be checked in right now. */
  habits: TodayHabit[];
  /** Daily habits, for the per-habit rings. */
  dailyHabits: TodayHabit[];
  dailyRing: RingStat;
  /** Tasks due today plus open overdue tasks. */
  tasks: TodayTask[];
  /** Tasks due today that are done. */
  taskRing: RingStat;
  streaks: StreakRow[];
  heatmap: Heatmap;
  focus: Record<FocusRange, FocusSeries>;
  taskTime: TaskTimeRow[];
};

function toTodayHabit(h: HabitRow): TodayHabit {
  return {
    id: h.id,
    name: h.name,
    color: h.color,
    icon: h.icon,
    frequency: h.frequency,
    targetCount: h.targetCount,
    targetMinutes: h.targetMinutes,
    current: { count: h.current.count, minutes: h.current.minutes },
    complete: h.complete,
    progress: h.progress,
  };
}

export async function getDashboardData(
  user: CurrentUser,
  now = new Date(),
): Promise<DashboardData> {
  const zone = { timezone: user.timezone, weekStartsOn: user.weekStartsOn };
  const daily = periodContext(user, "DAILY");
  const dayStart = periodStart(now, daily);
  const dayEnd = nextPeriodStart(dayStart, daily);
  const weekStart = periodStart(now, periodContext(user, "WEEKLY"));
  const monthStart = periodStart(now, periodContext(user, "MONTHLY"));
  const focusSince = weekStart < monthStart ? weekStart : monthStart;

  const [habitRows, taskCount, dueTasks, timedTasks, heatmapLogs, sessions] = await Promise.all([
    getHabitRows(user, "active", now),
    prisma.task.count({ where: { userId: user.id } }),
    prisma.task.findMany({
      where: {
        userId: user.id,
        OR: [
          { dueAt: { gte: dayStart, lt: dayEnd } },
          { dueAt: { lt: dayStart }, status: { in: ["TODO", "IN_PROGRESS"] } },
        ],
      },
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
      take: 50,
    }),
    prisma.task.findMany({
      where: { userId: user.id, targetMinutes: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, status: true, targetMinutes: true, actualMinutes: true },
    }),
    // Archived habits keep their history in the heatmap.
    prisma.habitLog.findMany({
      where: {
        userId: user.id,
        periodStart: { gte: heatmapStart(now, zone) },
        habit: { frequency: { in: ["DAILY", "HOURLY"] } },
      },
      select: {
        habitId: true,
        periodStart: true,
        count: true,
        minutes: true,
        habit: { select: { frequency: true, targetCount: true, targetMinutes: true } },
      },
    }),
    prisma.pomodoroSession.findMany({
      where: { userId: user.id, type: "FOCUS", endedAt: { gte: focusSince } },
    }),
  ]);

  const focusEntries = sessions
    .filter((s) => s.endedAt !== null)
    .map((s) => ({ at: s.endedAt as Date, minutes: creditedMinutes(s) }))
    .filter((e) => e.minutes > 0);

  const dueToday = dueTasks.filter((t) => t.dueAt !== null && t.dueAt >= dayStart);

  return {
    empty: habitRows.length === 0 && taskCount === 0,
    habits: habitsDueNow(habitRows).map(toTodayHabit),
    dailyHabits: habitRows.filter((h) => h.frequency === "DAILY").map(toTodayHabit),
    dailyRing: dailyHabitRing(habitRows),
    tasks: dueTasks.map((t) => ({
      id: t.id,
      title: t.title,
      done: t.status === "DONE",
      priority: t.priority,
      dueLabel: t.dueAt ? formatDue(t.dueAt, user.timezone, now) : null,
      overdue: Boolean(t.dueAt && t.dueAt < now && t.status !== "DONE"),
    })),
    taskRing: ringStat(dueToday.filter((t) => t.status === "DONE").length, dueToday.length),
    streaks: streakRows(habitRows).map((h) => ({
      id: h.id,
      name: h.name,
      color: h.color,
      icon: h.icon,
      frequency: h.frequency,
      currentStreak: h.stats.currentStreak,
      bestStreak: h.stats.bestStreak,
      completionRate: h.stats.completionRate,
    })),
    heatmap: buildHeatmap(
      heatmapLogs.map((l) => ({
        habitId: l.habitId,
        periodStart: l.periodStart,
        count: l.count,
        minutes: l.minutes,
        frequency: l.habit.frequency as Frequency,
        targetCount: l.habit.targetCount,
        targetMinutes: l.habit.targetMinutes,
      })),
      now,
      zone,
    ),
    focus: Object.fromEntries(
      FOCUS_RANGES.map((range) => [range, focusSeries(focusEntries, range, now, zone)]),
    ) as Record<FocusRange, FocusSeries>,
    taskTime: taskTimeRows(timedTasks),
  };
}
