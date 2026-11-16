"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { parseLocalDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  TASK_STATUSES,
  taskFieldErrors,
  taskFormValues,
  taskSchema,
  type TaskFormState,
  type TaskStatus,
} from "@/schemas/task";

const idSchema = z.uuid();

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/work-station");
}

/** Office tasks live in Work-Station; everything else in Tasks. */
function listPathFor(category: string) {
  return category === "OFFICE" ? "/work-station?tab=office" : "/tasks";
}

async function ownedTask(userId: string, taskId: string) {
  if (!idSchema.safeParse(taskId).success) return null;
  return prisma.task.findFirst({ where: { id: taskId, userId } });
}

/** Validates the form and resolves user-relative values (due date, habit ownership). */
async function parseTaskForm(user: CurrentUser, formData: FormData) {
  const parsed = taskSchema.safeParse(taskFormValues(formData));
  if (!parsed.success) return { errors: taskFieldErrors(parsed.error) } as const;

  const { dueAt: dueLocal, habitId, ...rest } = parsed.data;

  let dueAt: Date | null = null;
  if (dueLocal) {
    dueAt = parseLocalDateTime(dueLocal, user.timezone);
    if (!dueAt) return { errors: { dueAt: "Enter a valid date and time" } } as const;
  }

  if (habitId) {
    const habit = await prisma.habit.findFirst({
      where: { id: habitId, userId: user.id },
      select: { id: true },
    });
    if (!habit) return { errors: { habitId: "Pick a habit" } } as const;
  }

  return { data: { ...rest, dueAt, habitId } } as const;
}

function completedAtFor(
  status: TaskStatus,
  previous?: { status: string; completedAt: Date | null },
) {
  if (status !== "DONE") return null;
  // Keep the original completion time if it was already done.
  return previous?.status === "DONE" && previous.completedAt ? previous.completedAt : new Date();
}

export async function createTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const user = await requireUser();
  const result = await parseTaskForm(user, formData);
  if ("errors" in result) return { fieldErrors: result.errors };

  await prisma.task.create({
    data: { ...result.data, userId: user.id, completedAt: completedAtFor(result.data.status) },
  });
  revalidateTasks();
  redirect(listPathFor(result.data.category));
}

export async function updateTask(
  taskId: string,
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const user = await requireUser();
  const task = await ownedTask(user.id, taskId);
  if (!task) return { error: "Task not found." };

  const result = await parseTaskForm(user, formData);
  if ("errors" in result) return { fieldErrors: result.errors };

  // A subject's backing task stays a study task.
  const category = task.category === "STUDY" ? "STUDY" : result.data.category;
  await prisma.task.update({
    where: { id: task.id },
    data: { ...result.data, category, completedAt: completedAtFor(result.data.status, task) },
  });
  revalidateTasks();
  redirect(listPathFor(category));
}

export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!(TASK_STATUSES as readonly string[]).includes(status)) return { error: "Invalid status." };
  const task = await ownedTask(user.id, taskId);
  if (!task) return { error: "Task not found." };

  await prisma.task.update({
    where: { id: task.id },
    data: { status, completedAt: completedAtFor(status, task) },
  });
  revalidateTasks();
  return {};
}

export async function deleteTask(taskId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const task = await ownedTask(user.id, taskId);
  if (!task) return { error: "Task not found." };

  // Pomodoro config/sessions cascade; time blocks are unlinked (SetNull).
  await prisma.task.delete({ where: { id: task.id } });
  revalidateTasks();
  return {};
}
