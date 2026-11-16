import type { CurrentUser } from "@/lib/auth";
import {
  isActivePeriod,
  periodKey,
  periodStart,
  type Frequency,
  type PeriodContext,
} from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { computeStreaks, isLogComplete, logProgress, type StreakStats } from "@/lib/streaks";

export type HabitView = "active" | "archived";

export type HabitRow = {
  id: string;
  name: string;
  note: string | null;
  color: string;
  icon: string;
  frequency: Frequency;
  targetCount: number | null;
  targetMinutes: number | null;
  activeHours: number[];
  archived: boolean;
  /** Log for the period containing "now". */
  current: { count: number; minutes: number; note: string | null };
  currentPeriodStart: string;
  /** For hourly habits: whether the current hour is one of its active hours. */
  activeNow: boolean;
  progress: number;
  complete: boolean;
  stats: StreakStats;
};

export function periodContext(
  user: Pick<CurrentUser, "timezone" | "weekStartsOn">,
  frequency: Frequency,
): PeriodContext {
  return { frequency, timezone: user.timezone, weekStartsOn: user.weekStartsOn };
}

/** All of a user's habits for one view, with current-period progress and streak stats. */
export async function getHabitRows(
  user: CurrentUser,
  view: HabitView,
  now = new Date(),
): Promise<HabitRow[]> {
  const habits = await prisma.habit.findMany({
    where: { userId: user.id, archivedAt: view === "active" ? null : { not: null } },
    orderBy:
      view === "active" ? [{ sortOrder: "asc" }, { createdAt: "asc" }] : [{ archivedAt: "desc" }],
    include: {
      logs: {
        select: { periodStart: true, count: true, minutes: true, note: true },
        orderBy: { periodStart: "asc" },
      },
    },
  });

  return habits.map((habit) => {
    const frequency = habit.frequency as Frequency;
    const ctx = periodContext(user, frequency);
    const currentStart = periodStart(now, ctx);
    const currentKey = periodKey(currentStart);
    const currentLog = habit.logs.find(
      (l) => periodKey(periodStart(l.periodStart, ctx)) === currentKey,
    );
    const target = { targetCount: habit.targetCount, targetMinutes: habit.targetMinutes };
    const current = {
      count: currentLog?.count ?? 0,
      minutes: currentLog?.minutes ?? 0,
      note: currentLog?.note ?? null,
    };

    return {
      id: habit.id,
      name: habit.name,
      note: habit.note,
      color: habit.color,
      icon: habit.icon,
      frequency,
      targetCount: habit.targetCount,
      targetMinutes: habit.targetMinutes,
      activeHours: habit.activeHours,
      archived: habit.archivedAt !== null,
      current,
      currentPeriodStart: currentStart.toISOString(),
      activeNow: isActivePeriod(currentStart, ctx, habit.activeHours),
      progress: logProgress(current, target),
      complete: isLogComplete(current, target),
      stats: computeStreaks({
        ...target,
        ctx,
        activeHours: habit.activeHours,
        createdAt: habit.createdAt,
        logs: habit.logs,
        now,
      }),
    };
  });
}

export async function getHabitForUser(userId: string, habitId: string) {
  return prisma.habit.findFirst({ where: { id: habitId, userId } });
}
