"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getBlockForUser, type PlannerBlock } from "@/lib/planner-server";
import { prisma } from "@/lib/prisma";
import { createBlockSchema, spanSchema, type CreateBlockInput } from "@/schemas/planner";

const idSchema = z.uuid();

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid block.";
}

export async function createTimeBlock(
  input: CreateBlockInput,
): Promise<{ block?: PlannerBlock; error?: string }> {
  const user = await requireUser();
  const parsed = createBlockSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { kind, refId, start, end } = parsed.data;

  // The linked item must belong to the user.
  const owned =
    kind === "task"
      ? await prisma.task.findFirst({ where: { id: refId, userId: user.id }, select: { id: true } })
      : await prisma.habit.findFirst({
          where: { id: refId, userId: user.id, archivedAt: null },
          select: { id: true },
        });
  if (!owned) return { error: kind === "task" ? "Task not found." : "Habit not found." };

  const row = await prisma.timeBlock.create({
    data: {
      userId: user.id,
      startAt: new Date(start),
      endAt: new Date(end),
      taskId: kind === "task" ? refId : null,
      habitId: kind === "habit" ? refId : null,
    },
  });
  revalidatePath("/planner");
  return { block: (await getBlockForUser(user.id, row.id)) ?? undefined };
}

export async function updateTimeBlock(
  id: string,
  span: { start: number; end: number },
): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Block not found." };
  const parsed = spanSchema.safeParse(span);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { count } = await prisma.timeBlock.updateMany({
    where: { id, userId: user.id },
    data: { startAt: new Date(parsed.data.start), endAt: new Date(parsed.data.end) },
  });
  if (count === 0) return { error: "Block not found." };
  revalidatePath("/planner");
  return {};
}

export async function deleteTimeBlock(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { error: "Block not found." };
  const { count } = await prisma.timeBlock.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) return { error: "Block not found." };
  revalidatePath("/planner");
  return {};
}
