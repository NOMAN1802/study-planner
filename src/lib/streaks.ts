import {
  isActivePeriod,
  listPeriodStarts,
  periodKey,
  periodStart,
  type PeriodContext,
} from "@/lib/dates";

export type HabitTarget = {
  targetCount: number | null;
  targetMinutes: number | null;
};

export type LogEntry = {
  periodStart: Date;
  count: number;
  minutes: number;
};

export type StreakInput = HabitTarget & {
  ctx: PeriodContext;
  activeHours: readonly number[];
  /** When the habit was created; periods before this are not counted. */
  createdAt: Date;
  logs: readonly LogEntry[];
  now: Date;
};

export type StreakStats = {
  currentStreak: number;
  bestStreak: number;
  /** 0–1. Completed periods / elapsed active periods. */
  completionRate: number;
  completedPeriods: number;
  elapsedPeriods: number;
  /** Whether the period containing `now` is already complete. */
  currentPeriodComplete: boolean;
};

/**
 * A period is complete when every target that is set is met.
 * With no targets at all, a single check-in completes it.
 */
export function isLogComplete(
  log: Pick<LogEntry, "count" | "minutes"> | undefined,
  target: HabitTarget,
): boolean {
  if (!log) return false;
  const hasCount = target.targetCount != null && target.targetCount > 0;
  const hasMinutes = target.targetMinutes != null && target.targetMinutes > 0;
  if (!hasCount && !hasMinutes) return log.count >= 1;
  if (hasCount && log.count < (target.targetCount as number)) return false;
  if (hasMinutes && log.minutes < (target.targetMinutes as number)) return false;
  return true;
}

/** 0–1 progress towards the period's targets (the least-complete target wins). */
export function logProgress(
  log: Pick<LogEntry, "count" | "minutes"> | undefined,
  target: HabitTarget,
): number {
  const count = log?.count ?? 0;
  const minutes = log?.minutes ?? 0;
  const parts: number[] = [];
  if (target.targetCount) parts.push(count / target.targetCount);
  if (target.targetMinutes) parts.push(minutes / target.targetMinutes);
  if (parts.length === 0) parts.push(count >= 1 ? 1 : 0);
  return Math.max(0, Math.min(1, Math.min(...parts)));
}

/**
 * Streaks and completion rate for one habit.
 *
 * - Periods are evaluated in the user's timezone (see `lib/dates`).
 * - The current period never breaks a streak: if it is not complete yet, the
 *   streak is counted from the previous period backwards.
 * - Inactive hourly periods are skipped (neither counted nor breaking).
 * - Counting starts at the earlier of habit creation and the first log.
 */
export function computeStreaks(input: StreakInput): StreakStats {
  const { ctx, activeHours, logs, now } = input;

  const byPeriod = new Map<string, LogEntry>();
  let earliest = input.createdAt;
  for (const log of logs) {
    // Normalise in case a log was stored with a non-canonical start.
    const start = periodStart(log.periodStart, ctx);
    if (start.getTime() > now.getTime()) continue;
    const key = periodKey(start);
    const prev = byPeriod.get(key);
    byPeriod.set(
      key,
      prev
        ? { periodStart: start, count: prev.count + log.count, minutes: prev.minutes + log.minutes }
        : { periodStart: start, count: log.count, minutes: log.minutes },
    );
    if (start.getTime() < earliest.getTime()) earliest = start;
  }

  const periods = listPeriodStarts(earliest, now, ctx).filter((p) =>
    isActivePeriod(p, ctx, activeHours),
  );
  const complete = periods.map((p) => isLogComplete(byPeriod.get(periodKey(p)), input));

  const currentStart = periodStart(now, ctx).getTime();
  const lastIndex = periods.length - 1;
  const lastIsCurrent = lastIndex >= 0 && periods[lastIndex].getTime() === currentStart;
  const currentPeriodComplete = lastIsCurrent && complete[lastIndex];

  // Best streak: longest run of complete periods.
  let bestStreak = 0;
  let run = 0;
  for (const done of complete) {
    run = done ? run + 1 : 0;
    if (run > bestStreak) bestStreak = run;
  }

  // Current streak: walk back from the latest period, skipping an
  // in-progress current period.
  let currentStreak = 0;
  let i = lastIndex;
  if (lastIsCurrent && !currentPeriodComplete) i -= 1;
  for (; i >= 0 && complete[i]; i -= 1) currentStreak += 1;

  // Completion rate: exclude the current period unless it is already done.
  const elapsedPeriods = periods.length - (lastIsCurrent && !currentPeriodComplete ? 1 : 0);
  const completedPeriods = complete.filter(Boolean).length;
  const completionRate = elapsedPeriods > 0 ? completedPeriods / elapsedPeriods : 0;

  return {
    currentStreak,
    bestStreak,
    completionRate,
    completedPeriods,
    elapsedPeriods,
    currentPeriodComplete,
  };
}
