"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { periodStart, type Frequency } from "@/lib/dates";
import { periodContext } from "@/lib/habits";
import {
  InvalidTransitionError,
  endsAt,
  focusCreditMinutes,
  stateFromPersisted,
  transition,
  type ActiveSession,
  type TimerEvent,
  type TimerState,
} from "@/lib/pomodoro";
import { getTimerSnapshot, type TimerSnapshot } from "@/lib/pomodoro-server";
import { prisma } from "@/lib/prisma";
import {
  pomodoroConfigErrors,
  pomodoroConfigSchema,
  pomodoroConfigValues,
  type PomodoroConfigState,
} from "@/schemas/pomodoro";

const idSchema = z.uuid();
/** Client and server clocks can differ slightly; accept a completion this early. */
const COMPLETE_TOLERANCE_MS = 1500;

export type TimerCommand = "START" | "PAUSE" | "RESUME" | "SKIP" | "COMPLETE";
export type TimerResult = { snapshot?: TimerSnapshot; error?: string };

async function ownedTask(userId: string, taskId: string) {
  if (!idSchema.safeParse(taskId).success) return null;
  return prisma.task.findFirst({
    where: { id: taskId, userId },
    include: { habit: { select: { id: true, frequency: true, archivedAt: true } } },
  });
}

function revalidateTimer(taskId: string) {
  revalidatePath(`/tasks/${taskId}/focus`);
  revalidatePath("/tasks");
  revalidatePath("/habits");
  revalidatePath("/dashboard");
  revalidatePath("/work-station");
}

/** A Work-Station topic is only accepted on its own subject's task. */
async function ownedTopicId(userId: string, taskId: string, topicId: string | null | undefined) {
  if (!topicId || !idSchema.safeParse(topicId).success) return null;
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, subject: { taskId, plan: { userId } } },
    select: { id: true },
  });
  return topic?.id ?? null;
}

export async function savePomodoroConfig(
  taskId: string,
  _prev: PomodoroConfigState,
  formData: FormData,
): Promise<PomodoroConfigState> {
  const user = await requireUser();
  const task = await ownedTask(user.id, taskId);
  if (!task) return { error: "Task not found." };

  const parsed = pomodoroConfigSchema.safeParse(pomodoroConfigValues(formData));
  if (!parsed.success) return { fieldErrors: pomodoroConfigErrors(parsed.error) };

  await prisma.pomodoroConfig.upsert({
    where: { taskId: task.id },
    create: { ...parsed.data, taskId: task.id, userId: user.id },
    update: parsed.data,
  });
  revalidatePath(`/tasks/${task.id}/focus`);
  return { ok: true };
}

type OwnedTask = NonNullable<Awaited<ReturnType<typeof ownedTask>>>;

/**
 * Adds focus minutes to the task and, if linked to an active habit, to the
 * habit's log for the period containing `at` (in the user's timezone).
 */
async function creditFocus(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  user: CurrentUser,
  task: OwnedTask,
  minutes: number,
  at: Date,
) {
  if (minutes <= 0) return;
  await tx.task.update({ where: { id: task.id }, data: { actualMinutes: { increment: minutes } } });
  const habit = task.habit;
  if (habit && !habit.archivedAt) {
    const start = periodStart(at, periodContext(user, habit.frequency as Frequency));
    await tx.habitLog.upsert({
      where: { habitId_periodStart: { habitId: habit.id, periodStart: start } },
      create: { habitId: habit.id, userId: user.id, periodStart: start, minutes },
      update: { minutes: { increment: minutes } },
    });
  }
}

/**
 * Applies one timer command. The pure state machine decides what is allowed;
 * this function persists the difference and credits focus time.
 */
export async function runTimer(
  taskId: string,
  command: TimerCommand,
  topicId?: string | null,
): Promise<TimerResult> {
  const user = await requireUser();
  const task = await ownedTask(user.id, taskId);
  if (!task) return { error: "Task not found." };

  const snapshot = await getTimerSnapshot(user, task.id);
  if (command === "START" && snapshot.otherActive) {
    return { snapshot, error: `A timer is already running on “${snapshot.otherActive.title}”.` };
  }

  const now = Date.now();
  const state = stateFromPersisted({ ...snapshot, now });
  const event: TimerEvent =
    command === "START"
      ? { type: "START", id: randomUUID(), now }
      : command === "COMPLETE"
        ? { type: "TICK", now: now + COMPLETE_TOLERANCE_MS, nextId: randomUUID() }
        : { type: command, now };

  let next: TimerState;
  try {
    next = transition(state, event, snapshot.settings);
  } catch (e) {
    if (e instanceof InvalidTransitionError)
      return { snapshot, error: "The timer changed. Showing the latest state." };
    throw e;
  }

  const current: ActiveSession | null =
    state.status === "focus" || state.status === "break" || state.status === "paused"
      ? state.session
      : null;

  const startTopic = command === "START" ? await ownedTopicId(user.id, task.id, topicId) : null;

  await prisma.$transaction(async (tx) => {
    switch (command) {
      case "START": {
        if (next.status !== "focus" && next.status !== "break") return;
        const s = next.session;
        await tx.pomodoroSession.create({
          data: {
            id: s.id,
            userId: user.id,
            taskId: task.id,
            type: s.type,
            plannedMinutes: s.plannedMinutes,
            startedAt: new Date(s.startedAt),
            topicId: startTopic,
          },
        });
        return;
      }
      case "PAUSE":
      case "RESUME": {
        if (next.status !== "paused" && next.status !== "focus" && next.status !== "break") return;
        await tx.pomodoroSession.update({
          where: { id: next.session.id },
          data: {
            pausedAt: next.session.pausedAt ? new Date(next.session.pausedAt) : null,
            pausedMs: next.session.pausedMs,
          },
        });
        return;
      }
      case "SKIP": {
        if (!current) return;
        // Close out a pause so elapsed time is final.
        const pausedMs = current.pausedAt
          ? current.pausedMs + (now - current.pausedAt)
          : current.pausedMs;
        await tx.pomodoroSession.update({
          where: { id: current.id },
          data: { endedAt: new Date(now), completed: false, pausedAt: null, pausedMs },
        });
        await creditFocus(tx, user, task, focusCreditMinutes(current, now, false), new Date(now));
        return;
      }
      case "COMPLETE": {
        if (next === state || !current) return; // not finished yet: nothing to persist
        const end = new Date(endsAt(current) as number);
        await tx.pomodoroSession.update({
          where: { id: current.id },
          data: { endedAt: end, completed: true },
        });
        await creditFocus(tx, user, task, focusCreditMinutes(current, end.getTime(), true), end);
        if (next.status === "focus" || next.status === "break") {
          const s = next.session; // auto-started, begins exactly at `end`
          // The next cycle continues on the same Work-Station topic.
          const prev = await tx.pomodoroSession.findUnique({
            where: { id: current.id },
            select: { topicId: true },
          });
          await tx.pomodoroSession.create({
            data: {
              id: s.id,
              userId: user.id,
              taskId: task.id,
              type: s.type,
              plannedMinutes: s.plannedMinutes,
              startedAt: new Date(s.startedAt),
              topicId: prev?.topicId ?? null,
            },
          });
        }
        return;
      }
    }
  });

  revalidateTimer(task.id);
  return { snapshot: await getTimerSnapshot(user, task.id) };
}
