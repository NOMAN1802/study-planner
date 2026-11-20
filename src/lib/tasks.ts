import type { CurrentUser } from "@/lib/auth";
import { formatDue } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { taskOrderBy, taskWhere } from "@/lib/task-query";
import type { TaskCategory, TaskFilters, TaskPriority, TaskStatus } from "@/schemas/task";

export type TaskRow = {
  id: string;
  title: string;
  note: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  dueLabel: string | null;
  overdue: boolean;
  targetMinutes: number | null;
  actualMinutes: number;
  habit: { id: string; name: string; color: string } | null;
  category: TaskCategory;
};

export async function getTaskRows(
  user: CurrentUser,
  filters: TaskFilters,
  now = new Date(),
  only?: "OFFICE",
): Promise<TaskRow[]> {
  const tasks = await prisma.task.findMany({
    // Study tasks back Study Station subjects; they are not listed as tasks.
    where: { ...taskWhere(user.id, filters, user, now), category: only ?? { not: "STUDY" } },
    orderBy: taskOrderBy(filters.sort),
    include: { habit: { select: { id: true, name: true, color: true } } },
    take: 500,
  });
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    note: t.note,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    dueAt: t.dueAt?.toISOString() ?? null,
    dueLabel: t.dueAt ? formatDue(t.dueAt, user.timezone, now) : null,
    overdue: Boolean(t.dueAt && t.dueAt < now && t.status !== "DONE"),
    targetMinutes: t.targetMinutes,
    actualMinutes: t.actualMinutes,
    habit: t.habit,
    category: t.category as TaskCategory,
  }));
}

export async function countTasks(userId: string) {
  return prisma.task.count({ where: { userId, category: { not: "STUDY" } } });
}

export async function getTaskForUser(userId: string, taskId: string) {
  return prisma.task.findFirst({ where: { id: taskId, userId } });
}

/** Active habits a task can be linked to. */
export async function getLinkableHabits(userId: string) {
  return prisma.habit.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });
}
