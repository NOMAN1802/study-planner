"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { missingPresets, presetOf, toggledParts } from "@/lib/daily-habits";
import { addDays, dayInfo, dayKeyOf, isDayKey } from "@/lib/planner";
import { prisma } from "@/lib/prisma";

/** Ticks can be filled in this far back. */
const BACKFILL_DAYS = 3 * 366;
const NOTE_MAX = 280;

function revalidate() {
  revalidatePath("/habits", "layout");
  revalidatePath("/dashboard");
}

/** A day that can be ticked: a valid date, not in the future, not too far back. */
function tickableDay(day: unknown, timezone: string): string | null {
  if (!isDayKey(day)) return null;
  const today = dayKeyOf(new Date(), timezone);
  if (day > today || day < addDays(today, -BACKFILL_DAYS)) return null;
  return day;
}

/** Creates the habits of the daily set that the user doesn't have yet. */
export async function addDailySet(): Promise<{ added: number; error?: string }> {
  const user = await requireUser();
  const existing = await prisma.habit.findMany({
    where: { userId: user.id, preset: { not: null } },
    select: { preset: true },
  });
  const missing = missingPresets(existing.map((h) => h.preset));
  if (missing.length === 0) return { added: 0 };
  const last = await prisma.habit.findFirst({
    where: { userId: user.id, archivedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const base = (last?.sortOrder ?? -1) + 1;
  const { count } = await prisma.habit.createMany({
    data: missing.map((p, i) => ({
      userId: user.id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      frequency: "DAILY" as const,
      preset: p.preset,
      parts: p.parts ? [...p.parts] : [],
      targetCount: p.parts ? p.parts.length : null,
      sortOrder: base + i,
    })),
    skipDuplicates: true,
  });
  revalidate();
  return { added: count };
}

const checkSchema = z.object({
  habitId: z.uuid(),
  day: z.string(),
  done: z.boolean(),
  /** Index into the habit's parts (prayer); absent for single habits. */
  part: z.number().int().min(0).max(19).optional(),
});

/** Ticks a habit (or one of its parts) on or off for a day. */
export async function setDailyCheck(input: {
  habitId: string;
  day: string;
  done: boolean;
  part?: number;
}): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid tick." };
  const day = tickableDay(parsed.data.day, user.timezone);
  if (!day) return { error: "Days in the future can't be ticked." };

  const habit = await prisma.habit.findFirst({
    where: { id: parsed.data.habitId, userId: user.id, archivedAt: null, frequency: "DAILY" },
  });
  if (!habit) return { error: "Habit not found." };
  if (presetOf(habit.preset)?.auto) return { error: "This habit is tracked automatically." };

  const { part, done } = parsed.data;
  if (habit.parts.length > 0 && (part === undefined || part >= habit.parts.length)) {
    return { error: "Pick which one to tick." };
  }

  const periodStart = new Date(dayInfo(day, user.timezone).start);
  const where = { habitId_periodStart: { habitId: habit.id, periodStart } };

  await prisma.$transaction(async (tx) => {
    const log = await tx.habitLog.findUnique({ where });
    const parts =
      habit.parts.length > 0 ? toggledParts(log?.parts ?? [], part as number, done) : [];
    const count = habit.parts.length > 0 ? parts.length : done ? 1 : 0;
    if (count === 0 && !log?.minutes && !log?.note) {
      if (log) await tx.habitLog.delete({ where });
      return;
    }
    await tx.habitLog.upsert({
      where,
      create: { habitId: habit.id, userId: user.id, periodStart, count, parts },
      update: { count, parts },
    });
  });
  revalidate();
  return {};
}

const noteSchema = z.string().trim().max(NOTE_MAX, `Keep it under ${NOTE_MAX} characters.`);

/** Saves (or clears) the one-line note of a day. */
export async function saveDayNote(day: string, note: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const d = tickableDay(day, user.timezone);
  if (!d) return { error: "Days in the future can't have a note." };
  const parsed = noteSchema.safeParse(note);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!parsed.data) {
    await prisma.habitDayNote.deleteMany({ where: { userId: user.id, day: d } });
  } else {
    await prisma.habitDayNote.upsert({
      where: { userId_day: { userId: user.id, day: d } },
      create: { userId: user.id, day: d, note: parsed.data },
      update: { note: parsed.data },
    });
  }
  revalidate();
  return {};
}

/** Saves the note on one habit's day (e.g. what new technology was learned). */
export async function saveHabitDayNote(
  habitId: string,
  day: string,
  note: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const d = tickableDay(day, user.timezone);
  if (!d || !z.uuid().safeParse(habitId).success) return { error: "Invalid note." };
  const parsed = noteSchema.safeParse(note);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId: user.id, archivedAt: null, frequency: "DAILY" },
    select: { id: true },
  });
  if (!habit) return { error: "Habit not found." };

  const periodStart = new Date(dayInfo(d, user.timezone).start);
  const where = { habitId_periodStart: { habitId: habit.id, periodStart } };
  const text = parsed.data || null;
  await prisma.$transaction(async (tx) => {
    const log = await tx.habitLog.findUnique({ where });
    if (!log && !text) return;
    if (log && !text && log.count === 0 && log.minutes === 0) {
      await tx.habitLog.delete({ where });
      return;
    }
    await tx.habitLog.upsert({
      where,
      create: { habitId: habit.id, userId: user.id, periodStart, count: 0, note: text },
      update: { note: text },
    });
  });
  revalidate();
  return {};
}
