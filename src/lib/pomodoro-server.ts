import type { CurrentUser } from "@/lib/auth";
import {
  DEFAULT_SETTINGS,
  MINUTE_MS,
  cycleCountFrom,
  type ActiveSession,
  type PastSession,
  type Phase,
  type PomodoroSettings,
} from "@/lib/pomodoro";
import { prisma } from "@/lib/prisma";

/** Everything the timer UI needs; serialisable (epoch ms, no Dates). */
export type TimerSnapshot = {
  taskId: string;
  settings: PomodoroSettings;
  active: ActiveSession | null;
  last: PastSession | null;
  cycleCount: number;
  /** Server clock at snapshot time, for client clock-offset correction. */
  serverNow: number;
  /** A session running on a different task blocks starting one here. */
  otherActive: { taskId: string; title: string } | null;
};

export type SessionHistoryItem = {
  id: string;
  type: Phase;
  startedAt: string;
  endedAt: string;
  completed: boolean;
  focusMinutes: number;
};

type SessionRow = {
  id: string;
  taskId: string;
  type: string;
  plannedMinutes: number;
  startedAt: Date;
  pausedAt: Date | null;
  pausedMs: number;
  endedAt: Date | null;
  completed: boolean;
};

export function toActive(row: SessionRow): ActiveSession {
  return {
    id: row.id,
    type: row.type as Phase,
    plannedMinutes: row.plannedMinutes,
    startedAt: row.startedAt.getTime(),
    pausedAt: row.pausedAt?.getTime() ?? null,
    pausedMs: row.pausedMs,
  };
}

function toPast(row: SessionRow): PastSession {
  return {
    type: row.type as Phase,
    completed: row.completed,
    startedAt: row.startedAt.getTime(),
    endedAt: (row.endedAt as Date).getTime(),
  };
}

/** Focus minutes a finished session credited (completed = planned; skipped = whole elapsed minutes). */
export function creditedMinutes(row: SessionRow): number {
  if (row.type !== "FOCUS" || !row.endedAt) return 0;
  if (row.completed) return row.plannedMinutes;
  const focused = row.endedAt.getTime() - row.startedAt.getTime() - row.pausedMs;
  return Math.max(0, Math.min(row.plannedMinutes, Math.floor(focused / MINUTE_MS)));
}

export async function getPomodoroSettings(taskId: string): Promise<PomodoroSettings> {
  const config = await prisma.pomodoroConfig.findUnique({ where: { taskId } });
  if (!config) return DEFAULT_SETTINGS;
  return {
    focusMinutes: config.focusMinutes,
    shortBreakMinutes: config.shortBreakMinutes,
    longBreakMinutes: config.longBreakMinutes,
    cyclesBeforeLongBreak: config.cyclesBeforeLongBreak,
    autoStartNext: config.autoStartNext,
  };
}

export async function getTimerSnapshot(
  user: Pick<CurrentUser, "id">,
  taskId: string,
): Promise<TimerSnapshot> {
  const [settings, activeRow, recent] = await Promise.all([
    getPomodoroSettings(taskId),
    prisma.pomodoroSession.findFirst({
      where: { userId: user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
      include: { task: { select: { title: true } } },
    }),
    prisma.pomodoroSession.findMany({
      where: { userId: user.id, taskId, endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
  ]);

  const past = recent.map(toPast);
  const sameTask = activeRow?.taskId === taskId;

  return {
    taskId,
    settings,
    active: activeRow && sameTask ? toActive(activeRow) : null,
    last: past[0] ?? null,
    cycleCount: cycleCountFrom(past),
    serverNow: Date.now(),
    otherActive:
      activeRow && !sameTask ? { taskId: activeRow.taskId, title: activeRow.task.title } : null,
  };
}

export async function getSessionHistory(
  userId: string,
  taskId: string,
  limit = 12,
): Promise<SessionHistoryItem[]> {
  const rows = await prisma.pomodoroSession.findMany({
    where: { userId, taskId, endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type as Phase,
    startedAt: r.startedAt.toISOString(),
    endedAt: (r.endedAt as Date).toISOString(),
    completed: r.completed,
    focusMinutes: creditedMinutes(r),
  }));
}
