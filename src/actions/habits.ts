"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { periodStart, type Frequency } from "@/lib/dates";
import { periodContext } from "@/lib/habits";
import { prisma } from "@/lib/prisma";
import {
  checkInSchema,
  habitFieldErrors,
  habitFormValues,
  habitSchema,
  type CheckInFormState,
  type HabitFormState,
} from "@/schemas/habit";

const idSchema = z.uuid();

function revalidateHabits() {
  revalidatePath("/habits");
  revalidatePath("/dashboard");
}

/** Loads a habit only if it belongs to the user. */
async function ownedHabit(userId: string, habitId: string) {
  if (!idSchema.safeParse(habitId).success) return null;
  return prisma.habit.findFirst({ where: { id: habitId, userId } });
}

export async function createHabit(
  _prev: HabitFormState,
  formData: FormData,
): Promise<HabitFormState> {
  const user = await requireUser();
  const parsed = habitSchema.safeParse(habitFormValues(formData));
  if (!parsed.success) return { fieldErrors: habitFieldErrors(parsed.error) };

  const last = await prisma.habit.findFirst({
    where: { userId: user.id, archivedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.habit.create({
    data: { ...parsed.data, userId: user.id, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });

  revalidateHabits();
  redirect("/habits");
}

export async function updateHabit(
  habitId: string,
  _prev: HabitFormState,
  formData: FormData,
): Promise<HabitFormState> {
  const user = await requireUser();
  const habit = await ownedHabit(user.id, habitId);
  if (!habit) return { error: "Habit not found." };

  const parsed = habitSchema.safeParse(habitFormValues(formData));
  if (!parsed.success) return { fieldErrors: habitFieldErrors(parsed.error) };

  if (parsed.data.frequency !== habit.frequency) {
    // Existing logs are keyed to the old period length; changing it would make
    // them meaningless, so it is only allowed before any check-in exists.
    const logCount = await prisma.habitLog.count({ where: { habitId: habit.id } });
    if (logCount > 0) {
      return {
        fieldErrors: {
          frequency:
            "Frequency can't change after check-ins exist. Archive this habit and create a new one.",
        },
      };
    }
  }

  await prisma.habit.update({ where: { id: habit.id }, data: parsed.data });

  revalidateHabits();
  redirect("/habits");
}

export async function setHabitArchived(habitId: string, archived: boolean): Promise<void> {
  const user = await requireUser();
  const habit = await ownedHabit(user.id, habitId);
  if (!habit) return;

  let sortOrder = habit.sortOrder;
  if (!archived) {
    // Restored habits go to the bottom of the active list.
    const last = await prisma.habit.findFirst({
      where: { userId: user.id, archivedAt: null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  await prisma.habit.update({
    where: { id: habit.id },
    data: { archivedAt: archived ? new Date() : null, sortOrder },
  });
  revalidateHabits();
}

/** Persists a new order for the user's active habits. */
export async function reorderHabits(orderedIds: string[]): Promise<{ error?: string }> {
  const user = await requireUser();
  const ids = z.array(z.uuid()).max(500).safeParse(orderedIds);
  if (!ids.success || new Set(ids.data).size !== ids.data.length) {
    return { error: "Invalid order." };
  }

  const owned = await prisma.habit.findMany({
    where: { userId: user.id, archivedAt: null },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((h) => h.id));
  if (ids.data.length !== ownedIds.size || !ids.data.every((id) => ownedIds.has(id))) {
    return { error: "Your habits changed. Reload and try again." };
  }

  await prisma.$transaction(
    ids.data.map((id, index) =>
      prisma.habit.update({ where: { id, userId: user.id }, data: { sortOrder: index } }),
    ),
  );
  revalidateHabits();
  return {};
}

/** Adds one check-in to the current period. */
export async function checkIn(habitId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const habit = await ownedHabit(user.id, habitId);
  if (!habit || habit.archivedAt) return { error: "Habit not found." };

  const start = periodStart(new Date(), periodContext(user, habit.frequency as Frequency));
  await prisma.habitLog.upsert({
    where: { habitId_periodStart: { habitId: habit.id, periodStart: start } },
    create: { habitId: habit.id, userId: user.id, periodStart: start, count: 1 },
    update: { count: { increment: 1 } },
  });
  revalidateHabits();
  return {};
}

/** Sets the current period's count, minutes and note. All-empty removes the log. */
export async function saveCheckIn(
  _prev: CheckInFormState,
  formData: FormData,
): Promise<CheckInFormState> {
  const user = await requireUser();
  const parsed = checkInSchema.safeParse({
    habitId: formData.get("habitId"),
    count: formData.get("count") || 0,
    minutes: formData.get("minutes") || 0,
    note: formData.get("note"),
  });
  if (!parsed.success) {
    const fieldErrors: CheckInFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "count" || key === "minutes" || key === "note") && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { fieldErrors };
  }

  const habit = await ownedHabit(user.id, parsed.data.habitId);
  if (!habit || habit.archivedAt) return { error: "Habit not found." };

  const start = periodStart(new Date(), periodContext(user, habit.frequency as Frequency));
  const where = { habitId_periodStart: { habitId: habit.id, periodStart: start } };
  const { count, minutes, note } = parsed.data;

  if (count === 0 && minutes === 0 && !note) {
    await prisma.habitLog.deleteMany({ where: { habitId: habit.id, periodStart: start } });
  } else {
    await prisma.habitLog.upsert({
      where,
      create: { habitId: habit.id, userId: user.id, periodStart: start, count, minutes, note },
      update: { count, minutes, note },
    });
  }

  revalidateHabits();
  return { ok: true };
}
