import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { updateTask } from "@/actions/tasks";
import { TaskForm } from "@/components/tasks/task-form";
import { requireUser } from "@/lib/auth";
import { toLocalDateTimeInput } from "@/lib/dates";
import { getLinkableHabits, getTaskForUser } from "@/lib/tasks";
import type { TaskPriority, TaskStatus } from "@/schemas/task";

export const metadata: Metadata = { title: "Edit task" };

export default async function EditTaskPage({ params }: PageProps<"/tasks/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const user = await requireUser();
  const [task, habits] = await Promise.all([
    getTaskForUser(user.id, id),
    getLinkableHabits(user.id),
  ]);
  if (!task) notFound();

  // Keep a linked habit selectable even if it has since been archived.
  if (task.habitId && !habits.some((h) => h.id === task.habitId)) {
    habits.push({ id: task.habitId, name: "(archived habit)" });
  }

  return (
    <div className="enter mx-auto w-full max-w-2xl">
      <h2 className="mb-5 font-display text-xl font-medium tracking-tight">Edit task</h2>
      <div className="rounded-sm border border-border bg-surface p-4 sm:p-6">
        <TaskForm
          action={updateTask.bind(null, task.id)}
          habits={habits}
          timezone={user.timezone}
          submitLabel="Save changes"
          defaults={{
            title: task.title,
            note: task.note,
            status: task.status as TaskStatus,
            priority: task.priority as TaskPriority,
            dueLocal: task.dueAt ? toLocalDateTimeInput(task.dueAt, user.timezone) : "",
            targetMinutes: task.targetMinutes,
            habitId: task.habitId,
            category: task.category,
          }}
        />
      </div>
    </div>
  );
}
